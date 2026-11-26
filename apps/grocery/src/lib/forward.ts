import { cleanDisplayText, isApiError, priceToCents, unitsToQty } from '@kiosk/core';
import { basketTotalCents, readKeptLine, MAX_BASKET_LINES, type Basket, type BasketLine } from './basket';

/**
 * Sending a sale to the cashier. The server takes it in two steps, and both can be asked again safely: the draft is
 * made under a name the phone chose (`clientDraftId`: asked for again under the same name, the server gives back the
 * same draft), and issuing it takes a key (`Idempotency-Key`, which returns the same invoice every time). Both are
 * written down on the phone before anything is sent, so a lost answer, a closed app or a dead signal can never make a
 * second invoice: the sale is simply asked for again under the same keys until an answer is seen.
 *
 * What the name does not do: a draft asked for under a NEW name is put into whatever draft the same person already has
 * open at that branch, and the server answers with that one. So before a sale is sent for the first time the phone looks
 * at what is open, clears what it left behind itself, and holds the sale back for anything else (see the sender).
 *
 * A sale waiting to be sent belongs to the person who made it. Another person signing in on the same phone does not
 * send it, because the invoice would be made in their name.
 */

export type ForwardProblem = {
  /** `refused`: the server said no. `conflict`: the sale was closed on the server. `unreadable`: it answered, but not in words the app knows. */
  kind: 'refused' | 'conflict' | 'unreadable';
  status: number;
  words: string;
};

export type ForwardResult = {
  draftId: string;
  invoiceId: string;
  counterNumber: number;
  /** The code on the invoice, which the cashier scans or types. */
  code: string | null;
  totalCents: number | null;
  status: string;
};

export type ForwardEntry = {
  /** The sale's name on the phone and at the server (`clientDraftId`). */
  id: string;
  /** The key issuing the draft is asked under. */
  issueKey: string;
  ownerId: string;
  branchId: string;
  createdAt: number;
  /** The `savedAt` of the basket this was made from, so that exact basket is never sent twice. */
  fromBasket: number;
  /** Empty once the sale is sent: the invoice is the record from then on. */
  lines: BasketLine[];
  itemCount: number;
  totalCents: number;
  draftId: string | null;
  sentAt: number | null;
  /** A request went out and no answer was seen: the server may have the sale. */
  inDoubt: boolean;
  problem: ForwardProblem | null;
  result: ForwardResult | null;
};

export type ForwardState = { entries: ForwardEntry[] };

export const NO_FORWARDS: ForwardState = { entries: [] };

/** Sales that are not sent yet, per phone. More than this and the phone has been offline too long to trust. */
export const MAX_UNSENT = 20;
export const KEEP_SENT = 30;
export const SENT_LIFETIME_MS = 24 * 60 * 60_000;
/** A sale waiting this long may carry old prices. It is shown with a warning, never dropped. */
export const STALE_AFTER_MS = 12 * 60 * 60_000;

export const DRAFTS_PATH = '/api/v1/grocery-drafts';

export function issuePath(draftId: string): string {
  return `${DRAFTS_PATH}/${encodeURIComponent(draftId)}/issue`;
}

/**
 * What a sale from this phone is called at the server. The server keeps one open draft for each person at each branch
 * and puts the lines of a new draft into it, whatever the new one is called. So a draft that is open has to be told
 * from one the web counter is using: the web names its drafts with a random id of its own, the phone's start with this.
 */
export const DRAFT_NAME_PREFIX = 'phone:';

export function draftName(id: string): string {
  return `${DRAFT_NAME_PREFIX}${id}`;
}

/** Whether a draft's name is one this app gave it. */
export function isPhoneDraftName(name: unknown): boolean {
  return typeof name === 'string' && name.length > DRAFT_NAME_PREFIX.length && name.startsWith(DRAFT_NAME_PREFIX);
}

