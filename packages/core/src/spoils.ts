import type { Keeper } from './keeper';
import { findNewSpoil, HISTORY_SLACK_MS, isSpoilReason, spoilUnitCostCents, type ItemHistory, type SpoilReason } from './stock-adjust';
import { MAX_QTY_UNITS } from './stock-qty';

/**
 * The write-offs a person is listing, and the one that is on its way to the server. A write-off is the one stock change
 * the app cannot work out again from a fresh read (the server does not read an Idempotency-Key, and "write off 2" sent
 * twice writes off 4), so the list remembers, before it sends, exactly which write-off is in flight and what the item's
 * history already held. If the app is closed, or the answer is lost, that memory is what lets it find out afterwards
 * whether the write-off happened, instead of guessing.
 */

export type SpoilLine = {
  itemId: string;
  name: string;
  units: number;
  unitCostCents: number;
  /** Sold by weight or measure, so a fraction of a unit is a real quantity. */
  weighed: boolean;
};

export type InFlight = {
  itemId: string;
  name: string;
  units: number;
  unitCostCents: number;
  reason: SpoilReason;
  /** The branch it was sent from. It is looked for there, whoever is at the counter when the answer is checked. */
  branchId: string;
  /** The write-off operations the item's history already held before this one was sent. */
  baseline: string[];
  startedAt: number;
};

export type SpoilList = {
  ownerId: string;
  branchId: string;
  savedAt: number;
  reason: SpoilReason;
  lines: SpoilLine[];
  inFlight: InFlight | null;
};

export const MAX_SPOIL_LINES = 100;
/** A list left alone this long is not offered again: it is a past shift's list. A write-off in flight is never let go by the clock. */
export const SPOIL_LIST_LIFETIME_MS = 12 * 60 * 60_000;
/** The most history ids kept with a write-off in flight. */
export const MAX_BASELINE = 200;

export function emptySpoils(owner: { ownerId: string; branchId: string }, now: number): SpoilList {
  return { ownerId: owner.ownerId, branchId: owner.branchId, savedAt: now, reason: 'SPOILAGE', lines: [], inFlight: null };
}

/**
 * The list for whoever is at the counter. Someone else's lines, or another branch's, are not shown to them and not kept
 * for them; a write-off in flight stays, whoever is signed in, because it is about the shelf and not about the person.
 */
export function claimSpoils(list: SpoilList | null, owner: { ownerId: string; branchId: string }, now: number): SpoilList {
  if (!list) return emptySpoils(owner, now);
  if (list.ownerId === owner.ownerId && list.branchId === owner.branchId) return list;
  return { ...emptySpoils(owner, now), inFlight: list.inFlight };
}

function touch(list: SpoilList, now: number, change: Partial<SpoilList>): SpoilList {
  return { ...list, ...change, savedAt: now };
}

export function addSpoil(
  list: SpoilList,
  item: { id: string; name: string; weighed: boolean; buyingCents: number | null; sellingCents: number | null },
  units: number,
  now: number
): { ok: true; list: SpoilList } | { ok: false; why: 'bad_quantity' | 'too_big' | 'too_many' | 'busy' } {
  if (!Number.isInteger(units) || units <= 0) return { ok: false, why: 'bad_quantity' };
  if (list.inFlight && list.inFlight.itemId === item.id) return { ok: false, why: 'busy' };
  const existing = list.lines.find((line) => line.itemId === item.id);
  if (!existing && list.lines.length >= MAX_SPOIL_LINES) return { ok: false, why: 'too_many' };
  // One line holds what a quantity box takes and no more: a longer one could not be read back from the phone, and would take a write-off in doubt with it.
  if ((existing ? existing.units : 0) + units > MAX_QTY_UNITS) return { ok: false, why: 'too_big' };
  const lines = existing
    ? list.lines.map((line) => (line.itemId === item.id ? { ...line, units: line.units + units } : line))
    : [...list.lines, { itemId: item.id, name: item.name, units, unitCostCents: spoilUnitCostCents(item), weighed: item.weighed }];
  return { ok: true, list: touch(list, now, { lines }) };
}

