import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import { addItem, emptyBasket, type Basket, type SaleItem } from '../src/lib/basket';
import {
  afterDraft,
  afterIssued,
  afterRefused,
  basketAlreadySent,
  basketFrom,
  beginStep,
  cancelDraftPath,
  changeProblem,
  changeProblemWords,
  classifyForwardError,
  classifyOpenDraftError,
  decodeForwards,
  discardForward,
  DRAFT_GONE,
  DRAFT_NAME_PREFIX,
  draftBody,
  draftName,
  draftPath,
  DRAFTS_OFF,
  encodeForwards,
  forwardWords,
  forwardsOf,
  isAnotherDraft,
  isPhoneDraftName,
  isStale,
  issuePath,
  KEEP_SENT,
  leftByOthers,
  LEFT_OVER_REASON,
  MAX_OPEN_CHECKED,
  MAX_UNSENT,
  MIXED_IN,
  nextToSend,
  NO_FORWARDS,
  OPEN_DRAFT_HOURS,
  OPEN_ELSEWHERE,
  openDraftsPath,
  prune,
  readDraftName,
  readDraftReply,
  readIssueReply,
  readOpenDrafts,
  retryAsNew,
  SENT_LIFETIME_MS,
  STALE_AFTER_MS,
  startForward,
  unsentFor,
  type ForwardResult,
  type ForwardState,
} from '../src/lib/forward';

const ONE = 10_000;
const OWNER = { ownerId: 'u1', branchId: 'b1' };
const SUGAR: SaleItem = { id: 'i1', name: 'Sugar', variantName: null, weighed: false, unitType: null, active: true, sellable: true, sellingCents: 19900 };
const FLOUR: SaleItem = { id: 'i2', name: 'Flour', variantName: null, weighed: true, unitType: 'kg', active: true, sellable: true, sellingCents: 12050 };

function basketOf(savedAt = 1000, owner = OWNER): Basket {
  const first = addItem(emptyBasket(owner, savedAt), SUGAR, 2 * ONE, savedAt, 'L1');
  assert.ok(first.ok);
  const second = addItem(first.basket, FLOUR, 15_000, savedAt, 'L2');
  assert.ok(second.ok);
  return second.basket;
}

function started(state: ForwardState, n: number, owner = OWNER, savedAt = 1000 + n): ForwardState {
  const result = startForward(state, basketOf(savedAt, owner), { id: `s${n}`, issueKey: `k${n}` }, 5000 + n);
  assert.ok(result.ok, JSON.stringify(result));
  return result.state;
}

const RESULT: ForwardResult = { draftId: 'd1', invoiceId: 'inv1', counterNumber: 42, code: '123456789012', totalCents: 57875, status: 'pending_payment' };

test('a basket moves into the queue under keys chosen now, with the total the phone worked out', () => {
  const result = startForward(NO_FORWARDS, basketOf(), { id: 's1', issueKey: 'k1' }, 5000);
  assert.ok(result.ok);
  const entry = result.entry;
  assert.deepEqual(result.state.entries, [entry]);
  assert.equal(entry.id, 's1');
  assert.equal(entry.issueKey, 'k1');
  assert.equal(entry.ownerId, 'u1');
  assert.equal(entry.branchId, 'b1');
  assert.equal(entry.fromBasket, 1000);
  assert.equal(entry.itemCount, 2);
  assert.equal(entry.totalCents, 39800 + 18075);
  assert.equal(entry.lines.length, 2);
  assert.equal(entry.draftId, null);
  assert.equal(entry.inDoubt, false);
  assert.equal(entry.sentAt, null);
});

test('a sale that cannot be sent is refused with a reason, and the queue is not touched', () => {
  assert.deepEqual(startForward(NO_FORWARDS, emptyBasket(OWNER, 1), { id: 's', issueKey: 'k' }, 2), { ok: false, why: 'empty' });
  const tiny = addItem(emptyBasket(OWNER, 1), { ...FLOUR, sellingCents: 1 }, 10, 2, 'L1');
  assert.ok(tiny.ok);
  assert.deepEqual(startForward(NO_FORWARDS, tiny.basket, { id: 's', issueKey: 'k' }, 2), { ok: false, why: 'zero_total' });
});

