import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../src/problem';
import type { HistoryEntry } from '../src/stock-adjust';
import {
  allocationPreviewPath,
  batchDecreaseBody,
  classifyWrite,
  findNewSpoil,
  isSpoilReason,
  planDecreaseCalls,
  planSetOnHand,
  readHistory,
  readItemHistory,
  SPOIL_REASONS,
  spoilOperations,
  spoilUnitCostCents,
  stockIncreaseBody,
  wastageBody,
} from '../src/stock-adjust';

const base = { currentUnits: 100000, targetUnits: 100000, buyingCents: 4850, packageVariant: false };

test('a shelf already at the number needs nothing', () => {
  assert.deepEqual(planSetOnHand(base), { ok: true, plan: { kind: 'same' } });
});

test('a higher number adds the difference at the buying cost', () => {
  const planned = planSetOnHand({ ...base, targetUnits: 125000 });
  assert.deepEqual(planned, {
    ok: true,
    plan: { kind: 'increase', units: 25000, unitCostCents: 4850, note: 'Set from phone: 10 to 12.5' },
  });
  const noCost = planSetOnHand({ ...base, targetUnits: 125000, buyingCents: null });
  assert.equal(noCost.ok && noCost.plan.kind === 'increase' ? noCost.plan.unitCostCents : -1, 0);
});

test('a lower number removes the difference', () => {
  assert.deepEqual(planSetOnHand({ ...base, targetUnits: 0 }), {
    ok: true,
    plan: { kind: 'decrease', units: 100000, note: 'Set from phone: 10 to 0' },
  });
  const part = planSetOnHand({ ...base, targetUnits: 72500 });
  assert.equal(part.ok && part.plan.kind === 'decrease' ? part.plan.units : -1, 27500);
});

test('a shop that has sold below zero is topped up from where it is', () => {
  const planned = planSetOnHand({ ...base, currentUnits: -20000, targetUnits: 50000 });
  assert.equal(planned.ok && planned.plan.kind === 'increase' ? planned.plan.units : -1, 70000);
});

test('with no current stock, or for a pack, nothing is worked out', () => {
  assert.deepEqual(planSetOnHand({ ...base, currentUnits: null }), { ok: false, problem: 'current_unknown' });
  assert.deepEqual(planSetOnHand({ ...base, currentUnits: Number.NaN }), { ok: false, problem: 'current_unknown' });
  assert.deepEqual(planSetOnHand({ ...base, packageVariant: true }), { ok: false, problem: 'pack_variant' });
  assert.deepEqual(planSetOnHand({ ...base, packageVariant: true, currentUnits: null }), { ok: false, problem: 'pack_variant' });
});

test('the note is the person\'s own words, trimmed and capped', () => {
  const typed = planSetOnHand({ ...base, targetUnits: 0, note: '  two\n crates   dropped ' });
  assert.equal(typed.ok && typed.plan.kind === 'decrease' ? typed.plan.note : '', 'two crates dropped');
  const blank = planSetOnHand({ ...base, targetUnits: 0, note: '   ' });
  assert.equal(blank.ok && blank.plan.kind === 'decrease' ? blank.plan.note : '', 'Set from phone: 10 to 0');
  const long = planSetOnHand({ ...base, targetUnits: 0, note: 'x'.repeat(500) });
  assert.equal(long.ok && long.plan.kind === 'decrease' ? long.plan.note.length : 0, 200);
});

test('asking twice for the same number, from fresh reads, adds the difference once', () => {
  let shelf = 100000;
  const target = 125000;
  const apply = (): void => {
    const planned = planSetOnHand({ currentUnits: shelf, targetUnits: target, buyingCents: 100, packageVariant: false });
    assert.ok(planned.ok);
    if (planned.plan.kind === 'increase') shelf += planned.plan.units;
  };
  apply();
  apply();
  assert.equal(shelf, 125000);
});

test('the stock-increase body is what the server reads', () => {
  assert.deepEqual(stockIncreaseBody('b1', 'i1', { units: 25000, unitCostCents: 4850, note: 'n' }), {
    branchId: 'b1',
    itemId: 'i1',
    quantity: 2.5,
    unitCost: 48.5,
    notes: 'n',
  });
  assert.equal(stockIncreaseBody('b1', 'i1', { units: 1, unitCostCents: 7, note: 'n' }).unitCost, 0.07);
});

test('the allocation preview path encodes its parts', () => {
  assert.equal(allocationPreviewPath('i 1', 'b&1', 25000), '/api/v1/inventory/allocation-preview?itemId=i%201&branchId=b%261&quantity=2.5');
});