export function setSpoilUnits(list: SpoilList, itemId: string, units: number, now: number): SpoilList {
  if (!Number.isInteger(units) || units <= 0 || units > MAX_QTY_UNITS || list.inFlight?.itemId === itemId) return list;
  return touch(list, now, { lines: list.lines.map((line) => (line.itemId === itemId ? { ...line, units } : line)) });
}

export function removeSpoil(list: SpoilList, itemId: string, now: number): SpoilList {
  if (list.inFlight?.itemId === itemId || !list.lines.some((line) => line.itemId === itemId)) return list;
  return touch(list, now, { lines: list.lines.filter((line) => line.itemId !== itemId) });
}

export function setReason(list: SpoilList, reason: SpoilReason, now: number): SpoilList {
  return reason === list.reason ? list : touch(list, now, { reason });
}

export function clearSpoils(list: SpoilList, now: number): SpoilList {
  return list.inFlight || list.lines.length === 0 ? list : touch(list, now, { lines: [] });
}

/** The line to send next: the first one, when nothing is in flight. */
export function nextSpoil(list: SpoilList): SpoilLine | null {
  return list.inFlight ? null : (list.lines[0] ?? null);
}

/** Writes down that a line is about to be sent, with what the item's history held before. Refused when another is already in flight. */
export function beginSpoil(list: SpoilList, line: SpoilLine, baseline: readonly string[], now: number): SpoilList | null {
  if (list.inFlight) return null;
  if (!list.lines.some((candidate) => candidate.itemId === line.itemId && candidate.units === line.units)) return null;
  return touch(list, now, {
    inFlight: {
      itemId: line.itemId,
      name: line.name,
      units: line.units,
      unitCostCents: line.unitCostCents,
      reason: list.reason,
      branchId: list.branchId,
      baseline: baseline.slice(-MAX_BASELINE),
      startedAt: now,
    },
  });
}

/** What writing a write-off down needs from the keeper. */
export type SpoilKeeper = Pick<Keeper<SpoilList | null>, 'update' | 'isLoaded'>;

/**
 * Writes down that a line is about to be sent, and says whether THIS call is the one that wrote it. When a write-off is
 * already in flight (another pass began one a moment ago, or the screen was closed and opened again while an earlier
 * pass was still going) nothing is changed and the answer is false: that caller must not send, or the server takes the
 * same write-off off twice. Also false when what is kept on the phone has not been read yet.
 */
export function beginSending(keeper: SpoilKeeper, line: SpoilLine, baseline: readonly string[], now: number): boolean {
  if (!keeper.isLoaded()) return false;
  let began = false;
  keeper.update((latest) => {
    const next = latest ? beginSpoil(latest, line, baseline, now) : null;
    if (!next) return latest;
    began = true;
    return next;
  });
  return began;
}

/** The write-off is known to have happened: its line is done and nothing is in flight. */
export function spoilDone(list: SpoilList, now: number): SpoilList {
  const flight = list.inFlight;
  if (!flight) return list;
  const lines = list.lines.filter((line) => !(line.itemId === flight.itemId && line.units === flight.units));
  return touch(list, now, { lines, inFlight: null });
}

/** The server refused the write-off, or it is known not to have happened: the line stays, nothing is in flight. */
export function spoilNotDone(list: SpoilList, now: number): SpoilList {
  return list.inFlight ? touch(list, now, { inFlight: null }) : list;
}

/** The person gave up on the line that was in doubt. */
export function spoilSkipped(list: SpoilList, now: number): SpoilList {
  return spoilDone(list, now);
}

/** How long after sending a write-off its absence from the item's history still proves nothing: the server may be slow. */
export const SPOIL_SETTLE_MS = 2 * 60_000;