test('the same basket cannot be sent twice, even by a second tap', () => {
  const state = started(NO_FORWARDS, 1, OWNER, 1000);
  assert.ok(basketAlreadySent(state, basketOf(1000)));
  assert.deepEqual(startForward(state, basketOf(1000), { id: 's9', issueKey: 'k9' }, 6000), { ok: false, why: 'already_sent' });
  assert.ok(!basketAlreadySent(state, basketOf(1001)), 'an edited basket is a new sale');
  assert.ok(!basketAlreadySent(state, basketOf(1000, { ownerId: 'u2', branchId: 'b1' })));
});

test('the phone will not hold more unsent sales than a limit', () => {
  let state = NO_FORWARDS;
  for (let n = 1; n <= MAX_UNSENT; n += 1) state = started(state, n);
  assert.deepEqual(startForward(state, basketOf(9999), { id: 'x', issueKey: 'y' }, 9), { ok: false, why: 'full' });
  const sentOne = afterIssued(state, 's1', RESULT, 9000);
  assert.ok(startForward(sentOne, basketOf(9999), { id: 'x', issueKey: 'y' }, 9).ok, 'a sale that has been sent no longer counts');
});

test('the draft goes to the server in shillings and units, under the sale\'s own name', () => {
  const state = started(NO_FORWARDS, 1);
  const entry = state.entries[0]!;
  assert.deepEqual(draftBody(entry), {
    branchId: 'b1',
    clientDraftId: 'phone:s1',
    lines: [
      { itemId: 'i1', quantity: 2, unitPrice: 199, unitName: 'each' },
      { itemId: 'i2', quantity: 1.5, unitPrice: 120.5, unitName: 'kg' },
    ],
  });
  const odd = { ...entry, lines: [{ ...entry.lines[0]!, quantityUnits: 12_345, unitCents: 1999 }] };
  assert.deepEqual(draftBody(odd).lines[0], { itemId: 'i1', quantity: 1.2345, unitPrice: 19.99, unitName: 'each' });
  assert.equal(issuePath('d 1/2'), '/api/v1/grocery-drafts/d%201%2F2/issue');
});

test('the server\'s draft is read, and another sale\'s draft is not taken for this one', () => {
  assert.deepEqual(readDraftReply({ id: 'd1', clientDraftId: 's1', status: 'BUILDING' }, 's1'), { draftId: 'd1', status: 'building' });
  assert.deepEqual(readDraftReply({ id: 'd1' }, 's1'), { draftId: 'd1', status: '' });
  assert.equal(readDraftReply({ id: 'd1', clientDraftId: 'other' }, 's1'), null);
  for (const bad of [null, 'x', 5, {}, { id: '' }, { id: 7 }]) assert.equal(readDraftReply(bad, 's1'), null, String(bad));
});

test('the server\'s invoice is read, and an answer about another draft is not accepted', () => {
  const full = {
    draftId: 'd1',
    counterNumber: 42,
    status: 'issued',
    invoiceId: 'inv1',
    invoice: { id: 'inv1', barcodeCode: ' 123456789012 ', status: 'PENDING_PAYMENT', grandTotal: 578.75 },
    createdNew: true,
  };
  assert.deepEqual(readIssueReply(full, 'd1'), RESULT);
  assert.equal(readIssueReply({ ...full, invoice: { ...full.invoice, grandTotal: '578.75' } }, 'd1')?.totalCents, 57875);
  assert.deepEqual(readIssueReply({ draftId: 'd1', counterNumber: 0, invoiceId: 'inv1', status: 'issued' }, 'd1'), {
    draftId: 'd1',
    invoiceId: 'inv1',
    counterNumber: 0,
    code: null,
    totalCents: null,
    status: 'issued',
  });
  assert.equal(readIssueReply(full, 'd2'), null);
  for (const bad of [null, [], {}, { ...full, invoiceId: '' }, { ...full, counterNumber: 1.5 }, { ...full, counterNumber: '42' }, { ...full, counterNumber: -1 }]) {
    assert.equal(readIssueReply(bad, 'd1'), null, JSON.stringify(bad));
  }
});

