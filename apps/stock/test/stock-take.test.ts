import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  afterRefused,
  afterSent,
  claim,
  closeBlockedBy,
  COPY_LIFETIME_MS,
  decideStart,
  decodeCopy,
  discardPending,
  encodeCopy,
  filterRows,
  heldBy,
  lineForItem,
  MAX_STORED_LINES,
  mergeFresh,
  newCopy,
  progressOf,
  readActive,
  readTake,
  retryRefused,
  rowsOf,
  typeCount,
  type StockTake,
  type TakeCopy,
  type TakeLine,
} from '../src/lib/stock-take';

function serverLine(n: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: `l${n}`,
    itemId: `i${n}`,
    itemName: `Item ${n}`,
    itemSku: `SKU-${n}`,
    systemQtySnapshot: 10,
    countedQty: null,
    adminQuantity: null,
    note: null,
    aisle: 'A1',
    status: 'pending',
    batches: [],
    ...over,
  };
}

function serverSession(over: Record<string, unknown> = {}, lines: Array<Record<string, unknown>> = [serverLine(1), serverLine(2), serverLine(3)]): Record<string, unknown> {
  return {
    id: 's1',
    sessionNumber: 4,
    branchId: 'b1',
    status: 'in_progress',
    sessionType: 'morning',
    sessionDate: '2026-11-23',
    name: 'Morning count',
    lines,
    ...over,
  };
}

function take(over: Record<string, unknown> = {}, lines?: Array<Record<string, unknown>>): StockTake {
  const read = readTake(serverSession(over, lines));
  assert.ok(read);
  return read;
}

function copyOf(over: Record<string, unknown> = {}, lines?: Array<Record<string, unknown>>): TakeCopy {
  return newCopy(take(over, lines), 1000);
}

test('a session is read with its lines', () => {
  const read = take();
  assert.equal(read.id, 's1');
  assert.equal(read.branchId, 'b1');
  assert.equal(read.kind, 'morning');
  assert.equal(read.date, '2026-11-23');
  assert.equal(read.open, true);
  assert.equal(read.lines.length, 3);
  assert.deepEqual(read.lines[0], { id: 'l1', itemId: 'i1', name: 'Item 1', sku: 'SKU-1', aisle: 'A1', systemUnits: 100000, countedUnits: null, state: 'pending' });
});

test('a closed session is not open, and an odd status is not open either', () => {
  assert.equal(take({ status: 'closed' }).open, false);
  assert.equal(take({ status: 'whatever' }).open, false);
});

test('a date comes as text or as numbers, and nothing else', () => {
  assert.equal(take({ sessionDate: [2026, 1, 5] }).date, '2026-01-05');
  assert.equal(take({ sessionDate: '2026-11-23T00:00:00' }).date, '2026-11-23');
  assert.equal(take({ sessionDate: 'yesterday' }).date, '');
  assert.equal(take({ sessionDate: null }).date, '');
});

test('a count the server holds is read, and a line not yet counted has none', () => {
  const read = take({}, [serverLine(1, { status: 'submitted', countedQty: '7.5' }), serverLine(2, { status: 'pending', countedQty: 0 }), serverLine(3, { status: 'confirmed', countedQty: null, adminQuantity: 4 })]);
  assert.equal(read.lines[0]?.countedUnits, 75000);
  assert.equal(read.lines[1]?.countedUnits, null, 'pending means not counted, whatever number sits beside it');
  assert.equal(read.lines[2]?.countedUnits, 40000);
  assert.deepEqual(read.lines.map((line) => line.state), ['submitted', 'pending', 'confirmed']);
});

test('a hidden system quantity stays unknown, and a quantity of nothing is zero', () => {
  const read = take({}, [serverLine(1, { systemQtySnapshot: null }), serverLine(2, { systemQtySnapshot: 0 }), serverLine(3, { systemQtySnapshot: undefined })]);
  assert.equal(read.lines[0]?.systemUnits, null);
  assert.equal(read.lines[1]?.systemUnits, 0);
  assert.equal(read.lines[2]?.systemUnits, null);
});