/** How far back the server is asked for open drafts. Its own answer stops at two days, and a draft left open for longer still takes a new sale's lines into it. */
export const OPEN_DRAFT_HOURS = 24 * 365;
/** More open drafts than this is not something the phone sorts out. The server keeps one for each person and branch. */
export const MAX_OPEN_CHECKED = 3;
export const LEFT_OVER_REASON = 'Left over from a sale sent from a phone';

/** The drafts this person has open at a branch. */
export function openDraftsPath(branchId: string, ownerId: string): string {
  return `${DRAFTS_PATH}?branchId=${encodeURIComponent(branchId)}&status=building&createdBy=${encodeURIComponent(ownerId)}&hoursBack=${OPEN_DRAFT_HOURS}`;
}

export function draftPath(draftId: string): string {
  return `${DRAFTS_PATH}/${encodeURIComponent(draftId)}`;
}

export function cancelDraftPath(draftId: string): string {
  return `${draftPath(draftId)}/cancel`;
}

/** The draft as the server wants it. Prices go as shillings and quantities as units; the server rounds them as the phone did. */
export function draftBody(entry: ForwardEntry): {
  branchId: string;
  clientDraftId: string;
  lines: Array<{ itemId: string; quantity: number; unitPrice: number; unitName: string }>;
} {
  return {
    branchId: entry.branchId,
    clientDraftId: draftName(entry.id),
    lines: entry.lines.map((line) => ({
      itemId: line.itemId,
      quantity: unitsToQty(line.quantityUnits),
      unitPrice: line.unitCents / 100,
      unitName: line.unitName,
    })),
  };
}

export function issueBody(): Record<string, never> {
  return {};
}

// ---------------------------------------------------------------------------------------------
// What the server says
// ---------------------------------------------------------------------------------------------

export type DraftReply = { draftId: string; status: string };

/** The draft the server made or already had. Null when it is not a draft, or it is another sale's. */
export function readDraftReply(raw: unknown, clientDraftId: string): DraftReply | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.id !== 'string' || body.id === '') return null;
  if (typeof body.clientDraftId === 'string' && body.clientDraftId !== clientDraftId) return null;
  return { draftId: body.id, status: typeof body.status === 'string' ? body.status.toLowerCase() : '' };
}

/** A draft as the server has it: its id, the name it was made under, who made it, and where it stands. */
export type DraftName = { id: string; clientDraftId: string | null; status: string; createdBy: string | null };

export function readDraftName(raw: unknown): DraftName | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.id !== 'string' || body.id === '') return null;
  return {
    id: body.id,
    clientDraftId: typeof body.clientDraftId === 'string' && body.clientDraftId !== '' ? body.clientDraftId : null,
    status: typeof body.status === 'string' ? body.status.toLowerCase() : '',
    createdBy: typeof body.createdBy === 'string' && body.createdBy !== '' ? body.createdBy : null,
  };
}

/** Whether the server's answer is a draft made under another name: it put this sale's lines into a sale that was already open. */
export function isAnotherDraft(raw: unknown, name: string): boolean {
  const draft = readDraftName(raw);
  return !!draft && draft.clientDraftId !== null && draft.clientDraftId !== name;
}

/** The drafts that are open in the server's list, by id. Null when the answer is not a list of drafts. */
export function readOpenDrafts(raw: unknown): string[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const drafts = (raw as { drafts?: unknown }).drafts;
  if (!Array.isArray(drafts)) return null;
  const ids: string[] = [];
  for (const row of drafts) {
    if (!row || typeof row !== 'object') return null;
    const { id, status } = row as Record<string, unknown>;
    if (typeof id !== 'string' || id === '') return null;
    if (typeof status === 'string' && status.toLowerCase() !== 'building') continue;
    ids.push(id);
  }
  return ids;
}