test('a decrease is made of the preview\'s batches, no more than was asked for', () => {
  const preview = [
    { batchId: 'a', quantity: 3, unitCost: 10 },
    { batchId: 'b', quantity: '2', unitCost: 11 },
  ];
  assert.deepEqual(planDecreaseCalls(preview, 50000), {
    ok: true,
    calls: [
      { batchId: 'a', units: 30000 },
      { batchId: 'b', units: 20000 },
    ],
  });
  assert.deepEqual(planDecreaseCalls(preview, 40000), {
    ok: true,
    calls: [
      { batchId: 'a', units: 30000 },
      { batchId: 'b', units: 10000 },
    ],
  });
  assert.deepEqual(planDecreaseCalls(preview, 30000), { ok: true, calls: [{ batchId: 'a', units: 30000 }] });
});

test('a preview that cannot cover the amount is refused before anything is written', () => {
  assert.deepEqual(planDecreaseCalls([{ batchId: 'a', quantity: 3 }], 50000), { ok: false, problem: 'short', coveredUnits: 30000 });
  for (const empty of [[], null, undefined, 'x', {}, [null, 'x', { batchId: '', quantity: 1 }, { batchId: 'x', quantity: 0 }, { batchId: 'y', quantity: -1 }, { batchId: 'z' }]]) {
    assert.deepEqual(planDecreaseCalls(empty, 10000), { ok: false, problem: 'none', coveredUnits: 0 }, JSON.stringify(empty));
  }
});

test('lines that are not batches are skipped, and the rest still count', () => {
  const planned = planDecreaseCalls([null, { batchId: 'a', quantity: 1 }, { batchId: 'b', quantity: 'many' }, { batchId: 'c', quantity: 1 }], 20000);
  assert.deepEqual(planned, {
    ok: true,
    calls: [
      { batchId: 'a', units: 10000 },
      { batchId: 'c', units: 10000 },
    ],
  });
});

test('the batch-decrease body is what the server reads', () => {
  assert.deepEqual(batchDecreaseBody({ batchId: 'a', units: 30000 }, 'why'), { batchId: 'a', quantity: 3, reason: 'why' });
});

test('the reasons for a write-off are the server\'s categories', () => {
  assert.deepEqual(
    SPOIL_REASONS.map((reason) => reason.key),
    ['SPOILAGE', 'EXPIRED', 'BREAKAGE', 'THEFT', 'SAMPLE', 'PERSONAL_USE', 'OTHER']
  );
  assert.equal(isSpoilReason('EXPIRED'), true);
  assert.equal(isSpoilReason('expired'), false);
  assert.equal(isSpoilReason('COUNTING_ERROR'), false);
  assert.equal(isSpoilReason(undefined), false);
  assert.equal(new Set(SPOIL_REASONS.map((reason) => reason.label)).size, SPOIL_REASONS.length);
});

test('a written-off unit is valued at its buying price, else its selling price, else a cent', () => {
  assert.equal(spoilUnitCostCents({ buyingCents: 4850, sellingCents: 6000 }), 4850);
  assert.equal(spoilUnitCostCents({ buyingCents: 0, sellingCents: 6000 }), 6000);
  assert.equal(spoilUnitCostCents({ buyingCents: null, sellingCents: 6000 }), 6000);
  assert.equal(spoilUnitCostCents({ buyingCents: null, sellingCents: 0 }), 1);
  assert.equal(spoilUnitCostCents({ buyingCents: null, sellingCents: null }), 1);
});

test('the write-off body is what the server reads, and never has a cost of nothing', () => {
  assert.deepEqual(wastageBody({ branchId: 'b1', itemId: 'i1', units: 20000, unitCostCents: 4850, reason: 'EXPIRED' }), {
    branchId: 'b1',
    itemId: 'i1',
    quantity: 2,
    unitCost: 48.5,
    reason: 'Written off on the phone',
    wastageReason: 'EXPIRED',
  });
  const free = wastageBody({ branchId: 'b1', itemId: 'i1', units: 5000, unitCostCents: 0, reason: 'SPOILAGE', note: ' fell ' });
  assert.equal(free.unitCost, 0.01);
  assert.equal(free.reason, 'fell');
});

function entry(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'e', kind: 'stock', eventType: 'stock.wastage', branchId: 'b1', quantityDelta: -2, referenceId: 'op-1', createdAt: '2026-11-23T10:00:00Z', ...over };
}

test('an item\'s history is read, and an answer that is not one is a failed read', () => {
  const read = readHistory({ itemId: 'i1', entries: [entry(), entry({ referenceId: ' op-2 ', quantityDelta: '-1.5' })] });
  assert.equal(read?.length, 2);
  assert.deepEqual(read?.[1], { eventType: 'stock.wastage', branchId: 'b1', deltaUnits: -15000, operationId: 'op-2', at: Date.parse('2026-11-23T10:00:00Z') });
  for (const bad of [null, undefined, 'x', [], {}, { entries: 'no' }]) {
    assert.equal(readHistory(bad), null, JSON.stringify(bad));
  }
  assert.deepEqual(readHistory({ entries: [] }), []);
});