test('which failures are waited out and which are a no', () => {
  const failure = (status: number, extra: { type?: string; foreign?: boolean; hint?: string } = {}, message = 'x') => classifyForwardError(new ApiError(message, { status, ...extra }));
  assert.deepEqual(classifyForwardError(new Error('Network request failed')), { kind: 'wait' });
  assert.deepEqual(classifyForwardError('boom'), { kind: 'wait' });
  for (const status of [401, 408, 429, 500, 502, 503]) assert.deepEqual(failure(status), { kind: 'wait' }, String(status));
  assert.deepEqual(failure(400, { foreign: true }), { kind: 'wait' }, 'a hotel\'s sign-in page is not the server saying no');
  assert.deepEqual(failure(423, { type: 'urn:problem:tenant-not-active' }), { kind: 'wait' }, 'a shop switched off for now');
  for (const status of [409, 423]) {
    const closed = failure(status);
    assert.equal(closed.kind, 'problem');
    assert.ok(closed.kind === 'problem' && closed.problem.kind === 'conflict' && closed.problem.status === status);
  }
  const refused = failure(422, { hint: 'The draft is too old.' }, 'Unprocessable');
  assert.ok(refused.kind === 'problem' && refused.problem.kind === 'refused' && refused.problem.words === 'The draft is too old.' && refused.problem.status === 422);
  const plain = failure(403, {}, 'Forbidden');
  assert.ok(plain.kind === 'problem' && plain.problem.words === 'Forbidden');
  const empty = failure(400, {}, '');
  assert.ok(empty.kind === 'problem' && empty.problem.words === 'The server did not accept this sale.');
  const long = failure(400, { hint: 'x'.repeat(500) });
  assert.ok(long.kind === 'problem' && long.problem.words.length <= 140);
});

test('each step is written down before it is sent, and what came back is written after', () => {
  let state = started(NO_FORWARDS, 1);
  state = beginStep(state, 's1', 7000);
  assert.deepEqual([state.entries[0]!.inDoubt, state.entries[0]!.sentAt], [true, 7000]);
  state = afterDraft(state, 's1', 'd1');
  assert.deepEqual([state.entries[0]!.draftId, state.entries[0]!.inDoubt], ['d1', false]);
  state = beginStep(state, 's1', 7100);
  assert.equal(state.entries[0]!.inDoubt, true);
  state = afterIssued(state, 's1', RESULT, 7200);
  const done = state.entries[0]!;
  assert.deepEqual([done.result, done.lines, done.inDoubt, done.problem, done.sentAt], [RESULT, [], false, null, 7200]);
  assert.equal(beginStep(state, 's1', 8000), state, 'a sale that is sent is not touched again');
  assert.equal(afterDraft(state, 's1', 'd9'), state);
  assert.equal(afterRefused(state, 's1', { kind: 'refused', status: 400, words: 'x' }), state);
  assert.equal(beginStep(state, 'nope', 8000), state);
  assert.equal(afterIssued(state, 'nope', RESULT, 8000), state);
});

test('a refusal ends the in-doubt state, unless the server\'s answer could not be read', () => {
  let state = beginStep(started(NO_FORWARDS, 1), 's1', 7000);
  const problem = { kind: 'refused', status: 422, words: 'Too old.' } as const;
  assert.equal(afterRefused(state, 's1', problem).entries[0]!.inDoubt, false);
  assert.equal(afterRefused(state, 's1', problem, true).entries[0]!.inDoubt, true);
  state = afterRefused(state, 's1', problem);
  assert.equal(forwardWords(state.entries[0]!, 8000), 'refused');
});

test('what a sale is called on the screen follows what is known about it', () => {
  const fresh = started(NO_FORWARDS, 1).entries[0]!;
  assert.equal(forwardWords(fresh, 6000), 'waiting');
  assert.equal(forwardWords({ ...fresh, inDoubt: true }, 6000), 'in_doubt');
  assert.equal(forwardWords(fresh, fresh.createdAt + STALE_AFTER_MS + 1), 'stale');
  assert.ok(isStale(fresh, fresh.createdAt + STALE_AFTER_MS + 1));
  assert.ok(!isStale(fresh, fresh.createdAt + STALE_AFTER_MS));
  assert.equal(forwardWords({ ...fresh, result: RESULT }, fresh.createdAt + 10 * STALE_AFTER_MS), 'sent');
  assert.ok(!isStale({ ...fresh, result: RESULT }, fresh.createdAt + 10 * STALE_AFTER_MS));
});