/** The invoice the server made or already had for a draft. Null when it is not one, or it is another draft's. */
export function readIssueReply(raw: unknown, draftId: string): ForwardResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.draftId === 'string' && body.draftId !== draftId) return null;
  if (typeof body.invoiceId !== 'string' || body.invoiceId === '') return null;
  const counter = body.counterNumber;
  if (typeof counter !== 'number' || !Number.isInteger(counter) || counter < 0) return null;
  const invoice = body.invoice && typeof body.invoice === 'object' ? (body.invoice as Record<string, unknown>) : null;
  return {
    draftId,
    invoiceId: body.invoiceId,
    counterNumber: counter,
    code: invoice ? cleanDisplayText(invoice.barcodeCode, 40) || null : null,
    totalCents: invoice ? priceToCents(invoice.grandTotal) : null,
    status: invoice && typeof invoice.status === 'string' ? invoice.status.toLowerCase() : typeof body.status === 'string' ? body.status.toLowerCase() : '',
  };
}

export type ForwardFailure = { kind: 'wait' } | { kind: 'problem'; problem: ForwardProblem };

/** Which of the two requests failed: making the draft, or issuing it. */
export type ForwardStep = 'draft' | 'issue';

/**
 * What a failed call about a draft that is already open means: `wait` when no answer came, `gone` when the draft is no
 * longer there or no longer open (nothing is left to clear), `no` for anything else.
 */
export function classifyOpenDraftError(error: unknown): 'wait' | 'gone' | 'no' {
  if (classifyForwardError(error, 'draft').kind === 'wait') return 'wait';
  return isApiError(error) && (error.status === 404 || error.status === 423) ? 'gone' : 'no';
}

/**
 * What a failed request means. No answer, a session that ended, a busy server, a shop that is switched off for now, or a
 * web page where the server's answer should be (a hotel's sign-in page): try again later and say nothing is wrong. A 409
 * or a 423 from the draft means it was closed or changed on the server, and asking again will not change that. Any other
 * refusal is a person's to read. The status and the problem's name are read, never the English.
 */
export function classifyForwardError(error: unknown, step: ForwardStep = 'issue'): ForwardFailure {
  if (!isApiError(error)) return { kind: 'wait' };
  const { status } = error;
  if (error.foreign) return { kind: 'wait' };
  if (status === 423 && error.type?.includes('tenant-not-active')) return { kind: 'wait' };
  // Not found, for the draft, is the shop's switch for drafts being off; for the invoice, a draft that is no longer there.
  if (status === 404) return { kind: 'problem', problem: step === 'draft' ? DRAFTS_OFF : DRAFT_GONE };
  if (status === 409 || status === 423) {
    return {
      kind: 'problem',
      problem: {
        kind: 'conflict',
        status,
        words: 'This sale was closed or changed on the server. Look in Invoices before sending it again.',
      },
    };
  }
  if (status === 401 || status === 408 || status === 429 || status >= 500) return { kind: 'wait' };
  if (status >= 400) {
    return {
      kind: 'problem',
      problem: { kind: 'refused', status, words: cleanDisplayText(error.hint || error.message, 140) || 'The server did not accept this sale.' },
    };
  }
  return { kind: 'wait' };
}

export const UNREADABLE: ForwardProblem = {
  kind: 'unreadable',
  status: 200,
  words: 'The server answered in a way this app could not read. Look in Invoices before sending it again.',
};

export const DRAFT_CLOSED: ForwardProblem = {
  kind: 'conflict',
  status: 200,
  words: 'This sale was cancelled on the server. Look in Invoices before sending it again.',
};

/** A sale is open at the counter that this phone did not make, or cannot clear: sending would mix the two. Nothing was sent. */
export const OPEN_ELSEWHERE: ForwardProblem = {
  kind: 'refused',
  status: 200,
  words: 'Another sale is already open for you at this counter. Finish or cancel it first (on the web counter, if that is where it was started), then send this one again.',
};

/** The server put this sale into one that was already open. Its lines are in that sale now, and this one was not sent. */
export const MIXED_IN: ForwardProblem = {
  kind: 'conflict',
  status: 200,
  words: 'The shop added this sale to another one that was already open at this counter. Look at that open sale before sending this again.',
};

/** The server answers "not found" to every draft while the shop has not switched drafts on. */
export const DRAFTS_OFF: ForwardProblem = {
  kind: 'refused',
  status: 404,
  words: 'This shop has not switched on sending sales to the cashier from a phone. Ask the owner to turn it on, then send this again.',
};