test('lines that are not lines are left out, and an answer that is not a session is a failed read', () => {
  const read = take({}, [serverLine(1), null as unknown as Record<string, unknown>, serverLine(2, { id: '' }), serverLine(3, { itemName: '  ' }), serverLine(4)]);
  assert.deepEqual(read.lines.map((line) => line.id), ['l1', 'l4']);
  for (const bad of [null, undefined, 'x', [], {}, { id: 's1', branchId: 'b1' }, { id: 's1', lines: [] }, { branchId: 'b1', lines: [] }]) {
    assert.equal(readTake(bad), null, JSON.stringify(bad));
  }
  assert.equal(readTake(serverSession({}, []))?.lines.length, 0);
});

test('the answer to "which stock take is open" says continue, offer the old one, or start', () => {
  const open = readActive({ session: serverSession(), hasStaleSession: false, staleSessionDate: null, staleSessionId: null });
  assert.ok(open);
  assert.equal(open.take?.id, 's1');
  assert.equal(decideStart(open), 'continue');
  const stale = readActive({ session: null, hasStaleSession: true, staleSessionDate: '2026-11-20', staleSessionId: 's0' });
  assert.deepEqual(stale, { take: null, stale: { id: 's0', date: '2026-11-20' } });
  assert.equal(decideStart(stale!), 'offer_stale');
  const none = readActive({ session: null, hasStaleSession: false, staleSessionDate: null, staleSessionId: null });
  assert.deepEqual(none, { take: null, stale: null });
  assert.equal(decideStart(none!), 'start');
});

test('an open stock take wins over an old one, and a stale flag with no id is not an old one', () => {
  const both = readActive({ session: serverSession(), hasStaleSession: true, staleSessionDate: '2026-11-20', staleSessionId: 's0' });
  assert.equal(both?.stale, null);
  const noId = readActive({ session: null, hasStaleSession: true, staleSessionId: null });
  assert.equal(noId?.stale, null);
});

test('an answer that is not the active answer is a failed read, never "start a new one"', () => {
  for (const bad of [null, undefined, 'x', [], {}, { hasStaleSession: false }, { session: { id: 's1' } }, { session: 'open' }]) {
    assert.equal(readActive(bad), null, JSON.stringify(bad));
  }
});

test('a typed count waits to be sent and is shown in place of the server\'s', () => {
  const typed = typeCount(copyOf(), 'l1', 80000, 2000);
  assert.ok(typed.ok);
  assert.deepEqual(typed.copy.pending.l1, { units: 80000, typedAt: 2000, problem: null });
  const row = rowsOf(typed.copy)[0];
  assert.equal(row?.units, 80000);
  assert.equal(row?.unsent, true);
  assert.equal(row?.kind, 'counted');
  assert.equal(row?.difference, -20000);
  assert.equal(typed.copy.take.lines[0]?.countedUnits, null, 'the server\'s own number is untouched until it takes the count');
});

test('typing a line again replaces its waiting count', () => {
  const first = typeCount(copyOf(), 'l1', 80000, 2000);
  assert.ok(first.ok);
  const second = typeCount(first.copy, 'l1', 90000, 3000);
  assert.ok(second.ok);
  assert.deepEqual(second.copy.pending.l1, { units: 90000, typedAt: 3000, problem: null });
  assert.equal(Object.keys(second.copy.pending).length, 1);
});

test('typing what the server already holds for a counted line changes nothing', () => {
  const counted = copyOf({}, [serverLine(1, { status: 'submitted', countedQty: 8 })]);
  const same = typeCount(counted, 'l1', 80000, 2000);
  assert.ok(same.ok);
  assert.equal(same.copy, counted);
  const different = typeCount(counted, 'l1', 70000, 2000);
  assert.ok(different.ok && different.copy !== counted);
});