test('history lines with no amount or no operation are left out', () => {
  const read = readHistory({ entries: [entry({ quantityDelta: null }), entry({ referenceId: null }), entry({ eventType: 7 }), null, 'x', entry({ createdAt: 'when' })] });
  assert.equal(read?.length, 1);
  assert.equal(read?.[0]?.at, null);
});

test('a write-off that took from two batches is one operation of the sum', () => {
  const history = readHistory({
    entries: [
      entry({ quantityDelta: -1.5, createdAt: '2026-11-23T10:00:05Z' }),
      entry({ quantityDelta: -0.5, createdAt: '2026-11-23T10:00:01Z' }),
      entry({ eventType: 'stock.sale', quantityDelta: -9, referenceId: 'sale-1' }),
      entry({ branchId: 'b2', quantityDelta: -4, referenceId: 'op-9' }),
      entry({ quantityDelta: 3, referenceId: 'op-3' }),
    ],
  }) ?? [];
  const ops = spoilOperations(history, 'b1');
  assert.equal(ops.size, 1);
  assert.deepEqual(ops.get('op-1'), { units: 20000, at: Date.parse('2026-11-23T10:00:01Z') });
});

test('a write-off is recognised when a new one took exactly what was asked, at that branch', () => {
  const history = readHistory({ entries: [entry({ quantityDelta: -1, referenceId: 'old' }), entry({ quantityDelta: -2, referenceId: 'new' })] }) ?? [];
  const known = new Set(['old']);
  assert.deepEqual(findNewSpoil(history, { branchId: 'b1', units: 20000, known }), { operationId: 'new' });
  assert.equal(findNewSpoil(history, { branchId: 'b1', units: 10000, known }), null, 'the old one was there before');
  assert.equal(findNewSpoil(history, { branchId: 'b1', units: 25000, known }), null, 'another amount');
  assert.equal(findNewSpoil(history, { branchId: 'b2', units: 20000, known }), null, 'another branch');
  assert.equal(findNewSpoil([], { branchId: 'b1', units: 20000, known }), null);
});

test('one that began long before the attempt is not this attempt\'s', () => {
  const history = readHistory({ entries: [entry({ quantityDelta: -2, referenceId: 'early', createdAt: '2026-11-23T08:00:00Z' })] }) ?? [];
  const since = Date.parse('2026-11-23T10:00:00Z');
  assert.equal(findNewSpoil(history, { branchId: 'b1', units: 20000, known: new Set(), since }), null);
  assert.deepEqual(findNewSpoil(history, { branchId: 'b1', units: 20000, known: new Set(), since: Date.parse('2026-11-23T08:05:00Z') }), { operationId: 'early' });
  const unstamped = readHistory({ entries: [entry({ quantityDelta: -2, referenceId: 'nodate', createdAt: null })] }) ?? [];
  assert.deepEqual(findNewSpoil(unstamped, { branchId: 'b1', units: 20000, known: new Set(), since }), { operationId: 'nodate' });
});

test('a stock write with no clear answer is in doubt; one the server turned down says so', () => {
  const fail = (status: number, extra: { foreign?: boolean; hint?: string } = {}, message = 'x') => classifyWrite(new ApiError(message, { status, ...extra }));
  assert.deepEqual(classifyWrite(new TypeError('Network request failed')), { kind: 'doubt' });
  assert.deepEqual(classifyWrite('boom'), { kind: 'doubt' });
  for (const status of [401, 408, 423, 429, 500, 502, 503]) assert.deepEqual(fail(status), { kind: 'doubt' }, String(status));
  assert.deepEqual(fail(400, { foreign: true }), { kind: 'doubt' }, 'a hotel sign-in page is not the server saying no');
  assert.deepEqual(fail(409, { hint: 'Not enough stock.' }), { kind: 'refused', words: 'Not enough stock.' });
  assert.deepEqual(fail(403, {}, 'Forbidden'), { kind: 'refused', words: 'Forbidden' });
  assert.deepEqual(fail(400, {}, ''), { kind: 'refused', words: 'The server did not accept that.' });
  const long = fail(400, { hint: 'x'.repeat(500) });
  assert.ok(long.kind === 'refused' && long.words.length <= 140);
  assert.deepEqual(fail(302), { kind: 'doubt' });
});

