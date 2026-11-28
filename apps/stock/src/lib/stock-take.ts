import { cleanDisplayText, qtyToUnits } from '@kiosk/core';
import { readDate as dateOf } from './dates';

/**
 * A stock take as the phone holds it: what the server last said, plus the counts typed on this phone that the server
 * has not taken yet. The server's session is the truth about what has been counted; the phone adds what is waiting to
 * be sent, and never mistakes the one for the other. A count typed with no signal is kept, shown as "not sent", and
 * sent when the line is back.
 */

export type LineState = 'pending' | 'submitted' | 'confirmed';

export type TakeLine = {
  id: string;
  itemId: string;
  name: string;
  sku: string | null;
  aisle: string | null;
  /** What the system says is on the shelf, in ten-thousandths. Null when the server hides it from this person (a blind count). */
  systemUnits: number | null;
  /** What the server holds as counted. Null when nothing is counted yet. */
  countedUnits: number | null;
  state: LineState;
};

export type StockTake = {
  id: string;
  branchId: string;
  kind: string;
  /** yyyy-mm-dd. */
  date: string;
  name: string;
  /** False once it has been closed. Counts for a closed one are refused. */
  open: boolean;
  lines: TakeLine[];
};

const MAX_ID_LENGTH = 64;

/**
 * An id from the server, or '' when it is not one. A name every object already has (`constructor`, `__proto__`,
 * `toString`) is not an id: ids are used as keys, and a key like that reads back as something that was never put there.
 */
function idOf(value: unknown): string {
  if (typeof value !== 'string') return '';
  const id = value.trim();
  return id.length > 0 && id.length <= MAX_ID_LENGTH && !(id in Object.prototype) ? id : '';
}

function lineState(value: unknown): LineState {
  return value === 'confirmed' ? 'confirmed' : value === 'submitted' ? 'submitted' : 'pending';
}

function readLine(raw: unknown): TakeLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = idOf(row.id);
  const itemId = idOf(row.itemId);
  const name = cleanDisplayText(row.itemName, 120);
  if (!id || !itemId || !name) return null;
  const state = lineState(row.status);
  const counted = state === 'pending' ? null : (qtyToUnits(row.countedQty) ?? qtyToUnits(row.adminQuantity));
  return {
    id,
    itemId,
    name,
    sku: cleanDisplayText(row.itemSku, 64) || null,
    aisle: cleanDisplayText(row.aisle, 40) || null,
    systemUnits: qtyToUnits(row.systemQtySnapshot),
    countedUnits: counted,
    state,
  };
}

/** A session answer (`StockTakeSessionResponse`). Null when it is not one: a failed read, not an empty stock take. */
export function readTake(raw: unknown): StockTake | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const id = idOf(body.id);
  const branchId = idOf(body.branchId);
  if (!id || !branchId || !Array.isArray(body.lines)) return null;
  const lines: TakeLine[] = [];
  for (const row of body.lines) {
    const line = readLine(row);
    if (line) lines.push(line);
  }
  return {
    id,
    branchId,
    kind: cleanDisplayText(body.sessionType, 20) || 'morning',
    date: dateOf(body.sessionDate),
    name: cleanDisplayText(body.name, 80),
    open: body.status === 'in_progress',
    lines,
  };
}

export type ActiveTake = {
  take: StockTake | null;
  /** An unfinished stock take from an earlier day, when there is no open one today. */
  stale: { id: string; date: string } | null;
};

/** `GET .../sessions/active`. Null when the answer is not that, which must not be read as "there is none". */
export function readActive(raw: unknown): ActiveTake | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (!('session' in body)) return null;
  let take: StockTake | null = null;
  if (body.session !== null && body.session !== undefined) {
    take = readTake(body.session);
    if (!take) return null;
  }
  const staleId = idOf(body.staleSessionId);
  const stale = !take && body.hasStaleSession === true && staleId ? { id: staleId, date: dateOf(body.staleSessionDate) } : null;
  return { take, stale };
}

/** What to do when the person opens Stock take, given what the server says is open. */
export type StartDecision = 'continue' | 'offer_stale' | 'start';

export function decideStart(active: ActiveTake): StartDecision {
  if (active.take) return 'continue';
  if (active.stale) return 'offer_stale';
  return 'start';
}

// ---------------------------------------------------------------------------------------------
// Counts typed on this phone
// ---------------------------------------------------------------------------------------------

/** Why a count was not taken. `conflict` is a 409 that has not been explained yet; a fresh read turns it into `closed` or `locked`. */
export type CountProblem = 'conflict' | 'locked' | 'closed' | 'refused';

export type Pending = {
  units: number;
  typedAt: number;
  problem: CountProblem | null;
};