test('a count of nothing is a count', () => {
  const typed = typeCount(copyOf(), 'l1', 0, 2000);
  assert.ok(typed.ok);
  assert.equal(rowsOf(typed.copy)[0]?.units, 0);
  assert.equal(rowsOf(typed.copy)[0]?.kind, 'counted');
});

test('a line that is confirmed, missing, or in a closed stock take takes no count', () => {
  const confirmed = copyOf({}, [serverLine(1, { status: 'confirmed', countedQty: 5 })]);
  assert.deepEqual(typeCount(confirmed, 'l1', 1, 1), { ok: false, why: 'locked' });
  assert.deepEqual(typeCount(copyOf(), 'nope', 1, 1), { ok: false, why: 'no_line' });
  assert.deepEqual(typeCount(copyOf({ status: 'closed' }), 'l1', 1, 1), { ok: false, why: 'closed' });
});

test('a count the server took stops waiting and becomes the line\'s count', () => {
  const typed = typeCount(copyOf(), 'l1', 80000, 2000);
  assert.ok(typed.ok);
  const sent = afterSent(typed.copy, 'l1', 80000);
  assert.deepEqual(sent.pending, {});
  assert.equal(sent.take.lines[0]?.countedUnits, 80000);
  assert.equal(sent.take.lines[0]?.state, 'submitted');
  assert.equal(rowsOf(sent)[0]?.unsent, false);
});

test('a count typed while an older one was on its way is not lost when the older one lands', () => {
  const first = typeCount(copyOf(), 'l1', 80000, 2000);
  assert.ok(first.ok);
  const second = typeCount(first.copy, 'l1', 90000, 3000);
  assert.ok(second.ok);
  const landed = afterSent(second.copy, 'l1', 80000);
  assert.deepEqual(landed.pending.l1, { units: 90000, typedAt: 3000, problem: null });
  assert.equal(landed, second.copy, 'nothing changed: the older value is not what the line should end on');
});

test('a refused count is marked and keeps its number', () => {
  const typed = typeCount(copyOf(), 'l1', 80000, 2000);
  assert.ok(typed.ok);
  const refused = afterRefused(typed.copy, 'l1', 80000, 'refused');
  assert.equal(refused.pending.l1?.problem, 'refused');
  assert.equal(refused.pending.l1?.units, 80000);
  assert.equal(rowsOf(refused)[0]?.problem, 'refused');
  assert.equal(afterRefused(refused, 'l1', 80000, 'refused'), refused);
  const newer = typeCount(typed.copy, 'l1', 90000, 3000);
  assert.ok(newer.ok);
  assert.equal(afterRefused(newer.copy, 'l1', 80000, 'refused'), newer.copy, 'a newer count has not been tried, so it is not marked');
});

test('refused counts can be tried again, or given up, without touching the ones still waiting', () => {
  let copy = copyOf();
  for (const [lineId, units] of [['l1', 10000], ['l2', 20000], ['l3', 30000]] as const) {
    const typed = typeCount(copy, lineId, units, 2000);
    assert.ok(typed.ok);
    copy = typed.copy;
  }
  copy = afterRefused(copy, 'l1', 10000, 'locked');
  copy = afterRefused(copy, 'l2', 20000, 'refused');
  const retried = retryRefused(copy);
  assert.deepEqual(Object.values(retried.pending).map((entry) => entry.problem), [null, null, null]);
  assert.equal(retryRefused(retried), retried);
  const dropped = discardPending(copy);
  assert.deepEqual(Object.keys(dropped.pending), ['l3'], 'only the refused ones go');
  assert.deepEqual(Object.keys(discardPending(copy, 'l3').pending), ['l1', 'l2']);
  assert.equal(discardPending(copy, 'zzz'), copy);
});

test('a fresh read replaces what the server holds and keeps what is still waiting', () => {
  const typed = typeCount(copyOf(), 'l1', 80000, 2000);
  assert.ok(typed.ok);
  const fresh = take({}, [serverLine(1), serverLine(2, { status: 'submitted', countedQty: 3 }), serverLine(3)]);
  const merged = mergeFresh(typed.copy, fresh, 5000);
  assert.deepEqual(merged.copy.pending.l1, { units: 80000, typedAt: 2000, problem: null });
  assert.equal(merged.copy.take.lines[1]?.countedUnits, 30000);
  assert.equal(merged.discarded, 0);
  assert.equal(merged.copy.savedAt, 5000);
});

