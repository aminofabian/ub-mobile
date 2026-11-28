import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asyncStore } from '../../../packages/core/test/support/world.mjs';
import {
  addToLog,
  appendToLog,
  changeLog,
  differenceEntry,
  discardedEntry,
  encodeLog,
  entriesForSent,
  LOG_LIFETIME_MS,
  LOG_MAX_ENTRIES,
  parseLog,
  readLog,
  recordSent,
  removeFromLog,
  sentByOtherEntry,
  subscribeLog,
  trimLog,
  typedCodeEntry,
  type LogEntry,
} from '../src/lib/till-log';
import { formatWhen } from '../src/lib/when';

const NOON = Date.parse('2026-11-23T12:00:00.000Z');
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

const SALE = {
  id: 'k-1',
  createdAt: '2026-11-23T07:12:00.000Z',
  label: '2 x Bread, 1 x Milk',
  body: {
    lines: [
      { quantity: 2, unitPrice: 50 },
      { quantity: 1, unitPrice: 500 },
    ],
    payments: [{ method: 'mpesa_manual', amount: 600, reference: 'SHK7Y2ABCD' }],
  },
  facts: { rungBy: 'Amina', rungById: 'u-1', mpesaTyped: true },
};
const CASH_SALE = { ...SALE, id: 'k-2', body: { ...SALE.body, payments: [{ method: 'cash', amount: 600 }] }, facts: { rungBy: 'Amina', rungById: 'u-1' } };

const entry = (id: string, kind: LogEntry['kind'], at: number, text = 'a note'): LogEntry => ({ id, kind, at, text });

test('a note is added once, newest first, and the same note replaces itself', () => {
  const a = entry('discarded:a', 'discarded', NOON - 2 * HOUR);
  const b = entry('typed_code:b', 'typed_code', NOON - HOUR);
  const again = entry('discarded:a', 'discarded', NOON, 'newer words');
  assert.deepEqual(addToLog([a], b, NOON).map((e) => e.id), ['typed_code:b', 'discarded:a']);
  assert.deepEqual(addToLog([a, b], again, NOON).map((e) => [e.id, e.text]), [
    ['discarded:a', 'newer words'],
    ['typed_code:b', 'a note'],
  ]);
});

test('notes older than thirty days are not kept', () => {
  const old = entry('discarded:old', 'discarded', NOON - LOG_LIFETIME_MS - 1);
  const fresh = entry('discarded:new', 'discarded', NOON);
  assert.deepEqual(addToLog([old], fresh, NOON).map((e) => e.id), ['discarded:new']);
  const edge = entry('discarded:edge', 'discarded', NOON - LOG_LIFETIME_MS);
  assert.deepEqual(addToLog([edge], fresh, NOON).map((e) => e.id), ['discarded:new', 'discarded:edge'], 'thirty days exactly is still kept');
});

test('fifty notes at most, and the notes about typed codes make room before anything else does', () => {
  const typed = Array.from({ length: 50 }, (_, i) => entry(`typed_code:${i}`, 'typed_code', NOON - (i + 1) * HOUR));
  const gone = entry('discarded:x', 'discarded', NOON - 100 * HOUR);
  // The sale thrown away is the oldest of all, and still outlives the typed codes that came after it.
  const next = addToLog([...typed.slice(0, 49), gone], typed[49], NOON);
  assert.equal(next.length, LOG_MAX_ENTRIES);
  assert.ok(next.some((e) => e.id === 'discarded:x'), 'a discarded sale is not pushed out by typed codes');
  const sixtyOne = Array.from({ length: 51 }, (_, i) => entry(`discarded:${i}`, 'discarded', NOON - i * HOUR));
  const trimmed = trimLog(sixtyOne);
  assert.equal(trimmed.length, LOG_MAX_ENTRIES);
  assert.equal(trimmed[trimmed.length - 1].id, 'discarded:49', 'with nothing else to drop, the oldest goes');
  assert.deepEqual(trimLog([]), []);
});

test('the log is shown newest first, whatever order it was stored in', () => {
  const older = entry('discarded:a', 'discarded', NOON - 2 * HOUR);
  const newer = entry('discarded:b', 'discarded', NOON - HOUR);
  assert.deepEqual(trimLog([older, newer]).map((e) => e.id), ['discarded:b', 'discarded:a']);
  assert.deepEqual(parseLog(encodeLog([older, newer]), NOON).map((e) => e.id), ['discarded:b', 'discarded:a']);
});

test('a note can be taken out', () => {
  const a = entry('discarded:a', 'discarded', NOON);
  const b = entry('typed_code:b', 'typed_code', NOON);
  assert.deepEqual(removeFromLog([a, b], 'discarded:a'), [b]);
  assert.deepEqual(removeFromLog([a, b], 'nothing'), [a, b]);
});

