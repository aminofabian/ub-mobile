import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeeper } from '../src/keeper';
import { HISTORY_SLACK_MS, type HistoryEntry, type ItemHistory } from '../src/stock-adjust';
import { MAX_QTY_UNITS } from '../src/stock-qty';
import {
  addSpoil,
  beginSending,
  beginSpoil,
  claimSpoils,
  clearSpoils,
  decodeSpoils,
  emptySpoils,
  encodeSpoils,
  MAX_BASELINE,
  MAX_SPOIL_LINES,
  nextSpoil,
  removeSpoil,
  setReason,
  setSpoilUnits,
  SPOIL_LIST_LIFETIME_MS,
  SPOIL_SETTLE_MS,
  spoilVerdict,
  spoilDone,
  spoilNotDone,
  spoilSkipped,
  type SpoilList,
} from '../src/spoils';

const OWNER = { ownerId: 'u1', branchId: 'b1' };
const MILK = { id: 'i1', name: 'Milk', weighed: false, buyingCents: 4850, sellingCents: 6000 };
const BREAD = { id: 'i2', name: 'Bread', weighed: true, buyingCents: null, sellingCents: 5500 };

type TestItem = { id: string; name: string; weighed: boolean; buyingCents: number | null; sellingCents: number | null };

function listWith(...items: Array<{ item: TestItem; units: number }>): SpoilList {
  let list = emptySpoils(OWNER, 1000);
  for (const { item, units } of items) {
    const added = addSpoil(list, item, units, 1000);
    assert.ok(added.ok);
    list = added.list;
  }
  return list;
}

test('a line is added with the item\'s cost, and the same item twice is one line', () => {
  const list = listWith({ item: MILK, units: 20000 }, { item: BREAD, units: 10000 }, { item: MILK, units: 5000 });
  assert.deepEqual(list.lines, [
    { itemId: 'i1', name: 'Milk', units: 25000, unitCostCents: 4850, weighed: false },
    { itemId: 'i2', name: 'Bread', units: 10000, unitCostCents: 5500, weighed: true },
  ]);
});

test('a quantity that is not a whole number of ten-thousandths above zero is refused', () => {
  for (const units of [0, -1, 1.5, Number.NaN]) {
    assert.deepEqual(addSpoil(emptySpoils(OWNER, 1), MILK, units, 1), { ok: false, why: 'bad_quantity' }, String(units));
  }
});

test('the list has a limit, but an item already on it can still take more', () => {
  let list = emptySpoils(OWNER, 1);
  for (let n = 0; n < MAX_SPOIL_LINES; n += 1) {
    const added = addSpoil(list, { id: `i${n}`, name: `Item ${n}`, weighed: false, buyingCents: 100, sellingCents: 200 }, 10000, 1);
    assert.ok(added.ok);
    list = added.list;
  }
  assert.deepEqual(addSpoil(list, { id: 'extra', name: 'Extra', weighed: false, buyingCents: 1, sellingCents: 1 }, 10000, 1), { ok: false, why: 'too_many' });
  assert.ok(addSpoil(list, { id: 'i0', name: 'Item 0', weighed: false, buyingCents: 100, sellingCents: 200 }, 10000, 1).ok);
});

test('a line can be changed or removed, and the reason chosen', () => {
  const list = listWith({ item: MILK, units: 20000 }, { item: BREAD, units: 10000 });
  assert.equal(setSpoilUnits(list, 'i1', 30000, 2000).lines[0]?.units, 30000);
  assert.equal(setSpoilUnits(list, 'i1', 0, 2000), list);
  assert.equal(setSpoilUnits(list, 'i1', 1.5, 2000), list);
  assert.deepEqual(removeSpoil(list, 'i1', 2000).lines.map((line) => line.itemId), ['i2']);
  assert.equal(removeSpoil(list, 'nope', 2000), list);
  assert.equal(setReason(list, 'EXPIRED', 2000).reason, 'EXPIRED');
  assert.equal(setReason(list, 'SPOILAGE', 2000), list);
  assert.deepEqual(clearSpoils(list, 2000).lines, []);
  assert.equal(clearSpoils(emptySpoils(OWNER, 1), 2000).lines.length, 0);
});

