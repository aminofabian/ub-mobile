import { cleanDisplayText } from './display-text';
import { isApiError } from './problem';
import { formatQty, unitsToQty, qtyToUnits } from './stock-qty';

/**
 * Changing how much of an item is on the shelf. The server's stock writes do not read an Idempotency-Key: a request
 * that is sent twice is applied twice. So nothing here is built to be "retried". Setting the stock to a number is
 * worked out again from a fresh read each time, so asking twice for "9" can never add the difference twice; and a
 * write-off, the one change that cannot be recomputed, is recognised afterwards from the item's history (see
 * `findNewSpoil`) and is never sent a second time on a guess.
 */

const NOTE_MAX = 200;

function cleanNote(text: string | undefined, fallback: string): string {
  const typed = (text ?? '').replace(/\s+/g, ' ').trim();
  return Array.from(typed || fallback).slice(0, NOTE_MAX).join('');
}

export type SetOnHandProblem = 'current_unknown' | 'pack_variant';

export type SetOnHandPlan =
  | { kind: 'same' }
  | { kind: 'increase'; units: number; unitCostCents: number; note: string }
  | { kind: 'decrease'; units: number; note: string };

/**
 * What it takes to make the shelf hold `targetUnits`, given what a fresh read says it holds now. Refused when the
 * current stock is not known (a change is a subtraction, and there is nothing to subtract from) and for a pack, whose
 * stock lives on another item. A shop that has sold below zero has a negative current stock, and is topped up from it.
 */
export function planSetOnHand(input: {
  currentUnits: number | null;
  targetUnits: number;
  buyingCents: number | null;
  packageVariant: boolean;
  note?: string;
}): { ok: true; plan: SetOnHandPlan } | { ok: false; problem: SetOnHandProblem } {
  if (input.packageVariant) return { ok: false, problem: 'pack_variant' };
  if (input.currentUnits === null || !Number.isFinite(input.currentUnits)) return { ok: false, problem: 'current_unknown' };
  const delta = input.targetUnits - input.currentUnits;
  if (delta === 0) return { ok: true, plan: { kind: 'same' } };
  const trail = `Set from phone: ${formatQty(input.currentUnits)} to ${formatQty(input.targetUnits)}`;
  const note = cleanNote(input.note, trail);
  if (delta > 0) {
    return { ok: true, plan: { kind: 'increase', units: delta, unitCostCents: input.buyingCents ?? 0, note } };
  }
  return { ok: true, plan: { kind: 'decrease', units: -delta, note } };
}

/** The body of `POST /api/v1/inventory/stock-increase`. */
export function stockIncreaseBody(branchId: string, itemId: string, plan: { units: number; unitCostCents: number; note: string }) {
  return { branchId, itemId, quantity: unitsToQty(plan.units), unitCost: plan.unitCostCents / 100, notes: plan.note };
}

/** The path that asks which batches the server would take `units` from. */
export function allocationPreviewPath(itemId: string, branchId: string, units: number): string {
  return `/api/v1/inventory/allocation-preview?itemId=${encodeURIComponent(itemId)}&branchId=${encodeURIComponent(branchId)}&quantity=${unitsToQty(units)}`;
}

export type DecreaseCall = { batchId: string; units: number };

/**
 * The batch-by-batch removals that make up a decrease, read from the server's allocation preview. Checked BEFORE the
 * first write: a preview that cannot cover the whole amount is refused outright, so a decrease is never started and
 * left half done. Lines that are not a batch with a positive amount are ignored, and the last line is cut to what is
 * still wanted, so never more than was asked for is removed.
 */