test('the log is read back as it was written, and anything that is not a note is left out', () => {
  const good = entry('discarded:a', 'discarded', NOON - HOUR, 'x'.repeat(900));
  const parsed = parseLog(encodeLog([good]), NOON);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].text.length, 400, 'a note is kept at the size a screen can show');
  assert.deepEqual(parseLog(null, NOON), []);
  assert.deepEqual(parseLog('', NOON), []);
  assert.deepEqual(parseLog('{not json', NOON), []);
  assert.deepEqual(parseLog(JSON.stringify({ v: 2, entries: [good] }), NOON), [], 'a newer layout is not guessed at');
  assert.deepEqual(parseLog(JSON.stringify({ v: 1, entries: 'no' }), NOON), []);
  assert.deepEqual(parseLog(JSON.stringify([good]), NOON), []);
  const mixed = [
    null,
    'text',
    { ...good, id: '' },
    { ...good, id: 'x'.repeat(200) },
    { ...good, kind: 'something_else' },
    { ...good, at: 'yesterday' },
    { ...good, at: NOON + 3 * DAY },
    { ...good, at: NOON - LOG_LIFETIME_MS - 1 },
    { ...good, text: '   ' },
    { ...good, text: 5 },
    { ...good, id: 'discarded:ok', text: 'fine' },
  ];
  assert.deepEqual(parseLog(JSON.stringify({ v: 1, entries: mixed }), NOON).map((e) => e.id), ['discarded:ok']);
});

test('a sale thrown away is written down with what it was, who threw it away, and that it had M-Pesa money in it', () => {
  const made = discardedEntry(SALE, 'Brian', NOON);
  assert.equal(made.id, 'discarded:k-1');
  assert.equal(made.kind, 'discarded');
  assert.equal(made.at, NOON);
  assert.ok(made.text.startsWith(`The sale of 600.00 rung ${formatWhen(SALE.createdAt)} by Amina was discarded by Brian and never sent`), made.text);
  assert.match(made.text, /\(it had an M-Pesa payment\)/);
  assert.match(made.text, /It was: 2 x Bread, 1 x Milk\./);
  const cash = discardedEntry(CASH_SALE, '', NOON);
  assert.doesNotMatch(cash.text, /M-Pesa/);
  assert.match(cash.text, /discarded by someone and never sent/);
  const odd = discardedEntry({ id: 'k-3' }, 'Brian', NOON);
  assert.match(odd.text, /^A sale rung /, 'a sale that cannot be added up is still written down');
});

test('a sale the server priced differently says who is owed what', () => {
  assert.equal(differenceEntry(SALE, { grandTotal: 600 }, NOON), null, 'the same total is nothing to note');
  assert.equal(differenceEntry(SALE, {}, NOON), null, 'a server that did not say is not guessed at');
  assert.equal(differenceEntry(SALE, null, NOON), null);
  assert.equal(differenceEntry({ id: 'k-3' }, { grandTotal: 600 }, NOON), null, 'a sale that cannot be added up has nothing to compare');
  const less = differenceEntry(SALE, { grandTotal: 550 }, NOON);
  assert.equal(less?.kind, 'priced_differently');
  assert.equal(less?.id, 'priced_differently:k-1');
  assert.match(less?.text ?? '', /was priced 550\.00 by the server, not 600\.00/);
  assert.match(less?.text ?? '', /50\.00 is owed back to the customer\./);
  const more = differenceEntry(SALE, { grandTotal: 650.5 }, NOON);
  assert.match(more?.text ?? '', /was priced 650\.50 by the server, not 600\.00/);
  assert.match(more?.text ?? '', /The customer owes 50\.50 more\./);
});

test('a sale sent while someone else was signed in says so', () => {
  assert.equal(sentByOtherEntry(SALE, { id: 'u-1', name: 'Amina' }, NOON), null, 'the same person');
  assert.equal(sentByOtherEntry({ id: 'k-9', facts: {} }, { id: 'u-2', name: 'Brian' }, NOON), null, 'nobody knows who rang it');
  assert.equal(sentByOtherEntry({ id: 'k-9' }, { id: 'u-2', name: 'Brian' }, NOON), null);
  const other = sentByOtherEntry(SALE, { id: 'u-2', name: 'Brian' }, NOON);
  assert.equal(other?.kind, 'sent_by_other');
  assert.match(other?.text ?? '', /was sent while Brian was signed in, so the server recorded it under them and in their shift\./);
  assert.match(sentByOtherEntry(SALE, { id: 'u-2', name: '' }, NOON)?.text ?? '', /while someone else was signed in/);
});