test('the next sale to send is the oldest of this person\'s that nothing has stopped', () => {
  let state = started(NO_FORWARDS, 1, { ownerId: 'u2', branchId: 'b1' });
  state = started(state, 2);
  state = started(state, 3);
  assert.equal(nextToSend(state, 'u1')?.id, 's2');
  assert.equal(nextToSend(state, 'u2')?.id, 's1');
  assert.equal(nextToSend(state, 'u3'), null);
  state = afterRefused(state, 's2', { kind: 'refused', status: 400, words: 'x' });
  assert.equal(nextToSend(state, 'u1')?.id, 's3', 'a refused sale waits for a person');
  state = afterIssued(state, 's3', RESULT, 9000);
  assert.equal(nextToSend(state, 'u1'), null);
});

test('who has what: sales per person, unsent counts, and sales left by others', () => {
  let state = started(NO_FORWARDS, 1, { ownerId: 'u2', branchId: 'b1' });
  state = started(state, 2);
  state = started(state, 3);
  state = afterIssued(state, 's3', RESULT, 9000);
  state = started(state, 4);
  assert.deepEqual(forwardsOf(state, 'u1').map((entry) => entry.id), ['s2', 's3', 's4']);
  assert.equal(unsentFor(state, 'u1'), 2);
  assert.equal(leftByOthers(state, 'u1'), 1);
  assert.equal(leftByOthers(state, 'u2'), 2);
  assert.equal(unsentFor(state, 'u2'), 1);
});

test('a refused sale can be sent again as a new one, but not one whose fate is unknown', () => {
  let state = beginStep(started(NO_FORWARDS, 1), 's1', 7000);
  state = afterDraft(state, 's1', 'd1');
  state = afterRefused(state, 's1', { kind: 'conflict', status: 423, words: 'closed' });
  const again = retryAsNew(state, 's1', { id: 'n1', issueKey: 'nk1' }, 9000);
  assert.ok(again.ok);
  const fresh = again.state.entries[0]!;
  assert.deepEqual(
    [fresh.id, fresh.issueKey, fresh.draftId, fresh.problem, fresh.inDoubt, fresh.sentAt, fresh.createdAt],
    ['n1', 'nk1', null, null, false, null, 9000]
  );
  assert.equal(fresh.lines.length, 2);
  assert.equal(fresh.fromBasket, state.entries[0]!.fromBasket);
  assert.equal(again.state.entries.length, 1);
  const unknown = afterRefused(beginStep(started(NO_FORWARDS, 2), 's2', 7000), 's2', { kind: 'unreadable', status: 200, words: 'x' }, true);
  assert.deepEqual(retryAsNew(unknown, 's2', { id: 'n', issueKey: 'k' }, 9000), { ok: false, why: 'in_doubt' });
  assert.deepEqual(retryAsNew(started(NO_FORWARDS, 3), 's3', { id: 'n', issueKey: 'k' }, 9000), { ok: false, why: 'not_refused' });
  assert.deepEqual(retryAsNew(state, 'nope', { id: 'n', issueKey: 'k' }, 9000), { ok: false, why: 'no_entry' });
  assert.deepEqual(retryAsNew(state, 's1', { id: 's1', issueKey: 'k' }, 9000), { ok: false, why: 'id_taken' });
});

test('a refused sale can be taken back into a basket to be changed', () => {
  const entry = started(NO_FORWARDS, 1).entries[0]!;
  const basket = basketFrom(entry, 9000);
  assert.deepEqual(basket, { ownerId: 'u1', branchId: 'b1', savedAt: 9000, lines: entry.lines });
  assert.notEqual(basket.lines[0], entry.lines[0], 'a copy, not the same lines');
});