test('the next line to send is the first, and none while one is in flight', () => {
  const list = listWith({ item: MILK, units: 20000 }, { item: BREAD, units: 10000 });
  assert.equal(nextSpoil(list)?.itemId, 'i1');
  assert.equal(nextSpoil(emptySpoils(OWNER, 1)), null);
  const started = beginSpoil(list, list.lines[0]!, ['op1', 'op2'], 3000);
  assert.ok(started);
  assert.equal(nextSpoil(started), null);
});

test('beginning a write-off writes down what the item\'s history held and what is being sent', () => {
  const list = listWith({ item: MILK, units: 20000 });
  const started = beginSpoil({ ...list, reason: 'EXPIRED' }, list.lines[0]!, ['op1'], 3000);
  assert.deepEqual(started?.inFlight, { itemId: 'i1', name: 'Milk', units: 20000, unitCostCents: 4850, reason: 'EXPIRED', branchId: 'b1', baseline: ['op1'], startedAt: 3000 });
  assert.equal(started?.lines.length, 1, 'the line stays until the write-off is known to have happened');
});

test('only one write-off can be in flight, and it must be a line on the list', () => {
  const list = listWith({ item: MILK, units: 20000 }, { item: BREAD, units: 10000 });
  const started = beginSpoil(list, list.lines[0]!, [], 3000);
  assert.ok(started);
  assert.equal(beginSpoil(started, list.lines[1]!, [], 3100), null);
  assert.equal(beginSpoil(list, { itemId: 'zzz', name: 'Ghost', units: 10000, unitCostCents: 100, weighed: false }, [], 3000), null);
  assert.equal(beginSpoil(list, { ...list.lines[0]!, units: 99999 }, [], 3000), null, 'the line changed since');
});

test('the history ids kept are the most recent ones, no more than the limit', () => {
  const list = listWith({ item: MILK, units: 20000 });
  const many = Array.from({ length: MAX_BASELINE + 30 }, (_, n) => `op${n}`);
  const started = beginSpoil(list, list.lines[0]!, many, 3000);
  assert.equal(started?.inFlight?.baseline.length, MAX_BASELINE);
  assert.equal(started?.inFlight?.baseline.at(-1), `op${MAX_BASELINE + 29}`);
});

test('a line in flight cannot be edited, removed, cleared or added to', () => {
  const list = listWith({ item: MILK, units: 20000 }, { item: BREAD, units: 10000 });
  const started = beginSpoil(list, list.lines[0]!, [], 3000);
  assert.ok(started);
  assert.equal(setSpoilUnits(started, 'i1', 30000, 3100), started);
  assert.equal(removeSpoil(started, 'i1', 3100), started);
  assert.equal(clearSpoils(started, 3100), started);
  assert.deepEqual(addSpoil(started, MILK, 10000, 3100), { ok: false, why: 'busy' });
  assert.ok(addSpoil(started, BREAD, 10000, 3100).ok, 'another item is still free to add');
});

test('a write-off that happened removes its line and nothing else', () => {
  const list = listWith({ item: MILK, units: 20000 }, { item: BREAD, units: 10000 });
  const started = beginSpoil(list, list.lines[0]!, [], 3000);
  assert.ok(started);
  const done = spoilDone(started, 4000);
  assert.deepEqual(done.lines.map((line) => line.itemId), ['i2']);
  assert.equal(done.inFlight, null);
  assert.equal(spoilDone(done, 4100), done);
});

test('a write-off that did not happen keeps its line and frees the list; a skipped one is dropped', () => {
  const list = listWith({ item: MILK, units: 20000 });
  const started = beginSpoil(list, list.lines[0]!, [], 3000);
  assert.ok(started);
  const notDone = spoilNotDone(started, 4000);
  assert.equal(notDone.lines.length, 1);
  assert.equal(notDone.inFlight, null);
  assert.equal(spoilNotDone(notDone, 4100), notDone);
  assert.equal(spoilSkipped(started, 4000).lines.length, 0);
});

test('someone else at the counter does not get the list, but the write-off in doubt follows the shelf', () => {
  const list = listWith({ item: MILK, units: 20000 }, { item: BREAD, units: 10000 });
  assert.equal(claimSpoils(list, OWNER, 5000), list);
  const other = claimSpoils(list, { ownerId: 'u2', branchId: 'b1' }, 5000);
  assert.deepEqual(other.lines, []);
  assert.equal(other.ownerId, 'u2');
  const started = beginSpoil(list, list.lines[0]!, ['op1'], 3000);
  assert.ok(started);
  const handed = claimSpoils(started, { ownerId: 'u2', branchId: 'b1' }, 5000);
  assert.deepEqual(handed.lines, []);
  assert.equal(handed.inFlight?.itemId, 'i1');
  assert.deepEqual(claimSpoils(null, OWNER, 5000), emptySpoils(OWNER, 5000));
  assert.deepEqual(claimSpoils(list, { ownerId: 'u1', branchId: 'b2' }, 5000).lines, []);
});