test('a sale paid with a typed code is written down for a manager, with the end of the code and what to do', () => {
  assert.equal(typedCodeEntry(CASH_SALE, { receiptNo: 4 }, NOON), null, 'no typed code, no note');
  assert.equal(typedCodeEntry({ ...SALE, facts: { rungBy: 'Amina' } }, { receiptNo: 4 }, NOON), null, 'a code a paid prompt gave');
  const made = typedCodeEntry(SALE, { receiptNo: 17 }, NOON);
  assert.equal(made?.kind, 'typed_code');
  assert.equal(made?.id, 'typed_code:k-1');
  assert.ok((made?.text ?? '').startsWith('Sale #17: The sale of 600.00'), made?.text);
  assert.match(made?.text ?? '', /paid 600\.00 by M-Pesa with a code that was typed in \(\.\.\.ABCD\)/);
  assert.doesNotMatch(made?.text ?? '', /SHK7Y2ABCD/, 'the whole code is not copied into a note');
  assert.match(made?.text ?? '', /Nobody has checked it\. Look for it in the M-Pesa statement\./);
  assert.doesNotMatch(typedCodeEntry(SALE, {}, NOON)?.text ?? '', /Sale #/, 'a server that gave no number is not given one');
});

test('what is written down about a sale that has just been sent: every note that applies, and none that does not', () => {
  const sender = { id: 'u-2', name: 'Brian' };
  assert.deepEqual(entriesForSent(SALE, { receiptNo: 1, grandTotal: 550 }, sender, NOON).map((e) => e.kind), [
    'typed_code',
    'priced_differently',
    'sent_by_other',
  ]);
  assert.deepEqual(entriesForSent(CASH_SALE, { receiptNo: 1, grandTotal: 600 }, { id: 'u-1', name: 'Amina' }, NOON), []);
  assert.deepEqual(entriesForSent({ id: 'other', body: { name: 'x' } }, { id: 'sale' }, sender, NOON), [], 'what is not a sale has nothing to note');
});

test('the log is kept for the shop and comes back', async () => {
  const a = entry('discarded:a', 'discarded', NOON - HOUR);
  await appendToLog('shop-log-1', a, NOON);
  assert.deepEqual(await readLog('shop-log-1', NOON), [a]);
  assert.deepEqual(await readLog('shop-log-2', NOON), [], 'another shop has its own');
  await changeLog('shop-log-1', (log) => removeFromLog(log, 'discarded:a'), NOON);
  assert.deepEqual(await readLog('shop-log-1', NOON), []);
});

test('two notes that finish together are both kept', async () => {
  const a = entry('discarded:a', 'discarded', NOON - 2 * HOUR);
  const b = entry('typed_code:b', 'typed_code', NOON - HOUR);
  await Promise.all([appendToLog('shop-log-3', a, NOON), appendToLog('shop-log-3', b, NOON), recordSent('shop-log-3', SALE, { receiptNo: 2 }, { id: 'u-1', name: 'Amina' }, NOON)]);
  const kept = await readLog('shop-log-3', NOON);
  assert.deepEqual(kept.map((e) => e.id).sort(), ['discarded:a', 'typed_code:b', 'typed_code:k-1'].sort());
});

test('a sale with nothing to note writes nothing', async () => {
  let told = 0;
  const stop = subscribeLog(() => {
    told += 1;
  });
  await recordSent('shop-log-4', CASH_SALE, { receiptNo: 1, grandTotal: 600 }, { id: 'u-1', name: 'Amina' }, NOON);
  stop();
  assert.equal(told, 0);
  assert.deepEqual(await readLog('shop-log-4', NOON), []);
});

test('whoever shows the log is told when it changes, and not after they stop listening', async () => {
  let told = 0;
  const stop = subscribeLog(() => {
    told += 1;
  });
  await appendToLog('shop-log-5', entry('discarded:a', 'discarded', NOON), NOON);
  assert.equal(told, 1);
  stop();
  await appendToLog('shop-log-5', entry('discarded:b', 'discarded', NOON), NOON);
  assert.equal(told, 1);
  const throwing = subscribeLog(() => {
    throw new Error('a screen that fell over');
  });
  let toldAfter = 0;
  const after = subscribeLog(() => {
    toldAfter += 1;
  });
  await appendToLog('shop-log-5', entry('discarded:c', 'discarded', NOON), NOON);
  throwing();
  after();
  assert.equal((await readLog('shop-log-5', NOON)).length, 3, 'a listener that throws does not stop the note being kept');
  assert.equal(toldAfter, 1, 'nor the screens that come after it being told');
});

test('a phone whose storage fails never turns a note into an error, and nobody is told of a note that was not kept', async () => {
  await appendToLog('shop-log-6', entry('discarded:a', 'discarded', NOON - HOUR), NOON);
  let told = 0;
  const stop = subscribeLog(() => {
    told += 1;
  });
  asyncStore.__setFault(() => {
    throw new Error('storage is full');
  });
  try {
    assert.deepEqual(await readLog('shop-log-6', NOON), [], 'reading fails quietly');
    await appendToLog('shop-log-6', entry('discarded:b', 'discarded', NOON), NOON);
  } finally {
    asyncStore.__setFault(null);
    stop();
  }
  assert.equal(told, 0);
  assert.deepEqual((await readLog('shop-log-6', NOON)).map((e) => e.id), ['discarded:a'], 'what was kept before is still there');
});