export function planDecreaseCalls(
  preview: unknown,
  wantedUnits: number
): { ok: true; calls: DecreaseCall[] } | { ok: false; problem: 'none' | 'short'; coveredUnits: number } {
  const calls: DecreaseCall[] = [];
  let covered = 0;
  if (Array.isArray(preview)) {
    for (const line of preview) {
      if (covered >= wantedUnits) break;
      if (!line || typeof line !== 'object') continue;
      const row = line as Record<string, unknown>;
      const batchId = typeof row.batchId === 'string' ? row.batchId.trim() : '';
      const units = qtyToUnits(row.quantity);
      if (!batchId || batchId.length > 64 || units === null || units <= 0) continue;
      const take = Math.min(units, wantedUnits - covered);
      calls.push({ batchId, units: take });
      covered += take;
    }
  }
  if (calls.length === 0) return { ok: false, problem: 'none', coveredUnits: 0 };
  if (covered < wantedUnits) return { ok: false, problem: 'short', coveredUnits: covered };
  return { ok: true, calls };
}

/** The body of `POST /api/v1/inventory/batch-decrease`. */
export function batchDecreaseBody(call: DecreaseCall, note: string) {
  return { batchId: call.batchId, quantity: unitsToQty(call.units), reason: note };
}

/** The reasons a person can give for a write-off. The keys are the server's wastage categories. */
export const SPOIL_REASONS = [
  { key: 'SPOILAGE', label: 'Spoiled' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'BREAKAGE', label: 'Broken or damaged' },
  { key: 'THEFT', label: 'Stolen' },
  { key: 'SAMPLE', label: 'Sample or tasting' },
  { key: 'PERSONAL_USE', label: 'Own use' },
  { key: 'OTHER', label: 'Something else' },
] as const;

export type SpoilReason = (typeof SPOIL_REASONS)[number]['key'];

export function isSpoilReason(value: unknown): value is SpoilReason {
  return SPOIL_REASONS.some((reason) => reason.key === value);
}

/**
 * What a written-off unit is valued at. The server refuses a write-off with no cost, so an item that has no buying
 * price is valued at its selling price, and one with neither at one cent, the same fallback the web counter uses.
 * That is a book value, not a real one: it is why a shop with items missing a buying price sees odd write-off totals.
 */
export function spoilUnitCostCents(item: { buyingCents: number | null; sellingCents: number | null }): number {
  if (item.buyingCents !== null && item.buyingCents > 0) return item.buyingCents;
  if (item.sellingCents !== null && item.sellingCents > 0) return item.sellingCents;
  return 1;
}

/** The body of `POST /api/v1/inventory/wastage`. */
export function wastageBody(input: {
  branchId: string;
  itemId: string;
  units: number;
  unitCostCents: number;
  reason: SpoilReason;
  note?: string;
}) {
  return {
    branchId: input.branchId,
    itemId: input.itemId,
    quantity: unitsToQty(input.units),
    unitCost: Math.max(1, input.unitCostCents) / 100,
    reason: cleanNote(input.note, 'Written off on the phone'),
    wastageReason: input.reason,
  };
}

/** One stock entry of an item's history (`GET /api/v1/items/{id}/timeline`), reduced to what recognising a write-off needs. */
export type HistoryEntry = {
  eventType: string;
  branchId: string | null;
  deltaUnits: number;
  /** The operation that made it. Every batch a write-off took from carries the same one. */
  operationId: string;
  at: number | null;
};