test('a fresh read that shows the line confirmed, or the stock take closed, marks the waiting count', () => {
  const typed = typeCount(copyOf(), 'l1', 80000, 2000);
  assert.ok(typed.ok);
  const confirmed = mergeFresh(typed.copy, take({}, [serverLine(1, { status: 'confirmed', countedQty: 9 })]), 5000);
  assert.equal(confirmed.copy.pending.l1?.problem, 'locked');
  const closed = mergeFresh(typed.copy, take({ status: 'closed' }), 5000);
  assert.equal(closed.copy.pending.l1?.problem, 'closed');
});

test('a count the server could not explain is explained by the next read, and a read that finds nothing wrong clears it', () => {
  const typed = typeCount(copyOf(), 'l1', 80000, 2000);
  assert.ok(typed.ok);
  const conflicted = afterRefused(typed.copy, 'l1', 80000, 'conflict');
  assert.equal(mergeFresh(conflicted, take(), 5000).copy.pending.l1?.problem, null);
  assert.equal(mergeFresh(conflicted, take({ status: 'closed' }), 5000).copy.pending.l1?.problem, 'closed');
  const refused = afterRefused(typed.copy, 'l1', 80000, 'refused');
  assert.equal(mergeFresh(refused, take(), 5000).copy.pending.l1?.problem, 'refused', 'a refusal stays until a person tries again');
});

test('a counts for a line the server no longer has are dropped, and said so', () => {
  const typed = typeCount(copyOf(), 'l1', 80000, 2000);
  assert.ok(typed.ok);
  const merged = mergeFresh(typed.copy, take({}, [serverLine(2), serverLine(3)]), 5000);
  assert.deepEqual(merged.copy.pending, {});
  assert.equal(merged.discarded, 1);
});

test('another stock take replaces the copy, and the counts that waited for the old one are counted as dropped', () => {
  const typed = typeCount(copyOf(), 'l1', 80000, 2000);
  assert.ok(typed.ok);
  const merged = mergeFresh(typed.copy, take({ id: 's2' }), 5000);
  assert.equal(merged.copy.take.id, 's2');
  assert.deepEqual(merged.copy.pending, {});
  assert.equal(merged.discarded, 1);
  assert.equal(mergeFresh(null, take(), 5000).discarded, 0);
});

test('progress counts what is left, counted, confirmed and not sent', () => {
  const base = copyOf({}, [serverLine(1, { status: 'confirmed', countedQty: 10 }), serverLine(2, { status: 'submitted', countedQty: 9 }), serverLine(3), serverLine(4)]);
  const first = typeCount(base, 'l3', 50000, 2000);
  assert.ok(first.ok);
  const second = typeCount(first.copy, 'l4', 20000, 2100);
  assert.ok(second.ok);
  const copy = afterRefused(second.copy, 'l4', 20000, 'refused');
  assert.deepEqual(progressOf(copy), { total: 4, counted: 4, confirmed: 1, todo: 0, unsent: 1, refused: 1 });
  assert.deepEqual(progressOf(copyOf()), { total: 3, counted: 0, confirmed: 0, todo: 3, unsent: 0, refused: 0 });
});

test('a blind count shows no difference', () => {
  const blind = copyOf({}, [serverLine(1, { systemQtySnapshot: null })]);
  const typed = typeCount(blind, 'l1', 80000, 2000);
  assert.ok(typed.ok);
  assert.equal(rowsOf(typed.copy)[0]?.difference, null);
});