export type TakeCopy = {
  take: StockTake;
  savedAt: number;
  /** Counts the server has not taken, by line id. */
  pending: Readonly<Record<string, Pending>>;
  /** Some lines were not kept on the phone because there were too many. The counts typed are always kept. */
  truncated: boolean;
  /** The signed-in person the counts waiting in this copy belong to. Empty when nobody has claimed it yet (and for a copy kept before owners were recorded). */
  ownerId: string;
};

export function newCopy(take: StockTake, now: number): TakeCopy {
  return { take, savedAt: now, pending: {}, truncated: false, ownerId: '' };
}

/** Why the counts waiting in a copy are not the signed-in person's to send from here. */
export type HeldBy = 'branch' | 'person';

/**
 * Whether the counts waiting in a copy are held back from this person at this branch. A count is sent with whoever is
 * signed in, and the server records it as theirs: so counts typed for another branch, or by another person, are never
 * sent from here. Null when they are this person's to send, and when nothing is waiting.
 */
export function heldBy(copy: TakeCopy | null, branchId: string, userId: string): HeldBy | null {
  if (!copy || Object.keys(copy.pending).length === 0) return null;
  if (copy.take.branchId !== branchId) return 'branch';
  return copy.ownerId !== '' && copy.ownerId !== userId ? 'person' : null;
}

/** The copy as `userId` takes it over: one with nothing waiting in it, or that nobody has claimed, becomes theirs; one holding another person's counts is left alone. */
export function claim(copy: TakeCopy, userId: string): TakeCopy {
  if (copy.ownerId === userId) return copy;
  if (copy.ownerId !== '' && Object.keys(copy.pending).length > 0) return copy;
  return { ...copy, ownerId: userId };
}

function lineById(copy: TakeCopy, lineId: string): TakeLine | undefined {
  return copy.take.lines.find((line) => line.id === lineId);
}

/**
 * Takes a fresh read of the session into the copy. What the server says about lines replaces what the phone had;
 * the counts typed here that it has not taken stay, and are marked when the fresh read shows they cannot be taken (the
 * stock take was closed, or a manager confirmed the line). A different session replaces the copy, and the counts that
 * were waiting for the old one are dropped, because a closed stock take cannot take them: `discarded` says how many.
 */
export function mergeFresh(copy: TakeCopy | null, fresh: StockTake, now: number): { copy: TakeCopy; discarded: number } {
  if (!copy || copy.take.id !== fresh.id) {
    return { copy: newCopy(fresh, now), discarded: copy ? Object.keys(copy.pending).length : 0 };
  }
  const pending: Record<string, Pending> = {};
  for (const [lineId, entry] of Object.entries(copy.pending)) {
    const line = fresh.lines.find((candidate) => candidate.id === lineId);
    if (!line) continue;
    let problem = entry.problem;
    if (!fresh.open) problem = 'closed';
    else if (line.state === 'confirmed') problem = 'locked';
    else if (problem === 'conflict' || problem === 'closed' || problem === 'locked') problem = null;
    pending[lineId] = { ...entry, problem };
  }
  return { copy: { take: fresh, savedAt: now, pending, truncated: copy.truncated, ownerId: copy.ownerId }, discarded: Object.keys(copy.pending).length - Object.keys(pending).length };
}

export type TypeResult = { ok: true; copy: TakeCopy } | { ok: false; why: 'no_line' | 'locked' | 'closed' };

/** A count typed for a line. It replaces an earlier count typed for the same line. Refused for a line a manager has confirmed, and once the stock take is closed. */
export function typeCount(copy: TakeCopy, lineId: string, units: number, now: number): TypeResult {
  const line = lineById(copy, lineId);
  if (!line) return { ok: false, why: 'no_line' };
  if (!copy.take.open) return { ok: false, why: 'closed' };
  if (line.state === 'confirmed') return { ok: false, why: 'locked' };
  const waiting = copy.pending[lineId];
  if (!waiting && line.state !== 'pending' && line.countedUnits === units) return { ok: true, copy };
  return { ok: true, copy: { ...copy, pending: { ...copy.pending, [lineId]: { units, typedAt: now, problem: null } } } };
}

/** The server took a count. It stops waiting, unless a newer count was typed for the line while this one was on its way. */
export function afterSent(copy: TakeCopy, lineId: string, sentUnits: number): TakeCopy {
  const line = lineById(copy, lineId);
  const waiting = copy.pending[lineId];
  if (!line || !waiting || waiting.units !== sentUnits) return copy;
  const { [lineId]: _taken, ...rest } = copy.pending;
  const lines = copy.take.lines.map((candidate) =>
    candidate.id === lineId ? { ...candidate, countedUnits: sentUnits, state: candidate.state === 'pending' ? ('submitted' as const) : candidate.state } : candidate
  );
  return { ...copy, take: { ...copy.take, lines }, pending: rest };
}