test('a list is kept on the phone and read back exactly, and an empty one is not kept', () => {
  const list = listWith({ item: MILK, units: 20000 }, { item: BREAD, units: 10000 });
  const started = beginSpoil({ ...list, reason: 'BREAKAGE' }, list.lines[0]!, ['op1', 'op2'], 3000);
  assert.ok(started);
  for (const kept of [list, started]) {
    const text = encodeSpoils(kept);
    assert.ok(text);
    assert.deepEqual(decodeSpoils(text, 4000), kept);
  }
  assert.equal(encodeSpoils(emptySpoils(OWNER, 1)), null);
  assert.equal(encodeSpoils(null), null);
});

test('a list that cannot be read is no list', () => {
  assert.equal(decodeSpoils(null, 1), null);
  assert.equal(decodeSpoils('', 1), null);
  assert.equal(decodeSpoils('{', 1), null);
  assert.equal(decodeSpoils('[]', 1), null);
  const good = JSON.parse(encodeSpoils(listWith({ item: MILK, units: 20000 })) as string);
  const broken = [
    { ...good, v: 2 },
    { ...good, reason: 'NOPE' },
    { ...good, ownerId: '' },
    { ...good, lines: [{ itemId: 'i1', name: 'Milk', units: 0, unitCostCents: 100, weighed: false }] },
    { ...good, lines: [{ itemId: 'i1', name: 'Milk', units: 10000, unitCostCents: 0, weighed: false }] },
    { ...good, lines: [{ itemId: 'i1', name: 'Milk', units: 10000, unitCostCents: 100, weighed: 'no' }] },
    { ...good, lines: [{ itemId: 'i1', name: 'Milk', units: 10000, unitCostCents: 100 }] },
    { ...good, lines: [null] },
    { ...good, inFlight: { itemId: 'i1', name: 'Milk', units: 1, unitCostCents: 1, reason: 'OTHER', baseline: [5], startedAt: 1 } },
    { ...good, inFlight: { itemId: 'i1' } },
  ];
  for (const item of broken) {
    assert.equal(decodeSpoils(JSON.stringify(item), 1000), null, JSON.stringify(item).slice(0, 90));
  }
});

test('an old list is let go, unless a write-off is still in doubt', () => {
  const list = listWith({ item: MILK, units: 20000 });
  const text = encodeSpoils(list) as string;
  assert.ok(decodeSpoils(text, 1000 + SPOIL_LIST_LIFETIME_MS - 1));
  assert.equal(decodeSpoils(text, 1000 + SPOIL_LIST_LIFETIME_MS + 1), null);
  const started = beginSpoil(list, list.lines[0]!, [], 3000);
  assert.ok(started);
  assert.ok(decodeSpoils(encodeSpoils(started), 3000 + 100 * SPOIL_LIST_LIFETIME_MS), 'a write-off in doubt is never let go by the clock');
});

function wastage(operationId: string, units: number, at: number | null, branchId = 'b1'): HistoryEntry {
  return { eventType: 'stock.wastage', branchId, deltaUnits: -units, operationId, at };
}

/** An item's history as the server answered it: by default a short one, which reaches back as far as there is anything. */
function seen(entries: HistoryEntry[], more: Partial<ItemHistory> = {}): ItemHistory {
  return { entries, full: false, oldestAt: null, ...more };
}

test('a write-off that is in the history now, and was not before, went through', () => {
  const list = listWith({ item: MILK, units: 20000 });
  const started = beginSpoil(list, list.lines[0]!, ['old'], 5000);
  assert.ok(started?.inFlight);
  const flight = started.inFlight;
  const history = [wastage('new', 20000, 5100), wastage('old', 20000, 1000)];
  assert.equal(spoilVerdict(seen(history), flight, 6000), 'done');
  assert.equal(spoilVerdict(seen(history), flight, 5000 + 100 * SPOIL_SETTLE_MS), 'done');
});