test('rows are found by words in the name, the SKU or the aisle, and by what is left to do', () => {
  const lines = [
    serverLine(1, { itemName: 'Fresh Milk 500ml', itemSku: 'MLK-5', aisle: 'Chiller' }),
    serverLine(2, { itemName: 'Brown Bread', itemSku: 'BRD-1', aisle: 'Bakery', status: 'submitted', countedQty: 10 }),
    serverLine(3, { itemName: 'Milk Powder', itemSku: 'MLK-9', aisle: 'Dry', status: 'submitted', countedQty: 4 }),
  ];
  const rows = rowsOf(copyOf({}, lines));
  assert.deepEqual(filterRows(rows, { text: 'milk' }).map((row) => row.line.id), ['l1', 'l3']);
  assert.deepEqual(filterRows(rows, { text: 'MILK 500' }).map((row) => row.line.id), ['l1']);
  assert.deepEqual(filterRows(rows, { text: 'brd' }).map((row) => row.line.id), ['l2']);
  assert.deepEqual(filterRows(rows, { text: 'bakery' }).map((row) => row.line.id), ['l2']);
  assert.deepEqual(filterRows(rows, { only: 'todo' }).map((row) => row.line.id), ['l1']);
  assert.deepEqual(filterRows(rows, { only: 'counted' }).map((row) => row.line.id), ['l2', 'l3']);
  assert.deepEqual(filterRows(rows, { only: 'different' }).map((row) => row.line.id), ['l3'], 'l2 was counted at exactly what the system says');
  assert.deepEqual(filterRows(rows, { only: 'counted', text: 'milk' }).map((row) => row.line.id), ['l3']);
  assert.equal(filterRows(rows, {}).length, 3);
  assert.equal(filterRows(rows, { text: 'zzz' }).length, 0);
});

test('a line is found for the item a scan or a search found', () => {
  const copy = copyOf();
  assert.equal(lineForItem(copy, 'i2')?.id, 'l2');
  assert.equal(lineForItem(copy, 'nope'), null);
});

test('closing is offered only to who may, when it is open and nothing waits to be sent', () => {
  assert.equal(closeBlockedBy(copyOf(), false), 'not_allowed');
  assert.equal(closeBlockedBy(copyOf({ status: 'closed' }), true), 'not_open');
  const typed = typeCount(copyOf(), 'l1', 1, 1);
  assert.ok(typed.ok);
  assert.equal(closeBlockedBy(typed.copy, true), 'unsent');
  assert.equal(closeBlockedBy(copyOf(), true), null);
});

test('a copy is kept on the phone and read back exactly', () => {
  let copy = copyOf({}, [serverLine(1, { systemQtySnapshot: null, itemSku: null, aisle: null }), serverLine(2, { status: 'submitted', countedQty: 3.25 }), serverLine(3)]);
  const typed = typeCount(copy, 'l3', 50000, 2000);
  assert.ok(typed.ok);
  copy = afterRefused(typed.copy, 'l3', 50000, 'locked');
  const text = encodeCopy(copy);
  assert.ok(text);
  assert.deepEqual(decodeCopy(text, 5000), copy);
  assert.equal(encodeCopy(null), null);
});

test('a copy that cannot be read is no copy', () => {
  assert.equal(decodeCopy(null, 1), null);
  assert.equal(decodeCopy('', 1), null);
  assert.equal(decodeCopy('{', 1), null);
  assert.equal(decodeCopy('[]', 1), null);
  assert.equal(decodeCopy('{"v":2}', 1), null);
  const good = JSON.parse(encodeCopy(copyOf()) as string);
  for (const broken of [{ ...good, l: [['x']] }, { ...good, l: [['a', 'b', 'c', null, null, 1.5, null, 0]] }, { ...good, l: [['a', 'b', 'c', null, null, null, null, 9]] }, { ...good, p: [['l1', -1, 1, 0]] }, { ...good, p: [['l1', 5, 1, 9]] }, { ...good, t: 'now' }, { ...good, id: 5 }]) {
    assert.equal(decodeCopy(JSON.stringify(broken), 1), null, JSON.stringify(broken).slice(0, 80));
  }
});