test('a batch id may be up to sixty-four characters; a longer one is skipped', () => {
  const rows = [{ batchId: 'b'.repeat(65), quantity: 5 }, { batchId: 'b'.repeat(64), quantity: 5 }];
  assert.deepEqual(planDecreaseCalls(rows, 50000), { ok: true, calls: [{ batchId: 'b'.repeat(64), units: 50000 }] });
});

test('a history line that took nothing off the shelf is not a write-off', () => {
  const none: HistoryEntry = { eventType: 'stock.wastage', branchId: 'b1', deltaUnits: 0, operationId: 'op0', at: 100 };
  assert.equal(spoilOperations([none], 'b1').size, 0);
  const some: HistoryEntry = { ...none, operationId: 'op1', deltaUnits: -5 };
  assert.deepEqual([...spoilOperations([none, some], 'b1').keys()], ['op1']);
});

test('a write-off takes the earliest time any of its lines has, whichever order they come in', () => {
  const a: HistoryEntry = { eventType: 'stock.wastage', branchId: 'b1', deltaUnits: -10000, operationId: 'op', at: null };
  const b: HistoryEntry = { ...a, deltaUnits: -20000, at: 5000 };
  const c: HistoryEntry = { ...a, deltaUnits: -5000, at: 3000 };
  assert.deepEqual(spoilOperations([a, b], 'b1').get('op'), { units: 30000, at: 5000 });
  assert.deepEqual(spoilOperations([b, a], 'b1').get('op'), { units: 30000, at: 5000 });
  assert.deepEqual(spoilOperations([b, c], 'b1').get('op'), { units: 25000, at: 3000 });
  assert.deepEqual(spoilOperations([a], 'b1').get('op'), { units: 10000, at: null });
});

test('a write-off that began exactly as long before the attempt as the slack allows still counts', () => {
  const history: HistoryEntry[] = [{ eventType: 'stock.wastage', branchId: 'b1', deltaUnits: -20000, operationId: 'n', at: 1000 }];
  const input = { branchId: 'b1', units: 20000, known: new Set<string>(), since: 1000 + 600_000, slackMs: 600_000 };
  assert.deepEqual(findNewSpoil(history, input), { operationId: 'n' });
  assert.equal(findNewSpoil(history, { ...input, since: input.since + 1 }), null);
  assert.deepEqual(findNewSpoil(history, { branchId: 'b1', units: 20000, known: new Set<string>(), since: 1000 + 10 * 60_000 }), { operationId: 'n' }, 'ten minutes when no slack is given');
});

test('an item\'s history says how far back it reaches: full when the server gave as many as it was asked for', () => {
  const rows = (count: number, startAt = Date.parse('2026-11-23T12:00:00Z')) =>
    Array.from({ length: count }, (_, n) => entry({ referenceId: `op-${n}`, createdAt: new Date(startAt - n * 60_000).toISOString() }));
  const short = readItemHistory({ entries: rows(3) }, 5);
  assert.equal(short?.entries.length, 3);
  assert.equal(short?.full, false);
  assert.equal(short?.oldestAt, Date.parse('2026-11-23T11:58:00Z'));
  const full = readItemHistory({ entries: rows(5) }, 5);
  assert.equal(full?.full, true, 'as many as were asked for');
  assert.equal(full?.oldestAt, Date.parse('2026-11-23T11:56:00Z'));
  assert.equal(readItemHistory({ entries: rows(4) }, 5)?.full, false, 'one fewer is not full');
  assert.equal(readItemHistory({ entries: rows(6) }, 5)?.full, true);
});

test('every row the server sent counts toward full, and every dated row toward how far back it reaches', () => {
  const noise = [null, 'x', entry({ quantityDelta: null, createdAt: '2026-11-23T09:00:00Z' }), entry({ referenceId: null, createdAt: '2026-11-23T09:30:00Z' })];
  const read = readItemHistory({ entries: [entry({ createdAt: '2026-11-23T11:00:00Z' }), ...noise] }, 5);
  assert.equal(read?.entries.length, 1, 'only one of them is a stock change the app can use');
  assert.equal(read?.full, true, 'but five rows were sent');
  assert.equal(read?.oldestAt, Date.parse('2026-11-23T09:00:00Z'), 'the oldest of all of them, used or not');
  assert.equal(readItemHistory({ entries: [entry({ createdAt: null }), entry({ createdAt: 'when' })] }, 2)?.oldestAt, null, 'no dates, no reach');
  assert.deepEqual(readItemHistory({ entries: [] }, 5), { entries: [], full: false, oldestAt: null });
});

test('an answer that is not a history is a failed read, with a limit or without', () => {
  for (const bad of [null, undefined, 'x', [], {}, { entries: 'no' }]) {
    assert.equal(readItemHistory(bad, 100), null, JSON.stringify(bad));
  }
});