test('a sale is taken off the list freely, unless it may already be at the till', () => {
  let state = started(started(NO_FORWARDS, 1), 2);
  assert.deepEqual(discardForward(state, 'nope'), { ok: false, why: 'no_entry' });
  const gone = discardForward(state, 's1');
  assert.ok(gone.ok);
  assert.deepEqual(gone.state.entries.map((entry) => entry.id), ['s2']);
  state = beginStep(state, 's2', 7000);
  assert.deepEqual(discardForward(state, 's2'), { ok: false, why: 'in_doubt' });
  const forced = discardForward(state, 's2', { sure: true });
  assert.ok(forced.ok);
  assert.deepEqual(forced.state.entries.map((entry) => entry.id), ['s1']);
  const sent = afterIssued(state, 's2', RESULT, 8000);
  assert.ok(discardForward(sent, 's2').ok, 'a sent sale is only a line on a list');
});

test('old sent sales are let go, the newest few are kept, and nothing unsent is ever dropped', () => {
  let state = started(NO_FORWARDS, 1);
  for (let n = 2; n <= KEEP_SENT + 6; n += 1) state = afterIssued(started(state, n), `s${n}`, { ...RESULT, invoiceId: `inv${n}` }, 100_000 + n);
  const pruned = prune(state, 100_000 + 1000);
  const sent = pruned.entries.filter((entry) => entry.result);
  assert.equal(sent.length, KEEP_SENT);
  assert.equal(sent.at(-1)?.id, `s${KEEP_SENT + 6}`);
  assert.equal(sent[0]?.id, 's7');
  assert.equal(pruned.entries[0]?.id, 's1', 'the unsent sale is still there');
  const old = prune(state, 100_000 + KEEP_SENT + 7 + SENT_LIFETIME_MS + 1);
  assert.deepEqual(old.entries.map((entry) => entry.id), ['s1']);
  const small = afterIssued(started(NO_FORWARDS, 1), 's1', RESULT, 5000);
  assert.equal(prune(small, 6000), small, 'nothing to drop, nothing changed');
});

test('the queue is kept on the phone and read back exactly, with sent, refused and in-doubt sales', () => {
  let state = started(started(started(started(NO_FORWARDS, 1), 2), 3), 4);
  state = afterIssued(beginStep(afterDraft(beginStep(state, 's1', 6000), 's1', 'd1'), 's1', 6100), 's1', RESULT, 6200);
  state = afterRefused(beginStep(state, 's2', 6300), 's2', { kind: 'refused', status: 422, words: 'Too old.' });
  state = beginStep(state, 's3', 6400);
  const text = encodeForwards(state);
  assert.ok(text);
  assert.deepEqual(decodeForwards(text, 7000), state);
  assert.equal(encodeForwards(NO_FORWARDS), null);
});

test('a queue that cannot be read is nothing; a sale that cannot be read is skipped and the others kept', () => {
  assert.equal(decodeForwards(null, 1), null);
  assert.equal(decodeForwards('', 1), null);
  assert.equal(decodeForwards('{', 1), null);
  assert.equal(decodeForwards('[]', 1), null);
  assert.equal(decodeForwards(JSON.stringify({ v: 2, entries: [] }), 1), null);
  assert.equal(decodeForwards(JSON.stringify({ v: 1 }), 1), null);
  const state = started(started(NO_FORWARDS, 1), 2);
  const good = JSON.parse(encodeForwards(state) as string);
  const [a, b] = good.entries;
  const broken = [
    { ...a, id: '' },
    { ...a, lines: [] },
    { ...a, lines: [{ ...a.lines[0], quantityUnits: 0 }] },
    { ...a, totalCents: -1 },
    { ...a, inDoubt: 'no' },
    { ...a, draftId: 5 },
    { ...a, problem: { kind: 'weird', status: 1, words: 'x' } },
    { ...a, result: { draftId: 'd', invoiceId: '' } },
    null,
    'x',
  ];
  for (const item of broken) {
    const decoded = decodeForwards(JSON.stringify({ v: 1, entries: [item, b] }), 7000);
    assert.deepEqual(decoded?.entries.map((entry) => entry.id), ['s2'], JSON.stringify(item)?.slice(0, 70));
  }
  const twice = decodeForwards(JSON.stringify({ v: 1, entries: [a, a] }), 7000);
  assert.equal(twice?.entries.length, 1, 'one sale under one name');
});

function keptQueue(): { good: Record<string, any>; entry: Record<string, any> } {
  const sent = afterIssued(started(NO_FORWARDS, 1), 's1', RESULT, 6000);
  const good = JSON.parse(encodeForwards(sent) as string);
  return { good, entry: good.entries[0] };
}