/** The stock-movement entries of a history answer. Null when the answer is not a history, which is a failed read and not "no history". */
export function readHistory(raw: unknown): HistoryEntry[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const entries = (raw as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return null;
  const out: HistoryEntry[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const delta = qtyToUnits(row.quantityDelta);
    const operationId = typeof row.referenceId === 'string' ? row.referenceId.trim() : '';
    if (typeof row.eventType !== 'string' || delta === null || !operationId) continue;
    const at = typeof row.createdAt === 'string' ? Date.parse(row.createdAt) : NaN;
    out.push({
      eventType: row.eventType,
      branchId: typeof row.branchId === 'string' ? row.branchId : null,
      deltaUnits: delta,
      operationId,
      at: Number.isFinite(at) ? at : null,
    });
  }
  return out;
}

/**
 * How far apart the phone's clock and the server's may be, and a write-off in an item's history still be taken for the
 * one the phone sent. A history whose oldest entry is newer than the moment a write-off was sent, less this, may have
 * pushed that write-off out of what the server returned.
 */
export const HISTORY_SLACK_MS = 10 * 60_000;

/**
 * An item's history as the server answered, with how far back it reaches. The server returns the newest entries only,
 * at most `limit` of them: an answer that came back full may have cut off older ones, and for anything that happened
 * before its oldest entry "it is not in the history" proves nothing.
 */
export type ItemHistory = { entries: HistoryEntry[]; full: boolean; oldestAt: number | null };

/** The history and its reach. Null when the answer is not a history, which is a failed read and not "no history". */
export function readItemHistory(raw: unknown, limit: number): ItemHistory | null {
  const entries = readHistory(raw);
  if (!entries) return null;
  const rows = (raw as { entries: unknown[] }).entries;
  let oldestAt: number | null = null;
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const created = (row as Record<string, unknown>).createdAt;
    const at = typeof created === 'string' ? Date.parse(created) : Number.NaN;
    if (Number.isFinite(at) && (oldestAt === null || at < oldestAt)) oldestAt = at;
  }
  // Every row counts toward the server's limit, including the ones this app cannot use.
  return { entries, full: rows.length >= limit, oldestAt };
}

/** The write-offs one branch already has in an item's history, by operation, with what each took off the shelf in all. */
export function spoilOperations(history: readonly HistoryEntry[], branchId: string): Map<string, { units: number; at: number | null }> {
  const found = new Map<string, { units: number; at: number | null }>();
  for (const entry of history) {
    if (entry.eventType !== 'stock.wastage' || entry.branchId !== branchId || entry.deltaUnits >= 0) continue;
    const seen = found.get(entry.operationId);
    const at = entry.at === null ? (seen?.at ?? null) : seen?.at === undefined || seen.at === null ? entry.at : Math.min(seen.at, entry.at);
    found.set(entry.operationId, { units: (seen?.units ?? 0) - entry.deltaUnits, at });
  }
  return found;
}

/**
 * Whether a write-off the app is not sure went through is in the item's history now. `known` is every write-off
 * operation the history already held BEFORE the attempt was sent, so only a new one counts, and it counts only when it
 * took exactly the amount that was asked for, at that branch, and not before the attempt started (`since`, with a
 * slack for the phone's clock). A match is "yes, it went through"; no match is only "not seen": the server may still be
 * working on it, so the caller asks the person rather than sending it again by itself.
 */
export function findNewSpoil(
  history: readonly HistoryEntry[],
  input: { branchId: string; units: number; known: ReadonlySet<string>; since?: number; slackMs?: number }
): { operationId: string } | null {
  const slack = input.slackMs ?? HISTORY_SLACK_MS;
  for (const [operationId, op] of spoilOperations(history, input.branchId)) {
    if (input.known.has(operationId) || op.units !== input.units) continue;
    if (input.since !== undefined && op.at !== null && op.at < input.since - slack) continue;
    return { operationId };
  }
  return null;
}

export type WriteFailure = { kind: 'doubt' } | { kind: 'refused'; words: string };

/**
 * What a failed stock write means. A request with no answer (no signal, a timeout, a busy server, a web page where the
 * server's answer should be) may or may not have been applied: that is "doubt", and the caller must look at the item
 * before it writes again. Anything the server turned down says so by its status, and changed nothing. The status is
 * read, never the English.
 */
export function classifyWrite(error: unknown): WriteFailure {
  if (!isApiError(error) || error.foreign) return { kind: 'doubt' };
  const { status } = error;
  if (status === 401 || status === 408 || status === 423 || status === 429 || status >= 500) return { kind: 'doubt' };
  if (status >= 400) return { kind: 'refused', words: cleanDisplayText(error.hint || error.message, 140) || 'The server did not accept that.' };
  return { kind: 'doubt' };
}