export const DRAFT_GONE: ForwardProblem = {
  kind: 'conflict',
  status: 404,
  words: 'The server no longer has this sale. Look in Invoices before sending it again.',
};

// ---------------------------------------------------------------------------------------------
// The queue
// ---------------------------------------------------------------------------------------------

export function basketAlreadySent(state: ForwardState, basket: Basket): boolean {
  return state.entries.some((entry) => entry.ownerId === basket.ownerId && entry.branchId === basket.branchId && entry.fromBasket === basket.savedAt);
}

function unsentCount(state: ForwardState): number {
  return state.entries.filter((entry) => !entry.result).length;
}

export type StartProblem = 'empty' | 'zero_total' | 'full' | 'already_sent';

export const startProblemWords: Record<StartProblem, string> = {
  empty: 'The basket is empty.',
  zero_total: 'This sale comes to nothing. Check the quantities.',
  full: `${MAX_UNSENT} sales are waiting to be sent from this phone. Get a signal and let them go first.`,
  already_sent: 'This sale has already been sent.',
};

/** Moves a basket into the queue, under keys chosen now and kept. The caller clears the basket afterwards. */
export function startForward(
  state: ForwardState,
  basket: Basket,
  ids: { id: string; issueKey: string },
  now: number
): { ok: true; state: ForwardState; entry: ForwardEntry } | { ok: false; why: StartProblem } {
  if (basket.lines.length === 0) return { ok: false, why: 'empty' };
  if (basketAlreadySent(state, basket)) return { ok: false, why: 'already_sent' };
  const totalCents = basketTotalCents(basket);
  if (totalCents <= 0) return { ok: false, why: 'zero_total' };
  if (unsentCount(state) >= MAX_UNSENT) return { ok: false, why: 'full' };
  const entry: ForwardEntry = {
    id: ids.id,
    issueKey: ids.issueKey,
    ownerId: basket.ownerId,
    branchId: basket.branchId,
    createdAt: now,
    fromBasket: basket.savedAt,
    lines: basket.lines.map((line) => ({ ...line })),
    itemCount: basket.lines.length,
    totalCents,
    draftId: null,
    sentAt: null,
    inDoubt: false,
    problem: null,
    result: null,
  };
  return { ok: true, state: { entries: [...state.entries, entry] }, entry };
}

/** The state with one sale edited. The very same state comes back when there is no such sale or the edit changed nothing. */
function change(state: ForwardState, id: string, edit: (entry: ForwardEntry) => ForwardEntry): ForwardState {
  let changed = false;
  const entries = state.entries.map((entry) => {
    if (entry.id !== id) return entry;
    const next = edit(entry);
    if (next !== entry) changed = true;
    return next;
  });
  return changed ? { entries } : state;
}

/** Written down before a request goes out: from here until an answer is seen, the server may have the sale. */
export function beginStep(state: ForwardState, id: string, now: number): ForwardState {
  return change(state, id, (entry) => (entry.result ? entry : { ...entry, sentAt: now, inDoubt: true }));
}

export function afterDraft(state: ForwardState, id: string, draftId: string): ForwardState {
  return change(state, id, (entry) => (entry.result ? entry : { ...entry, draftId, inDoubt: false }));
}

export function afterIssued(state: ForwardState, id: string, result: ForwardResult, now: number): ForwardState {
  return change(state, id, (entry) => ({ ...entry, draftId: result.draftId, result, lines: [], inDoubt: false, problem: null, sentAt: now }));
}

/** The server answered no (or something unreadable). `stillInDoubt` keeps the sale marked when its fate is not known. */
export function afterRefused(state: ForwardState, id: string, problem: ForwardProblem, stillInDoubt = false): ForwardState {
  return change(state, id, (entry) => (entry.result ? entry : { ...entry, problem, inDoubt: stillInDoubt }));
}

export type Words = 'sent' | 'refused' | 'in_doubt' | 'stale' | 'waiting';