test('an old copy is let go, unless counts are still waiting in it', () => {
  const idle = encodeCopy(copyOf()) as string;
  assert.ok(decodeCopy(idle, 1000 + COPY_LIFETIME_MS - 1));
  assert.equal(decodeCopy(idle, 1000 + COPY_LIFETIME_MS + 1), null);
  const typed = typeCount(copyOf(), 'l1', 10000, 2000);
  assert.ok(typed.ok);
  const waiting = encodeCopy(typed.copy) as string;
  assert.ok(decodeCopy(waiting, 1000 + 100 * COPY_LIFETIME_MS), 'typed work is never thrown away by the clock');
});

test('a very long stock take is kept in part, and the lines with counts waiting are always kept', () => {
  const many: TakeLine[] = Array.from({ length: MAX_STORED_LINES + 50 }, (_, n) => ({
    id: `l${n}`,
    itemId: `i${n}`,
    name: `Item ${n}`,
    sku: null,
    aisle: null,
    systemUnits: 10000,
    countedUnits: null,
    state: 'pending' as const,
  }));
  const big: TakeCopy = {
    take: { id: 's1', branchId: 'b1', kind: 'morning', date: '2026-11-23', name: 'Big', open: true, lines: many },
    savedAt: 1000,
    pending: { [`l${MAX_STORED_LINES + 40}`]: { units: 20000, typedAt: 1, problem: null } },
    truncated: false,
    ownerId: '',
  };
  const back = decodeCopy(encodeCopy(big), 2000);
  assert.ok(back);
  assert.equal(back.take.lines.length, MAX_STORED_LINES);
  assert.equal(back.truncated, true);
  assert.ok(back.take.lines.some((line) => line.id === `l${MAX_STORED_LINES + 40}`), 'the line with a count waiting is kept');
  assert.deepEqual(Object.keys(back.pending), [`l${MAX_STORED_LINES + 40}`]);
});

test('a session id may be up to sixty-four characters, and a longer one is not an id', () => {
  assert.equal(take({ id: 'x'.repeat(64) }).id, 'x'.repeat(64));
  assert.equal(readTake(serverSession({ id: 'x'.repeat(65) })), null);
  assert.equal(readTake(serverSession({ id: '   ' })), null);
});

test('the kind of a stock take is what the server says, and morning when it says nothing', () => {
  assert.equal(take({ sessionType: 'evening' }).kind, 'evening');
  assert.equal(take({ sessionType: '' }).kind, 'morning');
  assert.equal(take({ sessionType: null }).kind, 'morning');
});

test('a new copy starts with nothing waiting and nothing cut short', () => {
  const copy = copyOf();
  assert.deepEqual(copy.pending, {});
  assert.equal(copy.truncated, false);
  assert.equal(copy.savedAt, 1000);
});

test('a count marked closed or locked is cleared by a read that finds the stock take open and the line not confirmed', () => {
  const typed = typeCount(copyOf(), 'l1', 80000, 2000);
  assert.ok(typed.ok);
  for (const problem of ['closed', 'locked'] as const) {
    const marked = afterRefused(typed.copy, 'l1', 80000, problem);
    assert.equal(marked.pending.l1?.problem, problem);
    assert.equal(mergeFresh(marked, take(), 5000).copy.pending.l1?.problem, null, problem);
  }
});

test('a sent count changes nothing unless it is the count that was waiting for a line the stock take has', () => {
  const typed = typeCount(copyOf(), 'l1', 80000, 2000);
  assert.ok(typed.ok);
  const odd: TakeCopy = { ...typed.copy, pending: { ...typed.copy.pending, zz: { units: 5, typedAt: 1, problem: null } } };
  assert.equal(afterSent(odd, 'zz', 5), odd, 'a line the stock take does not have');
  assert.equal(afterSent(odd, 'l2', 5), odd, 'nothing waiting for that line');
  assert.equal(afterSent(odd, 'l1', 70000), odd, 'not the count that was waiting');
});