/** The server did not take a count. A newer count typed for the line is not marked: it has not been tried. */
export function afterRefused(copy: TakeCopy, lineId: string, sentUnits: number, problem: CountProblem): TakeCopy {
  const waiting = copy.pending[lineId];
  if (!waiting || waiting.units !== sentUnits || waiting.problem === problem) return copy;
  return { ...copy, pending: { ...copy.pending, [lineId]: { ...waiting, problem } } };
}

/** The person asked to try the counts that were refused again. */
export function retryRefused(copy: TakeCopy): TakeCopy {
  const entries = Object.entries(copy.pending);
  if (!entries.some(([, entry]) => entry.problem !== null)) return copy;
  return { ...copy, pending: Object.fromEntries(entries.map(([lineId, entry]) => [lineId, { ...entry, problem: null }])) };
}

/** The person gave up on a count (one line) or on all of them that were refused. */
export function discardPending(copy: TakeCopy, lineId?: string): TakeCopy {
  const entries = Object.entries(copy.pending).filter(([id, entry]) => (lineId === undefined ? entry.problem === null : id !== lineId));
  return entries.length === Object.keys(copy.pending).length ? copy : { ...copy, pending: Object.fromEntries(entries) };
}

// ---------------------------------------------------------------------------------------------
// What the screen shows
// ---------------------------------------------------------------------------------------------

export type Row = {
  line: TakeLine;
  /** What to show as counted: the count typed here if there is one, else the server's. Null when nothing is counted. */
  units: number | null;
  unsent: boolean;
  problem: CountProblem | null;
  /** Counted minus the system's quantity. Null when either is unknown (a blind count), so a count is never shown as "all missing". */
  difference: number | null;
  kind: 'todo' | 'counted' | 'confirmed';
};

export function rowFor(copy: TakeCopy, line: TakeLine): Row {
  const waiting = copy.pending[line.id];
  const units = waiting ? waiting.units : line.countedUnits;
  const kind = line.state === 'confirmed' ? 'confirmed' : units === null ? 'todo' : 'counted';
  return {
    line,
    units,
    unsent: waiting !== undefined,
    problem: waiting ? waiting.problem : null,
    difference: units !== null && line.systemUnits !== null ? units - line.systemUnits : null,
    kind,
  };
}

export function rowsOf(copy: TakeCopy): Row[] {
  return copy.take.lines.map((line) => rowFor(copy, line));
}

export type Progress = { total: number; counted: number; confirmed: number; todo: number; unsent: number; refused: number };

export function progressOf(copy: TakeCopy): Progress {
  const rows = rowsOf(copy);
  return {
    total: rows.length,
    counted: rows.filter((row) => row.kind !== 'todo').length,
    confirmed: rows.filter((row) => row.kind === 'confirmed').length,
    todo: rows.filter((row) => row.kind === 'todo').length,
    unsent: rows.filter((row) => row.unsent && row.problem === null).length,
    refused: rows.filter((row) => row.problem !== null).length,
  };
}

export type RowFilter = 'todo' | 'counted' | 'different' | 'unsent' | 'all';

