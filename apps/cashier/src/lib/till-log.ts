import { readTenantValue, writeTenantValue } from '@kiosk/core';
import { formatMoney, toCents, totalCents } from './money';
import { readFacts } from './sale-facts';
import { totalMismatch } from './sale-flow';
import { maskCode, objectsIn } from './sale-summary';
import { formatWhen } from './when';

/**
 * A short record, kept on the phone for a manager, of the things the till cannot put right by itself: a sale that was
 * thrown away unsent, a sale the server priced differently once it was sent, a sale that was sent while someone else
 * was signed in, and a sale paid with an M-Pesa code that was typed in and has not been checked by anyone. Plain words,
 * at most 50 entries and 30 days, newest first.
 */
export type LogKind = 'discarded' | 'priced_differently' | 'sent_by_other' | 'typed_code';

export interface LogEntry {
  /** `kind:saleId`: the same thing is never recorded twice. */
  id: string;
  kind: LogKind;
  /** When it was recorded (milliseconds since 1970). */
  at: number;
  text: string;
}

export const LOG_MAX_ENTRIES = 50;
export const LOG_LIFETIME_MS = 30 * 24 * 60 * 60_000;
const TEXT_LIMIT = 400;
const ID_LIMIT = 120;
const KINDS: readonly string[] = ['discarded', 'priced_differently', 'sent_by_other', 'typed_code'];
/** A phone whose clock was wrong when an entry was written: an entry from further ahead than this is not believed. */
const FUTURE_SLACK_MS = 24 * 60 * 60_000;

/**
 * Newest first, at most 50. When there are more, the oldest notes about typed M-Pesa codes go first: they are the
 * commonest, and they must not push out a sale that was thrown away or a customer who is owed money.
 */
export function trimLog(entries: readonly LogEntry[]): LogEntry[] {
  const sorted = [...entries].sort((a, b) => b.at - a.at);
  let over = sorted.length - LOG_MAX_ENTRIES;
  if (over <= 0) return sorted;
  const gone = new Set<number>();
  for (let index = sorted.length - 1; index >= 0 && over > 0; index -= 1) {
    if (sorted[index].kind === 'typed_code') {
      gone.add(index);
      over -= 1;
    }
  }
  for (let index = sorted.length - 1; index >= 0 && over > 0; index -= 1) {
    if (!gone.has(index)) {
      gone.add(index);
      over -= 1;
    }
  }
  return sorted.filter((_, index) => !gone.has(index));
}

/** The log with `entry` added (replacing one with the same id), anything older than 30 days dropped, newest first, at most 50. */
export function addToLog(log: readonly LogEntry[], entry: LogEntry, now: number): LogEntry[] {
  return trimLog([entry, ...log.filter((other) => other.id !== entry.id)].filter((item) => now - item.at <= LOG_LIFETIME_MS));
}

export function removeFromLog(log: readonly LogEntry[], id: string): LogEntry[] {
  return log.filter((entry) => entry.id !== id);
}

export function encodeLog(log: readonly LogEntry[]): string {
  return JSON.stringify({ v: 1, entries: log });
}

/** The log as the phone kept it. Anything that is not an entry as written, or is too old or from the future, is left out. */
export function parseLog(text: string | null, now: number): LogEntry[] {
  if (!text) return [];
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return [];
  }
  const list = value && typeof value === 'object' ? (value as { v?: unknown; entries?: unknown }) : null;
  if (!list || list.v !== 1 || !Array.isArray(list.entries)) return [];
  const entries: LogEntry[] = [];
  for (const raw of list.entries) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id || item.id.length > ID_LIMIT) continue;
    if (typeof item.kind !== 'string' || !KINDS.includes(item.kind)) continue;
    if (typeof item.at !== 'number' || !Number.isFinite(item.at)) continue;
    if (item.at > now + FUTURE_SLACK_MS || now - item.at > LOG_LIFETIME_MS) continue;
    if (typeof item.text !== 'string' || !item.text.trim()) continue;
    entries.push({ id: item.id, kind: item.kind as LogKind, at: item.at, text: item.text.slice(0, TEXT_LIMIT) });
  }
  return trimLog(entries);
}

// ---------------------------------------------------------------------------------------------
// What goes in it
// ---------------------------------------------------------------------------------------------

interface Queued {
  id: string;
  body?: unknown;
  createdAt?: string;
  label?: string;
  facts?: unknown;
}

function bits(item: Queued) {
  const body = (item.body ?? {}) as { lines?: unknown; payments?: unknown };
  const lines = objectsIn<{ quantity: number; unitPrice: number }>(body.lines);
  const payments = objectsIn<{ method?: string; amount?: number; reference?: string }>(body.payments);
  // A sale has lines. Something queued that has none is not a sale of nothing: its total is not known.
  return {
    payments,
    total: lines.length === 0 ? null : totalCents(lines.map((line) => ({ quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) }))),
  };
}

/** "The sale of 600.00 rung 23 Nov, 10:12 by Amina". */
function whichSale(item: Queued): string {
  const { total } = bits(item);
  const by = readFacts(item).rungBy;
  return `${total === null ? 'A sale' : `The sale of ${formatMoney(total)}`} rung ${formatWhen(item.createdAt)}${by ? ` by ${by}` : ''}`;
}

const entry = (kind: LogKind, item: Queued, now: number, text: string): LogEntry => ({
  id: `${kind}:${item.id}`.slice(0, ID_LIMIT),
  kind,
  at: now,
  text: text.slice(0, TEXT_LIMIT),
});