export function isStale(entry: ForwardEntry, now: number): boolean {
  return !entry.result && now - entry.createdAt > STALE_AFTER_MS;
}

export function forwardWords(entry: ForwardEntry, now: number): Words {
  if (entry.result) return 'sent';
  if (entry.problem) return 'refused';
  if (entry.inDoubt) return 'in_doubt';
  return isStale(entry, now) ? 'stale' : 'waiting';
}

export function forwardsOf(state: ForwardState, ownerId: string): ForwardEntry[] {
  return state.entries.filter((entry) => entry.ownerId === ownerId);
}

/** Sales this person has that are not sent yet, whether waiting or refused. */
export function unsentFor(state: ForwardState, ownerId: string): number {
  return state.entries.filter((entry) => entry.ownerId === ownerId && !entry.result).length;
}

/** Sales left on this phone by other people, still waiting for them to sign in. */
export function leftByOthers(state: ForwardState, ownerId: string): number {
  return state.entries.filter((entry) => entry.ownerId !== ownerId && !entry.result).length;
}

/** The next sale this person's phone should send: the oldest of theirs that nothing has stopped. */
export function nextToSend(state: ForwardState, ownerId: string): ForwardEntry | null {
  return state.entries.find((entry) => entry.ownerId === ownerId && !entry.result && !entry.problem) ?? null;
}

export type ChangeProblem = 'other_branch' | 'basket_in_use';

export const changeProblemWords: Record<ChangeProblem, string> = {
  other_branch: 'This sale was made at another branch. Sign in there to change it.',
  basket_in_use: 'The basket has items in it. Send or clear it first, then change this sale.',
};

/**
 * Why a refused sale cannot be turned back into the basket here and now, or null when it can. A basket belongs to one
 * person at one branch, so a sale from another branch would be let go with the basket it was put in, and its items lost.
 */
export function changeProblem(entry: Pick<ForwardEntry, 'branchId'>, here: { branchId: string }, basketLines: number): ChangeProblem | null {
  if (entry.branchId !== here.branchId) return 'other_branch';
  return basketLines > 0 ? 'basket_in_use' : null;
}

/** Sends a refused sale again as a new one, under new keys. Not for one whose fate is unknown. */
export function retryAsNew(
  state: ForwardState,
  id: string,
  ids: { id: string; issueKey: string },
  now: number
): { ok: true; state: ForwardState } | { ok: false; why: 'no_entry' | 'in_doubt' | 'not_refused' | 'id_taken' } {
  const entry = state.entries.find((candidate) => candidate.id === id);
  if (!entry) return { ok: false, why: 'no_entry' };
  if (!entry.problem || entry.result) return { ok: false, why: 'not_refused' };
  if (entry.inDoubt) return { ok: false, why: 'in_doubt' };
  if (state.entries.some((other) => other.id === ids.id)) return { ok: false, why: 'id_taken' };
  const fresh: ForwardEntry = { ...entry, id: ids.id, issueKey: ids.issueKey, createdAt: now, draftId: null, sentAt: null, inDoubt: false, problem: null };
  return { ok: true, state: { entries: state.entries.map((candidate) => (candidate.id === id ? fresh : candidate)) } };
}

/** The sale's lines as a basket again, for a sale the server refused and the person wants to change. */
export function basketFrom(entry: ForwardEntry, now: number): Basket {
  return { ownerId: entry.ownerId, branchId: entry.branchId, savedAt: now, lines: entry.lines.map((line) => ({ ...line })) };
}

/**
 * Removes a sale from the list. One whose fate is unknown may already be at the till, so it needs `sure`: the person
 * has been told to look in Invoices first.
 */
export function discardForward(
  state: ForwardState,
  id: string,
  options: { sure?: boolean } = {}
): { ok: true; state: ForwardState } | { ok: false; why: 'no_entry' | 'in_doubt' } {
  const entry = state.entries.find((candidate) => candidate.id === id);
  if (!entry) return { ok: false, why: 'no_entry' };
  if (entry.inDoubt && !entry.result && !options.sure) return { ok: false, why: 'in_doubt' };
  return { ok: true, state: { entries: state.entries.filter((candidate) => candidate.id !== id) } };
}