/** Rows by what was typed in the search box (name, SKU or aisle, any case) and the filter chosen. */
export function filterRows(rows: readonly Row[], options: { text?: string; only?: RowFilter }): Row[] {
  const words = (options.text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const only = options.only ?? 'all';
  return rows.filter((row) => {
    if (only === 'todo' && row.kind !== 'todo') return false;
    if (only === 'counted' && row.kind === 'todo') return false;
    if (only === 'different' && !(row.difference !== null && row.difference !== 0)) return false;
    if (only === 'unsent' && !row.unsent) return false;
    if (words.length === 0) return true;
    const haystack = `${row.line.name} ${row.line.sku ?? ''} ${row.line.aisle ?? ''}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** The line for an item the camera or a search found. */
export function lineForItem(copy: TakeCopy, itemId: string): TakeLine | null {
  return copy.take.lines.find((line) => line.itemId === itemId) ?? null;
}

/** Whether the screen may offer to close: only the person who may, once nothing is waiting to be sent. */
export function closeBlockedBy(copy: TakeCopy, mayClose: boolean): 'not_allowed' | 'not_open' | 'unsent' | null {
  if (!mayClose) return 'not_allowed';
  if (!copy.take.open) return 'not_open';
  return Object.keys(copy.pending).length > 0 ? 'unsent' : null;
}

// ---------------------------------------------------------------------------------------------
// Kept on the phone
// ---------------------------------------------------------------------------------------------

/** The most lines kept on the phone: the stored text must stay small enough for the phone's own storage to read back. */
export const MAX_STORED_LINES = 6000;
/** A copy untouched for this long is not offered again: it is no longer today's stock take. */
export const COPY_LIFETIME_MS = 3 * 24 * 60 * 60_000;

const STATE_CODE: Record<LineState, number> = { pending: 0, submitted: 1, confirmed: 2 };
const STATE_FROM = ['pending', 'submitted', 'confirmed'] as const;
const PROBLEM_CODE: Record<CountProblem, number> = { conflict: 1, locked: 2, closed: 3, refused: 4 };
const PROBLEM_FROM: Array<CountProblem | null> = [null, 'conflict', 'locked', 'closed', 'refused'];

/** The text to keep. Lines with a count waiting are always kept; the rest up to the limit. */
export function encodeCopy(copy: TakeCopy | null): string | null {
  if (!copy) return null;
  const lines = copy.take.lines;
  const waiting = lines.filter((line) => copy.pending[line.id]);
  const others = lines.filter((line) => !copy.pending[line.id]);
  const room = Math.max(0, MAX_STORED_LINES - waiting.length);
  const kept = new Set([...waiting, ...others.slice(0, room)].map((line) => line.id));
  const stored = lines.filter((line) => kept.has(line.id));
  return JSON.stringify({
    v: 1,
    id: copy.take.id,
    b: copy.take.branchId,
    k: copy.take.kind,
    d: copy.take.date,
    n: copy.take.name,
    o: copy.take.open ? 1 : 0,
    t: copy.savedAt,
    x: copy.truncated || stored.length < lines.length ? 1 : 0,
    u: copy.ownerId,
    l: stored.map((line) => [line.id, line.itemId, line.name, line.sku, line.aisle, line.systemUnits, line.countedUnits, STATE_CODE[line.state]]),
    p: Object.entries(copy.pending).map(([lineId, entry]) => [lineId, entry.units, entry.typedAt, entry.problem ? PROBLEM_CODE[entry.problem] : 0]),
  });
}

function isText(value: unknown): value is string {
  return typeof value === 'string';
}
function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
function isNullableInt(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value));
}

/** The copy kept on the phone. Null when there is none, when it is unreadable, or when it has gone stale with nothing waiting in it. */
export function decodeCopy(text: string | null, now: number): TakeCopy | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (body.v !== 1 || !isText(body.id) || !isText(body.b) || !isText(body.k) || !isText(body.d) || !isText(body.n) || typeof body.t !== 'number') return null;
  if (!Array.isArray(body.l) || !Array.isArray(body.p)) return null;
  // Who it belongs to is absent from a copy kept before owners were recorded; present, it must be text.
  if (body.u !== undefined && !isText(body.u)) return null;
  const lines: TakeLine[] = [];
  for (const row of body.l) {
    if (!Array.isArray(row) || row.length !== 8) return null;
    const [id, itemId, name, sku, aisle, system, counted, code] = row as unknown[];
    if (!isText(id) || id in Object.prototype || !isText(itemId) || !isText(name) || !isNullableText(sku) || !isNullableText(aisle) || !isNullableInt(system) || !isNullableInt(counted)) return null;
    if (typeof code !== 'number' || !STATE_FROM[code]) return null;
    lines.push({ id, itemId, name, sku, aisle, systemUnits: system, countedUnits: counted, state: STATE_FROM[code] });
  }
  const pending: Record<string, Pending> = {};
  for (const row of body.p) {
    if (!Array.isArray(row) || row.length !== 4) return null;
    const [lineId, units, typedAt, code] = row as unknown[];
    if (!isText(lineId) || lineId in Object.prototype || typeof units !== 'number' || !Number.isInteger(units) || units < 0 || typeof typedAt !== 'number' || typeof code !== 'number') return null;
    if (code !== 0 && !PROBLEM_FROM[code]) return null;
    pending[lineId] = { units, typedAt, problem: PROBLEM_FROM[code] ?? null };
  }
  const waiting = Object.keys(pending).length > 0;
  // Counts that were typed are never thrown away by the clock; a stock take nobody waits on any more is.
  if (!waiting && now - body.t > COPY_LIFETIME_MS) return null;
  return {
    take: { id: body.id, branchId: body.b, kind: body.k, date: body.d, name: body.n, open: body.o === 1, lines },
    savedAt: body.t,
    pending,
    truncated: body.x === 1,
    ownerId: isText(body.u) ? body.u : '',
  };
}