test('no new write-off yet is "too soon" for a couple of minutes, and "not seen" after; no history is unknown', () => {
  const list = listWith({ item: MILK, units: 20000 });
  const started = beginSpoil(list, list.lines[0]!, ['old'], 5000);
  assert.ok(started?.inFlight);
  const flight = started.inFlight;
  const history = [wastage('old', 20000, 1000)];
  assert.equal(spoilVerdict(seen(history), flight, 5000 + SPOIL_SETTLE_MS - 1), 'too_soon');
  assert.equal(spoilVerdict(seen(history), flight, 5000 + SPOIL_SETTLE_MS), 'not_seen');
  assert.equal(spoilVerdict(seen([]), flight, 5000 + SPOIL_SETTLE_MS), 'not_seen');
  assert.equal(spoilVerdict(null, flight, 5000 + SPOIL_SETTLE_MS), 'unknown');
});

test('a different amount, another branch, or a write-off from before is not this write-off', () => {
  const list = listWith({ item: MILK, units: 20000 });
  const started = beginSpoil(list, list.lines[0]!, [], 5_000_000);
  assert.ok(started?.inFlight);
  const flight = started.inFlight;
  const later = 5_000_000 + SPOIL_SETTLE_MS;
  assert.equal(spoilVerdict(seen([wastage('a', 10000, 5_000_100)]), flight, later), 'not_seen', 'another amount');
  assert.equal(spoilVerdict(seen([wastage('a', 20000, 5_000_100, 'b2')]), flight, later), 'not_seen', 'another branch');
  assert.equal(spoilVerdict(seen([wastage('a', 20000, 1000)]), flight, later), 'not_seen', 'long before it was sent');
});

test('a write-off that happened removes only its own line, even when another line has the same amount', () => {
  const list = listWith({ item: MILK, units: 20000 }, { item: BREAD, units: 20000 });
  const first = beginSpoil(list, list.lines[0]!, [], 3000);
  assert.ok(first);
  assert.deepEqual(spoilDone(first, 4000).lines.map((line) => line.itemId), ['i2']);
  const second = beginSpoil(list, list.lines[1]!, [], 3000);
  assert.ok(second);
  assert.deepEqual(spoilDone(second, 4000).lines.map((line) => line.itemId), ['i1']);
});

test('a kept list is read only when every part of it is right, one wrong part at a time', () => {
  const list = listWith({ item: MILK, units: 20000 }, { item: BREAD, units: 10000 });
  const started = beginSpoil({ ...list, reason: 'BREAKAGE' }, list.lines[0]!, ['op1'], 3000);
  assert.ok(started);
  const good = JSON.parse(encodeSpoils(started) as string);
  const readWith = (change: Record<string, unknown>) => decodeSpoils(JSON.stringify({ ...good, ...change }), 4000);
  const lineWith = (change: Record<string, unknown>) => readWith({ lines: [{ ...good.lines[0], ...change }] });
  const flightWith = (change: Record<string, unknown>) => readWith({ inFlight: { ...good.inFlight, ...change } });
  assert.ok(readWith({}), 'as it was kept, it reads');
  const broken: Array<[string, unknown]> = [
    ['owner', readWith({ ownerId: 5 })],
    ['branch', readWith({ branchId: 5 })],
    ['branch empty', readWith({ branchId: '' })],
    ['saved time', readWith({ savedAt: 'x' })],
    ['reason', readWith({ reason: 'NOPE' })],
    ['lines', readWith({ lines: 'x' })],
    ['line item', lineWith({ itemId: 5 })],
    ['line name', lineWith({ name: 5 })],
    ['line units', lineWith({ units: 1.5 })],
    ['line cost', lineWith({ unitCostCents: 1.5 })],
    ['line weighed', lineWith({ weighed: 1 })],
    ['write-off item', flightWith({ itemId: 5 })],
    ['write-off name', flightWith({ name: 5 })],
    ['write-off units', flightWith({ units: 0 })],
    ['write-off cost', flightWith({ unitCostCents: 0 })],
    ['write-off reason', flightWith({ reason: 'NOPE' })],
    ['write-off branch', flightWith({ branchId: 5 })],
    ['write-off branch empty', flightWith({ branchId: '' })],
    ['write-off time', flightWith({ startedAt: 'x' })],
    ['write-off history', flightWith({ baseline: 'x' })],
    ['write-off history entries', flightWith({ baseline: [5] })],
    ['write-off nought', readWith({ inFlight: 0 })],
    ['write-off a number', readWith({ inFlight: 5 })],
  ];
  for (const [what, got] of broken) assert.equal(got, null, what);
  assert.equal(decodeSpoils('null', 1), null);
  assert.equal(decodeSpoils('5', 1), null);
});