test('progress counts what is waiting apart from what was refused', () => {
  const base = copyOf({}, [serverLine(1), serverLine(2), serverLine(3), serverLine(4)]);
  let copy = base;
  for (const [lineId, units, at] of [['l1', 10000, 2000], ['l2', 20000, 2100], ['l3', 30000, 2200]] as const) {
    const typed = typeCount(copy, lineId, units, at);
    assert.ok(typed.ok);
    copy = typed.copy;
  }
  copy = afterRefused(copy, 'l3', 30000, 'refused');
  const progress = progressOf(copy);
  assert.equal(progress.unsent, 2);
  assert.equal(progress.refused, 1);
});

test('the rows still waiting to be sent can be found on their own', () => {
  const base = copyOf({}, [serverLine(1), serverLine(2), serverLine(3, { status: 'submitted', countedQty: 3 })]);
  const typed = typeCount(base, 'l1', 20000, 2000);
  assert.ok(typed.ok);
  const rows = rowsOf(typed.copy);
  assert.deepEqual(filterRows(rows, { only: 'unsent' }).map((row) => row.line.id), ['l1']);
  assert.deepEqual(filterRows(rows, { only: 'all' }).map((row) => row.line.id), ['l1', 'l2', 'l3']);
});

test('a kept copy is read only when every part of it is right, one wrong part at a time', () => {
  const typed = typeCount(copyOf(), 'l1', 10000, 2000);
  assert.ok(typed.ok);
  const good = JSON.parse(encodeCopy(typed.copy) as string);
  const line: unknown[] = good.l[0];
  const waiting: unknown[] = good.p[0];
  const readWith = (change: Record<string, unknown>) => decodeCopy(JSON.stringify({ ...good, ...change }), 3000);
  const lineWith = (index: number, value: unknown) => readWith({ l: [line.map((part, at) => (at === index ? value : part))] });
  const waitingWith = (index: number, value: unknown) => readWith({ p: [waiting.map((part, at) => (at === index ? value : part))] });
  assert.ok(readWith({}), 'as it was kept, it reads');
  const broken: Array<[string, unknown]> = [
    ['branch', readWith({ b: 5 })],
    ['kind', readWith({ k: 5 })],
    ['date', readWith({ d: 5 })],
    ['name', readWith({ n: 5 })],
    ['lines not a list', readWith({ l: 5 })],
    ['counts not a list', readWith({ p: 5 })],
    ['a line with a part too many', readWith({ l: [[...line, 'extra']] })],
    ['a count with a part too many', readWith({ p: [[...waiting, 'extra']] })],
    ['line id', lineWith(0, 5)],
    ['line item', lineWith(1, 5)],
    ['line name', lineWith(2, 5)],
    ['line sku', lineWith(3, 5)],
    ['line aisle', lineWith(4, 5)],
    ['line system quantity', lineWith(5, '10')],
    ['line counted quantity', lineWith(6, 1.5)],
    ['line state', lineWith(7, 3)],
    ['count line', waitingWith(0, 5)],
    ['count units as text', waitingWith(1, '10')],
    ['count units not whole', waitingWith(1, 1.5)],
    ['count units below nothing', waitingWith(1, -1)],
    ['count time', waitingWith(2, 'x')],
    ['count problem', waitingWith(3, 'x')],
  ];
  for (const [what, got] of broken) assert.equal(got, null, what);
  assert.ok(waitingWith(1, 0), 'a count of nothing is a count');
  assert.equal(decodeCopy('null', 1), null);
  assert.equal(decodeCopy('5', 1), null);
});

test('a copy exactly three days old is still offered', () => {
  const idle = encodeCopy(copyOf()) as string;
  assert.ok(decodeCopy(idle, 1000 + COPY_LIFETIME_MS));
});

test('a name that every object already has is not an id', () => {
  for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    assert.equal(readTake(serverSession({ id: name })), null, `session ${name}`);
    const got = readTake(serverSession({}, [serverLine(1, { id: name }), serverLine(2)]));
    assert.ok(got, name);
    assert.deepEqual(
      got.lines.map((line) => line.id),
      ['l2'],
      `line ${name}`
    );
  }
});