function ids(text: string, now = 7000): string[] | null {
  return decodeForwards(text, now)?.entries.map((entry) => entry.id) ?? null;
}

test('a kept sale is read only when every part of it is right, one wrong part at a time', () => {
  const { good, entry } = keptQueue();
  const other = JSON.parse(encodeForwards(started(NO_FORWARDS, 2)) as string).entries[0];
  const wrong = (change: Record<string, unknown>) => JSON.stringify({ v: 1, entries: [{ ...entry, ...change }, other] });
  const resultWith = (change: Record<string, unknown>) => wrong({ result: { ...entry.result, ...change } });
  const broken = [
    wrong({ issueKey: '' }),
    wrong({ ownerId: '' }),
    wrong({ branchId: '' }),
    wrong({ createdAt: 'x' }),
    wrong({ fromBasket: 'x' }),
    wrong({ itemCount: 101 }),
    wrong({ sentAt: 'x' }),
    wrong({ lines: Array.from({ length: 101 }, () => other.lines[0]) }),
    resultWith({ draftId: '' }),
    resultWith({ invoiceId: '' }),
    resultWith({ counterNumber: -1 }),
    resultWith({ counterNumber: 1.5 }),
    resultWith({ status: 5 }),
    resultWith({ code: 5 }),
    resultWith({ totalCents: 'x' }),
    resultWith({ totalCents: -5 }),
  ];
  for (const text of broken) assert.deepEqual(ids(text), ['s2'], text.slice(0, 120));
  assert.equal(decodeForwards('null', 1), null);
  assert.equal(decodeForwards('5', 1), null);
  assert.ok(good);
});

test('a kept sale at the very limits, or with no code and no total, is still read', () => {
  const { entry } = keptQueue();
  const other = JSON.parse(encodeForwards(started(NO_FORWARDS, 2)) as string).entries[0];
  const read = (change: Record<string, unknown>) => ids(JSON.stringify({ v: 1, entries: [{ ...entry, ...change }, other] }));
  assert.deepEqual(read({ result: { ...entry.result, code: null, totalCents: null } }), ['s1', 's2']);
  assert.deepEqual(read({ result: { ...entry.result, counterNumber: 0 } }), ['s1', 's2']);
  assert.deepEqual(read({ id: 'x'.repeat(200) }), ['x'.repeat(200), 's2']);
  assert.deepEqual(read({ id: 'x'.repeat(201) }), ['s2']);
  assert.deepEqual(read({ itemCount: 100, lines: Array.from({ length: 100 }, () => other.lines[0]) }), ['s1', 's2']);
});

test('a kept refusal is read only when its kind, status and words are all right, one wrong part at a time', () => {
  const refused = afterRefused(beginStep(started(NO_FORWARDS, 1), 's1', 6000), 's1', { kind: 'refused', status: 422, words: 'No such item.' });
  const good = JSON.parse(encodeForwards(refused) as string);
  const entry = good.entries[0];
  const other = JSON.parse(encodeForwards(started(NO_FORWARDS, 2)) as string).entries[0];
  const problemWith = (change: Record<string, unknown>) => JSON.stringify({ v: 1, entries: [{ ...entry, problem: { ...entry.problem, ...change } }, other] });
  assert.deepEqual(ids(JSON.stringify(good)), ['s1'], 'as it was kept, it reads');
  for (const kind of ['refused', 'conflict', 'unreadable']) assert.deepEqual(ids(problemWith({ kind })), ['s1', 's2'], kind);
  assert.deepEqual(ids(problemWith({ status: 0 })), ['s1', 's2'], 'a status of nought is a count');
  const broken = [
    problemWith({ kind: 'weird' }),
    problemWith({ kind: 5 }),
    problemWith({ status: -1 }),
    problemWith({ status: 1.5 }),
    problemWith({ status: '422' }),
    problemWith({ words: 5 }),
    problemWith({ words: null }),
  ];
  for (const text of broken) assert.deepEqual(ids(text), ['s2'], text.slice(0, 160));
  const cut = decodeForwards(problemWith({ words: 'w'.repeat(500) }), 7000)?.entries[0]?.problem?.words;
  assert.equal(cut?.length, 200, 'long words are cut to what the screen can show');
});