/** Lets old sent sales go: those older than a day, and all but the newest few. Nothing unsent is ever dropped. */
export function prune(state: ForwardState, now: number): ForwardState {
  const sent = state.entries.filter((entry) => entry.result);
  const fresh = sent.filter((entry) => now - (entry.sentAt ?? entry.createdAt) <= SENT_LIFETIME_MS);
  const keep = new Set(fresh.slice(-KEEP_SENT).map((entry) => entry.id));
  const entries = state.entries.filter((entry) => !entry.result || keep.has(entry.id));
  return entries.length === state.entries.length ? state : { entries };
}

// ---------------------------------------------------------------------------------------------
// Kept on the phone
// ---------------------------------------------------------------------------------------------

export function encodeForwards(state: ForwardState): string | null {
  return state.entries.length === 0 ? null : JSON.stringify({ v: 1, entries: state.entries });
}

function isText(value: unknown, max = 200): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function isCount(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}

function readResult(raw: unknown): ForwardResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isText(r.draftId) || !isText(r.invoiceId) || !isCount(r.counterNumber) || typeof r.status !== 'string') return null;
  if (r.code !== null && typeof r.code !== 'string') return null;
  if (r.totalCents !== null && !isCount(r.totalCents)) return null;
  return { draftId: r.draftId, invoiceId: r.invoiceId, counterNumber: r.counterNumber, code: r.code as string | null, totalCents: r.totalCents as number | null, status: r.status };
}

function readProblem(raw: unknown): ForwardProblem | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if ((p.kind !== 'refused' && p.kind !== 'conflict' && p.kind !== 'unreadable') || !isCount(p.status) || typeof p.words !== 'string') return null;
  return { kind: p.kind, status: p.status, words: p.words.slice(0, 200) };
}

function readEntry(raw: unknown): ForwardEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (!isText(e.id) || !isText(e.issueKey) || !isText(e.ownerId) || !isText(e.branchId)) return null;
  if (typeof e.createdAt !== 'number' || typeof e.fromBasket !== 'number') return null;
  if (!Array.isArray(e.lines) || e.lines.length > MAX_BASKET_LINES) return null;
  const lines: BasketLine[] = [];
  for (const row of e.lines) {
    const line = readKeptLine(row);
    if (!line) return null;
    lines.push(line);
  }
  if (!isCount(e.itemCount, MAX_BASKET_LINES) || !isCount(e.totalCents)) return null;
  if (e.draftId !== null && !isText(e.draftId)) return null;
  if (e.sentAt !== null && typeof e.sentAt !== 'number') return null;
  if (typeof e.inDoubt !== 'boolean') return null;
  const problem = e.problem === null ? null : readProblem(e.problem);
  if (e.problem !== null && !problem) return null;
  const result = e.result === null ? null : readResult(e.result);
  if (e.result !== null && !result) return null;
  // A sale that is not sent must still carry its lines, or there is nothing left to send.
  if (!result && lines.length === 0) return null;
  return {
    id: e.id,
    issueKey: e.issueKey,
    ownerId: e.ownerId,
    branchId: e.branchId,
    createdAt: e.createdAt,
    fromBasket: e.fromBasket,
    lines,
    itemCount: e.itemCount,
    totalCents: e.totalCents,
    draftId: e.draftId as string | null,
    sentAt: e.sentAt as number | null,
    inDoubt: e.inDoubt,
    problem,
    result,
  };
}

/**
 * The queue kept on the phone. Null when there is none or it is not ours. A sale that cannot be read is left out and the
 * rest are kept: one bad sale must not take the others with it.
 */
export function decodeForwards(text: string | null, now: number): ForwardState | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (body.v !== 1 || !Array.isArray(body.entries)) return null;
  const entries: ForwardEntry[] = [];
  const seen = new Set<string>();
  for (const row of body.entries) {
    const entry = readEntry(row);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    entries.push(entry);
  }
  return prune({ entries }, now);
}