export type SpoilVerdict = 'done' | 'not_seen' | 'too_soon' | 'too_busy' | 'unknown';

/**
 * Whether a write-off whose answer was lost went through, from the item's history now. `done` is only ever a match: a new
 * write-off for exactly this amount at this branch since it was sent. No match is `not_seen`, and only once the server has
 * had time to finish (`too_soon` before that), so a slow server is never mistaken for a write-off that did not happen.
 * A history that came back full and does not reach back to the moment it was sent may have pushed it out: that is
 * `too_busy`, and the person is told the phone cannot tell. Without a history to look at the answer is `unknown`.
 * Whoever acts on `not_seen` or `too_busy` is the person, not the app. It is looked for at the branch it was sent from.
 */
export function spoilVerdict(history: ItemHistory | null, flight: InFlight, now: number): SpoilVerdict {
  if (!history) return 'unknown';
  const found = findNewSpoil(history.entries, { branchId: flight.branchId, units: flight.units, known: new Set(flight.baseline), since: flight.startedAt });
  if (found) return 'done';
  if (now - flight.startedAt < SPOIL_SETTLE_MS) return 'too_soon';
  if (history.full && (history.oldestAt === null || history.oldestAt > flight.startedAt - HISTORY_SLACK_MS)) return 'too_busy';
  return 'not_seen';
}

// ---------------------------------------------------------------------------------------------
// Kept on the phone
// ---------------------------------------------------------------------------------------------

export function encodeSpoils(list: SpoilList | null): string | null {
  if (!list || (list.lines.length === 0 && !list.inFlight)) return null;
  return JSON.stringify({ v: 1, ...list });
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200;
}
function isUnits(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 10_000_000_000;
}
function isCents(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1_000_000_000;
}

/** The list kept on the phone. Null when there is none or it is unreadable; an old list is let go, unless a write-off is still in doubt. */
export function decodeSpoils(text: string | null, now: number): SpoilList | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (body.v !== 1 || !isText(body.ownerId) || !isText(body.branchId) || typeof body.savedAt !== 'number' || !isSpoilReason(body.reason) || !Array.isArray(body.lines)) return null;
  const lines: SpoilLine[] = [];
  for (const row of body.lines) {
    if (!row || typeof row !== 'object') return null;
    const line = row as Record<string, unknown>;
    if (!isText(line.itemId) || typeof line.name !== 'string' || !isUnits(line.units) || !isCents(line.unitCostCents) || typeof line.weighed !== 'boolean') return null;
    lines.push({ itemId: line.itemId, name: line.name, units: line.units, unitCostCents: line.unitCostCents, weighed: line.weighed });
  }
  let inFlight: InFlight | null = null;
  if (body.inFlight !== null && body.inFlight !== undefined) {
    const f = body.inFlight as Record<string, unknown>;
    if (!f || typeof f !== 'object' || !isText(f.itemId) || typeof f.name !== 'string' || !isUnits(f.units) || !isCents(f.unitCostCents) || !isSpoilReason(f.reason) || typeof f.startedAt !== 'number') return null;
    if (!Array.isArray(f.baseline) || !f.baseline.every((id) => typeof id === 'string')) return null;
    // A write-off kept before it was noted with its branch was sent from the list's own.
    const flightBranch = f.branchId === undefined ? body.branchId : f.branchId;
    if (!isText(flightBranch)) return null;
    inFlight = { itemId: f.itemId, name: f.name, units: f.units, unitCostCents: f.unitCostCents, reason: f.reason, branchId: flightBranch, baseline: f.baseline as string[], startedAt: f.startedAt };
  }
  if (!inFlight && now - body.savedAt > SPOIL_LIST_LIFETIME_MS) return null;
  return { ownerId: body.ownerId, branchId: body.branchId, savedAt: body.savedAt, reason: body.reason, lines, inFlight };
}