test('a kept list takes its numbers up to their limits and no further', () => {
  const list = listWith({ item: MILK, units: 20000 });
  const started = beginSpoil(list, list.lines[0]!, ['op1'], 3000);
  assert.ok(started);
  const good = JSON.parse(encodeSpoils(started) as string);
  const readWith = (change: Record<string, unknown>) => decodeSpoils(JSON.stringify({ ...good, ...change }), 4000);
  const lineWith = (change: Record<string, unknown>) => readWith({ lines: [{ ...good.lines[0], ...change }] });
  assert.ok(readWith({ ownerId: 'o'.repeat(200) }));
  assert.equal(readWith({ ownerId: 'o'.repeat(201) }), null);
  assert.ok(lineWith({ units: 10_000_000_000 }));
  assert.equal(lineWith({ units: 10_000_000_001 }), null);
  assert.ok(lineWith({ unitCostCents: 1 }));
  assert.equal(lineWith({ unitCostCents: 0 }), null);
  assert.ok(lineWith({ unitCostCents: 1_000_000_000 }));
  assert.equal(lineWith({ unitCostCents: 1_000_000_001 }), null);
});

test('a list exactly as old as the limit is still read', () => {
  const text = encodeSpoils(listWith({ item: MILK, units: 20000 })) as string;
  assert.ok(decodeSpoils(text, 1000 + SPOIL_LIST_LIFETIME_MS));
});

test('a line cannot grow past what one line can hold, and the list that was kept still reads back', () => {
  const first = addSpoil(emptySpoils(OWNER, 1), MILK, MAX_QTY_UNITS, 1);
  assert.ok(first.ok);
  assert.deepEqual(addSpoil(first.list, MILK, 1, 1), { ok: false, why: 'too_big' }, 'one more on a full line');
  assert.deepEqual(addSpoil(emptySpoils(OWNER, 1), MILK, MAX_QTY_UNITS + 1, 1), { ok: false, why: 'too_big' }, 'more than a line holds, at once');
  assert.ok(addSpoil(first.list, BREAD, 10000, 1).ok, 'another item is not affected');
  assert.equal(setSpoilUnits(first.list, 'i1', MAX_QTY_UNITS + 1, 2), first.list, 'nor can it be edited past the limit');
  assert.equal(setSpoilUnits(first.list, 'i1', MAX_QTY_UNITS, 2).lines[0]?.units, MAX_QTY_UNITS);
  assert.deepEqual(decodeSpoils(encodeSpoils(first.list), 2), first.list);
  const half = addSpoil(emptySpoils(OWNER, 1), MILK, MAX_QTY_UNITS / 2, 1);
  assert.ok(half.ok);
  assert.ok(addSpoil(half.list, MILK, MAX_QTY_UNITS / 2, 1).ok, 'exactly the limit is allowed');
  assert.equal(setSpoilUnits(half.list, 'i1', MAX_QTY_UNITS, 2).lines[0]?.units, MAX_QTY_UNITS, 'a line may be edited up to exactly the limit');
});

test('a write-off in doubt is looked for at the branch it was sent from, whoever is at the counter now', () => {
  const list = listWith({ item: MILK, units: 20000 });
  const started = beginSpoil(list, list.lines[0]!, [], 5000);
  assert.ok(started);
  assert.equal(started.inFlight?.branchId, 'b1');
  const elsewhere = claimSpoils(started, { ownerId: 'u2', branchId: 'b2' }, 6000);
  assert.equal(elsewhere.branchId, 'b2');
  assert.equal(elsewhere.inFlight?.branchId, 'b1', 'it stays with the branch it was sent from');
  const flight = elsewhere.inFlight!;
  assert.equal(spoilVerdict(seen([wastage('x', 20000, 5100, 'b1')]), flight, 6000), 'done');
  assert.equal(spoilVerdict(seen([wastage('x', 20000, 5100, 'b2')]), flight, 5000 + SPOIL_SETTLE_MS), 'not_seen', 'the write-off at the branch the person is at now is not it');
  assert.deepEqual(decodeSpoils(encodeSpoils(elsewhere), 7000)?.inFlight, flight, 'and it is kept with it');
});