/** A sale thrown away without being sent. */
export function discardedEntry(item: Queued, by: string, now: number): LogEntry {
  const mpesa = bits(item).payments.some((payment) => payment.method === 'mpesa_manual' || payment.method === 'mpesa');
  const what = item.label?.trim() ? ` It was: ${item.label.trim()}.` : '';
  return entry('discarded', item, now, `${whichSale(item)} was discarded by ${by || 'someone'} and never sent${mpesa ? ' (it had an M-Pesa payment)' : ''}.${what}`);
}

/** A sale the server priced differently from the till once it was sent. Null when the totals agree, or the server did not say. */
export function differenceEntry(item: Queued, response: unknown, now: number): LogEntry | null {
  const { total } = bits(item);
  const served = response && typeof response === 'object' ? (response as { grandTotal?: unknown }).grandTotal : undefined;
  if (total === null) return null;
  const mismatch = totalMismatch(total, served);
  if (!mismatch) return null;
  const what =
    mismatch.owedBackCents > 0
      ? `${formatMoney(mismatch.owedBackCents)} is owed back to the customer.`
      : `The customer owes ${formatMoney(-mismatch.owedBackCents)} more.`;
  return entry('priced_differently', item, now, `${whichSale(item)} was priced ${formatMoney(mismatch.serverCents)} by the server, not ${formatMoney(total)} (a discount or a price change). ${what}`);
}

/** A sale that was sent while someone other than the person who rang it was signed in. Null when it was the same person, or it is not known who rang it. */
export function sentByOtherEntry(item: Queued, sender: { id: string; name: string }, now: number): LogEntry | null {
  const facts = readFacts(item);
  if (!facts.rungById || facts.rungById === sender.id) return null;
  return entry('sent_by_other', item, now, `${whichSale(item)} was sent while ${sender.name || 'someone else'} was signed in, so the server recorded it under them and in their shift.`);
}

/** A sale paid with an M-Pesa code that was typed in, for a manager to check against the M-Pesa statement. Null when it was not. */
export function typedCodeEntry(item: Queued, response: unknown, now: number): LogEntry | null {
  if (!readFacts(item).mpesaTyped) return null;
  const mpesa = bits(item).payments.filter((payment) => payment.method === 'mpesa_manual');
  const amount = mpesa.reduce((sum, payment) => sum + (typeof payment.amount === 'number' ? (toCents(payment.amount) ?? 0) : 0), 0);
  const codes = mpesa.map((payment) => (payment.reference ? maskCode(String(payment.reference)) : '')).filter(Boolean);
  const receipt = response && typeof response === 'object' ? (response as { receiptNo?: unknown }).receiptNo : undefined;
  const number = typeof receipt === 'number' ? `Sale #${receipt}: ` : '';
  return entry(
    'typed_code',
    item,
    now,
    `${number}${whichSale(item)} was paid ${formatMoney(amount)} by M-Pesa with a code that was typed in${codes.length ? ` (${codes.join(', ')})` : ''}. Nobody has checked it. Look for it in the M-Pesa statement.`
  );
}

// ---------------------------------------------------------------------------------------------
// On the phone
// ---------------------------------------------------------------------------------------------

const listeners = new Set<() => void>();

/** Told whenever the log has been changed, so a screen that shows it can read it again. */
export function subscribeLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The shop's log. Never fails: a phone that cannot read it has none to show. */
export async function readLog(tenantId: string, now: number): Promise<LogEntry[]> {
  try {
    return parseLog(await readTenantValue('tillLog', tenantId), now);
  } catch {
    return [];
  }
}

const chains = new Map<string, Promise<void>>();

/**
 * Changes the shop's log. Changes are made one after another, so two that finish together never write over each other.
 * Never fails: a note that cannot be kept is not worth failing a sale for.
 */
export function changeLog(tenantId: string, change: (log: LogEntry[]) => LogEntry[], now: number): Promise<void> {
  const previous = chains.get(tenantId) ?? Promise.resolve();
  const next = previous.then(async () => {
    try {
      const current = await readLog(tenantId, now);
      await writeTenantValue('tillLog', encodeLog(change(current)), tenantId);
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch {
          // A screen that fails to refresh is not the log's problem.
        }
      }
    } catch {
      // Nothing to do: the log is a convenience for a manager, and the sale it is about is already dealt with.
    }
  });
  chains.set(tenantId, next);
  return next;
}

export function appendToLog(tenantId: string, item: LogEntry, now: number): Promise<void> {
  return changeLog(tenantId, (log) => addToLog(log, item, now), now);
}

/**
 * What the till writes down about a sale that has just reached the server after it was saved on the phone: a code
 * nobody checked, a total the server worked out differently, and a different person signed in than the one who rang it.
 */
export function entriesForSent(item: Queued, response: unknown, sender: { id: string; name: string }, now: number): LogEntry[] {
  return [typedCodeEntry(item, response, now), differenceEntry(item, response, now), sentByOtherEntry(item, sender, now)].filter(
    (entry): entry is LogEntry => entry !== null
  );
}

/** Writes `entriesForSent` in the shop's log. Never fails. */
export function recordSent(
  tenantId: string,
  item: Queued,
  response: unknown,
  sender: { id: string; name: string },
  now: number
): Promise<void> {
  const entries = entriesForSent(item, response, sender, now);
  if (entries.length === 0) return Promise.resolve();
  return changeLog(tenantId, (log) => entries.reduce((all, entry) => addToLog(all, entry, now), log), now);
}