test('a sent sale is let go only after a whole day, and not a moment before', () => {
  const state = afterIssued(started(NO_FORWARDS, 1), 's1', RESULT, 10_000);
  assert.equal(prune(state, 10_000 + SENT_LIFETIME_MS), state, 'exactly a day old is still kept');
  assert.equal(prune(state, 10_000 + SENT_LIFETIME_MS + 1).entries.length, 0);
});

test('a draft the phone made is told from one the web counter made, by the name it was made under', () => {
  assert.equal(DRAFT_NAME_PREFIX, 'phone:');
  assert.equal(draftName('abc-123'), 'phone:abc-123');
  assert.equal(isPhoneDraftName('phone:abc-123'), true);
  assert.equal(isPhoneDraftName('phone:x'), true);
  for (const other of ['phone:', 'phone', 'Phone:abc', ' phone:abc', 'abc-123', '3f2b8c1e-1111-4222-8333-944455556666', '', null, undefined, 5, {}]) {
    assert.equal(isPhoneDraftName(other), false, String(other));
  }
  const entry = started(NO_FORWARDS, 1).entries[0]!;
  assert.equal(draftBody(entry).clientDraftId, draftName(entry.id));
  assert.equal(isPhoneDraftName(draftBody(entry).clientDraftId), true);
});

test('the paths for looking at a person\'s open drafts, reading one and cancelling one', () => {
  assert.equal(OPEN_DRAFT_HOURS, 8760);
  assert.equal(MAX_OPEN_CHECKED, 3);
  assert.equal(openDraftsPath('b 1', 'u/1'), '/api/v1/grocery-drafts?branchId=b%201&status=building&createdBy=u%2F1&hoursBack=8760');
  assert.equal(draftPath('d 1/2'), '/api/v1/grocery-drafts/d%201%2F2');
  assert.equal(cancelDraftPath('d 1/2'), '/api/v1/grocery-drafts/d%201%2F2/cancel');
  assert.ok(LEFT_OVER_REASON.length > 0 && LEFT_OVER_REASON.length <= 100);
});

test('the server\'s list of open drafts is read by id, and only an open draft counts', () => {
  assert.deepEqual(readOpenDrafts({ drafts: [] }), []);
  assert.deepEqual(readOpenDrafts({ drafts: [{ id: 'a', status: 'building' }, { id: 'b', status: 'BUILDING' }, { id: 'c' }] }), ['a', 'b', 'c']);
  assert.deepEqual(readOpenDrafts({ drafts: [{ id: 'a', status: 'issued' }, { id: 'b', status: 'cancelled' }, { id: 'c', status: 'building' }] }), ['c']);
  for (const bad of [null, undefined, 'x', 5, [], {}, { drafts: null }, { drafts: {} }, { drafts: [null] }, { drafts: ['a'] }, { drafts: [{}] }, { drafts: [{ id: '' }] }, { drafts: [{ id: 7 }] }, { drafts: [{ id: 'a' }, { status: 'building' }] }]) {
    assert.equal(readOpenDrafts(bad), null, JSON.stringify(bad));
  }
});

test('a draft is read as its id, the name it was made under, who made it, and where it stands', () => {
  assert.deepEqual(readDraftName({ id: 'd1', clientDraftId: 'phone:s1', status: 'BUILDING', createdBy: 'u1' }), { id: 'd1', clientDraftId: 'phone:s1', status: 'building', createdBy: 'u1' });
  assert.deepEqual(readDraftName({ id: 'd1' }), { id: 'd1', clientDraftId: null, status: '', createdBy: null });
  assert.deepEqual(readDraftName({ id: 'd1', clientDraftId: '', status: 4, createdBy: '' }), { id: 'd1', clientDraftId: null, status: '', createdBy: null });
  assert.deepEqual(readDraftName({ id: 'd1', clientDraftId: 7, createdBy: 9 }), { id: 'd1', clientDraftId: null, status: '', createdBy: null });
  for (const bad of [null, undefined, 'x', 5, {}, { id: '' }, { id: 7 }]) assert.equal(readDraftName(bad), null, String(bad));
});