test('a write-off kept before it was noted with its branch is read as the list\'s own branch', () => {
  const list = listWith({ item: MILK, units: 20000 });
  const started = beginSpoil(list, list.lines[0]!, ['op'], 5000);
  assert.ok(started);
  const old = JSON.parse(encodeSpoils(started) as string);
  delete old.inFlight.branchId;
  assert.equal(decodeSpoils(JSON.stringify(old), 5100)?.inFlight?.branchId, 'b1');
});

test('only the call that wrote a write-off down may send it; a second call while one is in flight does not', async () => {
  const list = listWith({ item: MILK, units: 20000 }, { item: BREAD, units: 10000 });
  const writes: Array<string | null> = [];
  const keeper = createKeeper<SpoilList | null>({
    initial: null,
    parse: (text, now) => decodeSpoils(text, now),
    serialize: (state) => encodeSpoils(state),
    storage: {
      read: async () => encodeSpoils(list),
      write: async (value) => {
        writes.push(value);
        return true;
      },
    },
  });
  assert.equal(beginSending(keeper, list.lines[0]!, ['op'], 3000), false, 'what is kept has not been read yet');
  await keeper.load(2000);
  assert.equal(beginSending(keeper, list.lines[0]!, ['op'], 3000), true);
  assert.equal(keeper.get()?.inFlight?.startedAt, 3000);
  assert.equal(beginSending(keeper, list.lines[0]!, ['other'], 3001), false, 'the same line again');
  assert.equal(beginSending(keeper, list.lines[1]!, ['other'], 3002), false, 'another line while one is in flight');
  assert.deepEqual(keeper.get()?.inFlight?.baseline, ['op'], 'the first note is the one that stands');
  await keeper.saved();
  assert.equal(writes.length, 1, 'one note was written, not three');
  assert.equal(beginSending(keeper, { itemId: 'zzz', name: 'Ghost', units: 10000, unitCostCents: 100, weighed: false }, [], 3003), false);
});

test('a line that is not on the list, or a list that is not there, is not begun', async () => {
  const keeper = createKeeper<SpoilList | null>({
    initial: null,
    parse: (text, now) => decodeSpoils(text, now),
    serialize: (state) => encodeSpoils(state),
    storage: { read: async () => null, write: async () => true },
  });
  await keeper.load(1);
  assert.equal(keeper.get(), null);
  assert.equal(beginSending(keeper, { itemId: 'i1', name: 'Milk', units: 10000, unitCostCents: 100, weighed: false }, [], 5), false);
  assert.equal(keeper.get(), null, 'nothing was made up');
});

test('a history that came back full, and does not reach back to the write-off, cannot say it did not happen', () => {
  const list = listWith({ item: MILK, units: 20000 });
  const started = beginSpoil(list, list.lines[0]!, ['old'], 5_000_000);
  assert.ok(started?.inFlight);
  const flight = started.inFlight;
  const later = 5_000_000 + SPOIL_SETTLE_MS;
  const reachesBack = 5_000_000 - HISTORY_SLACK_MS;
  assert.equal(spoilVerdict(seen([], { full: true, oldestAt: reachesBack }), flight, later), 'not_seen', 'it reaches back to before the write-off was sent');
  assert.equal(spoilVerdict(seen([], { full: true, oldestAt: reachesBack - 1000 }), flight, later), 'not_seen', 'further back is also enough');
  assert.equal(spoilVerdict(seen([], { full: true, oldestAt: reachesBack + 1 }), flight, later), 'too_busy', 'it starts after the write-off was sent, less the clocks\' slack');
  assert.equal(spoilVerdict(seen([], { full: true, oldestAt: 5_000_000 + 60_000 }), flight, later), 'too_busy');
  assert.equal(spoilVerdict(seen([], { full: true, oldestAt: null }), flight, later), 'too_busy', 'no way to tell how far back it reaches');
  assert.equal(spoilVerdict(seen([], { full: false, oldestAt: 5_000_000 + 60_000 }), flight, later), 'not_seen', 'a short history reaches back as far as there is anything');
  assert.equal(spoilVerdict(seen([wastage('new', 20000, 5_000_100)], { full: true, oldestAt: 5_000_000 + 60_000 }), flight, later), 'done', 'a write-off that is there is there');
  assert.equal(spoilVerdict(seen([], { full: true, oldestAt: 5_000_000 + 60_000 }), flight, 5_000_000 + SPOIL_SETTLE_MS - 1), 'too_soon', 'too soon comes first');
});