test('a kept copy that names a line or a count like something every object has is not read', () => {
  const typed = typeCount(copyOf(), 'l1', 10000, 2000);
  assert.ok(typed.ok);
  const good = JSON.parse(encodeCopy(typed.copy) as string);
  assert.ok(decodeCopy(JSON.stringify(good), 3000), 'as it was kept, it reads');
  for (const name of ['__proto__', 'constructor']) {
    assert.equal(decodeCopy(JSON.stringify({ ...good, l: [[name, ...good.l[0].slice(1)]] }), 3000), null, `line ${name}`);
    assert.equal(decodeCopy(JSON.stringify({ ...good, p: [[name, ...good.p[0].slice(1)]] }), 3000), null, `count ${name}`);
  }
});

test('a copy belongs to nobody until someone takes it over', () => {
  const fresh = copyOf();
  assert.equal(fresh.ownerId, '');
  const mine = claim(fresh, 'u1');
  assert.equal(mine.ownerId, 'u1');
  assert.equal(claim(mine, 'u1'), mine, 'taking it over twice changes nothing');
  assert.equal(fresh.ownerId, '', 'the copy it came from is not touched');
});

test('a person with counts waiting keeps the copy; a copy with nothing waiting goes to whoever takes it', () => {
  const typed = typeCount(claim(copyOf(), 'u1'), 'l1', 10000, 2000);
  assert.ok(typed.ok);
  const theirs = typed.copy;
  assert.equal(theirs.ownerId, 'u1', 'typing keeps the owner');
  assert.equal(claim(theirs, 'u2'), theirs, 'another person cannot take over counts that wait to be sent');
  assert.equal(claim(afterSent(theirs, 'l1', 10000), 'u2').ownerId, 'u2', 'once nothing waits, the next person may have it');
  assert.equal(claim({ ...theirs, ownerId: '' }, 'u2').ownerId, 'u2', 'a copy kept before owners were recorded is taken over');
});

test('counts waiting on a phone are held back from anyone but the person and the branch they belong to', () => {
  const typed = typeCount(claim(copyOf(), 'u1'), 'l1', 10000, 2000);
  assert.ok(typed.ok);
  const waiting = typed.copy;
  assert.equal(heldBy(waiting, 'b1', 'u1'), null, 'the same person at the same branch');
  assert.equal(heldBy(waiting, 'b1', 'u2'), 'person');
  assert.equal(heldBy(waiting, 'b2', 'u1'), 'branch');
  assert.equal(heldBy(waiting, 'b2', 'u2'), 'branch', 'the branch is said first');
  assert.equal(heldBy(null, 'b1', 'u1'), null);
  assert.equal(heldBy(claim(copyOf(), 'u1'), 'b1', 'u2'), null, 'nothing waiting, nothing held');
  assert.equal(heldBy({ ...waiting, ownerId: '' }, 'b1', 'u2'), null, 'an unclaimed copy is nobody\'s to hold');
});

test('the owner stays through a fresh read of the same stock take, and starts empty for another one', () => {
  const typed = typeCount(claim(copyOf(), 'u1'), 'l1', 10000, 2000);
  assert.ok(typed.ok);
  assert.equal(mergeFresh(typed.copy, take(), 5000).copy.ownerId, 'u1');
  assert.equal(mergeFresh(typed.copy, take({ id: 's2' }), 5000).copy.ownerId, '');
});

test('who a copy belongs to is kept on the phone, and an older copy is read as nobody\'s', () => {
  const mine = claim(copyOf(), 'u1');
  assert.equal(decodeCopy(encodeCopy(mine), 2000)?.ownerId, 'u1');
  const older = JSON.parse(encodeCopy(mine) as string);
  delete older.u;
  assert.equal(decodeCopy(JSON.stringify(older), 2000)?.ownerId, '');
  assert.equal(decodeCopy(JSON.stringify({ ...older, u: 5 }), 2000), null, 'an owner that is not text is not read');
});