test('an answer that is a draft of another name is the server having mixed this sale into an open one', () => {
  assert.equal(isAnotherDraft({ id: 'd9', clientDraftId: 'web-uuid' }, 'phone:s1'), true);
  assert.equal(isAnotherDraft({ id: 'd9', clientDraftId: 'phone:s2' }, 'phone:s1'), true);
  assert.equal(isAnotherDraft({ id: 'd1', clientDraftId: 'phone:s1' }, 'phone:s1'), false);
  assert.equal(isAnotherDraft({ id: 'd1' }, 'phone:s1'), false, 'no name is not another name');
  assert.equal(isAnotherDraft({ id: 'd1', clientDraftId: '' }, 'phone:s1'), false);
  for (const bad of [null, 'x', 5, {}, { clientDraftId: 'web-uuid' }]) assert.equal(isAnotherDraft(bad, 'phone:s1'), false, String(bad));
});

test('not found means the shop has drafts switched off at the draft step, and a draft that is gone at the invoice step', () => {
  const notFound = new ApiError('Not found', { status: 404 });
  assert.deepEqual(classifyForwardError(notFound, 'draft'), { kind: 'problem', problem: DRAFTS_OFF });
  assert.deepEqual(classifyForwardError(notFound, 'issue'), { kind: 'problem', problem: DRAFT_GONE });
  assert.deepEqual(classifyForwardError(notFound), { kind: 'problem', problem: DRAFT_GONE }, 'the invoice step is the default');
  assert.deepEqual(classifyForwardError(new ApiError('x', { status: 404, foreign: true }), 'draft'), { kind: 'wait' }, 'a hotel\'s page is not the shop');
  assert.equal(DRAFTS_OFF.kind, 'refused');
  assert.equal(DRAFT_GONE.kind, 'conflict');
});

test('a failed call about a draft that is already open is waited out, or the draft is gone, or it cannot be cleared', () => {
  const failure = (status: number, extra: { type?: string; foreign?: boolean } = {}) => classifyOpenDraftError(new ApiError('x', { status, ...extra }));
  assert.equal(classifyOpenDraftError(new Error('Network request failed')), 'wait');
  assert.equal(classifyOpenDraftError('boom'), 'wait');
  for (const status of [401, 408, 429, 500, 503]) assert.equal(failure(status), 'wait', String(status));
  assert.equal(failure(400, { foreign: true }), 'wait');
  assert.equal(failure(423, { type: 'urn:problem:tenant-not-active' }), 'wait', 'a shop switched off for now is not a draft that is closed');
  assert.equal(failure(404), 'gone');
  assert.equal(failure(423), 'gone');
  for (const status of [400, 403, 409, 422]) assert.equal(failure(status), 'no', String(status));
});

test('the words for a sale that cannot go fit what is kept on the phone, and read back as they were', () => {
  for (const problem of [OPEN_ELSEWHERE, MIXED_IN, DRAFTS_OFF, DRAFT_GONE]) {
    assert.ok(problem.words.length > 0 && problem.words.length <= 200, problem.words);
    const base = started(NO_FORWARDS, 1);
    const marked = afterRefused(base, 's1', problem, problem.kind === 'conflict' && problem === MIXED_IN);
    const back = decodeForwards(encodeForwards(marked), 9000);
    assert.deepEqual(back?.entries[0]?.problem, problem);
  }
  assert.equal(OPEN_ELSEWHERE.kind, 'refused');
  assert.equal(MIXED_IN.kind, 'conflict');
});

test('a refused sale from another branch cannot be changed here, and one from this branch only while the basket is empty', () => {
  assert.equal(changeProblem({ branchId: 'b1' }, { branchId: 'b1' }, 0), null);
  assert.equal(changeProblem({ branchId: 'b1' }, { branchId: 'b1' }, 2), 'basket_in_use');
  assert.equal(changeProblem({ branchId: 'b1' }, { branchId: 'b2' }, 0), 'other_branch');
  assert.equal(changeProblem({ branchId: 'b1' }, { branchId: 'b2' }, 3), 'other_branch', 'the branch is said first: the basket here has nothing to do with it');
  assert.match(changeProblemWords.other_branch, /another branch/);
  assert.match(changeProblemWords.basket_in_use, /basket has items/);
});
