import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysBetween, readDate, todayOn } from '../src/lib/dates';
import {
  batchTitle,
  canClear,
  clearBody,
  clearPath,
  didClearHappen,
  expiryState,
  expiryWords,
  readSupplyBatches,
  readSupplyDetail,
  statusWords,
  supplyDetailPath,
  supplyListPath,
} from '../src/lib/supply-batches';

function batch(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'sb1',
    batchNumber: 'B-1001',
    batchName: 'Weekly dairy',
    supplierId: 'sup1',
    supplierName: 'Brookside',
    branchId: 'main',
    sourceType: 'path_a_grn',
    receivedAt: '2026-11-20T07:30:00Z',
    status: 'active',
    itemCount: 2,
    itemNames: ['Milk', 'Yoghurt'],
    totalInitialQuantity: 100,
    totalRemainingQuantity: 40.5,
    closedAt: null,
    closedBy: null,
    totalCost: '4500.00',
    totalRevenue: 2000,
    totalAssociatedCosts: 0,
    soldPercentage: 59,
    ...over,
  };
}

test('dates are read as text or as parts, and nothing else', () => {
  assert.equal(readDate('2026-11-23'), '2026-11-23');
  assert.equal(readDate('2026-11-23T10:00:00Z'), '2026-11-23');
  assert.equal(readDate([2026, 1, 5]), '2026-01-05');
  for (const bad of [null, undefined, 'soon', '23/11/2026', [2026, 1], ['a', 'b', 'c'], [2026, 0, 1], 5]) {
    assert.equal(readDate(bad), '', JSON.stringify(bad));
  }
});

test('today is the phone\'s own date, and the distance between dates is in whole days', () => {
  assert.equal(todayOn(new Date(2026, 10, 23, 23, 59).getTime()), '2026-11-23');
  assert.equal(todayOn(new Date(2026, 0, 5, 0, 1).getTime()), '2026-01-05');
  assert.equal(daysBetween('2026-11-23', '2026-11-30'), 7);
  assert.equal(daysBetween('2026-11-23', '2026-11-22'), -1);
  assert.equal(daysBetween('2026-11-23', '2026-11-23'), 0);
  assert.equal(daysBetween('2026-02-28', '2026-03-01'), 1);
  assert.equal(daysBetween('2026-11-23', 'x'), null);
  assert.equal(daysBetween('', '2026-11-23'), null);
});

test('a list of batches is read with its totals', () => {
  const read = readSupplyBatches([batch()]);
  assert.deepEqual(read, [
    {
      id: 'sb1',
      source: 'delivery',
      number: 'B-1001',
      name: 'Weekly dairy',
      supplier: 'Brookside',
      receivedAt: Date.parse('2026-11-20T07:30:00Z'),
      status: 'active',
      itemCount: 2,
      itemNames: ['Milk', 'Yoghurt'],
      initialUnits: 1000000,
      remainingUnits: 405000,
      soldPercent: 59,
      costCents: 450000,
    },
  ]);
});

test('odd rows are left out or read as unknown, never as zero', () => {
  const read = readSupplyBatches([batch({ id: 'a', status: 'weird', soldPercentage: 'lots', totalCost: null, totalRemainingQuantity: 'x', receivedAt: 'when', itemNames: 'none', itemCount: -1 }), null, 'x', batch({ id: '' })]);
  assert.equal(read?.length, 1);
  assert.equal(read?.[0]?.status, 'unknown');
  assert.equal(read?.[0]?.soldPercent, null);
  assert.equal(read?.[0]?.costCents, null);
  assert.equal(read?.[0]?.remainingUnits, null);
  assert.equal(read?.[0]?.receivedAt, null);
  assert.deepEqual(read?.[0]?.itemNames, []);
  for (const bad of [null, undefined, {}, 'x']) assert.equal(readSupplyBatches(bad), null);
  assert.equal(readSupplyBatches(batch({ soldPercentage: 250 }) ? [batch({ soldPercentage: 250 })] : [])?.[0]?.soldPercent, 100);
});

test('a batch with its lots is read in full, and one without a lot list is a failed read', () => {
  const detail = readSupplyDetail({
    ...batch(),
    items: [
      { inventoryBatchId: 'lot1', itemId: 'i1', itemName: 'Milk', itemSku: 'MLK', batchNumber: 'L-1', initialQuantity: 60, quantityRemaining: 20, quantitySold: 35, quantityWasted: 5, unitCost: 48.5, expiryDate: '2026-11-26', status: 'active' },
      { inventoryBatchId: 'lot2', itemId: 'i2', itemName: 'Yoghurt', quantityRemaining: 0, expiryDate: null },
      { inventoryBatchId: '', itemName: 'No lot' },
      null,
    ],
  });
  assert.ok(detail);
  assert.equal(detail.items.length, 2);
  assert.deepEqual(detail.items[0], { id: 'lot1', itemId: 'i1', name: 'Milk', sku: 'MLK', lot: 'L-1', initialUnits: 600000, remainingUnits: 200000, soldUnits: 350000, wastedUnits: 50000, unitCostCents: 4850, expiry: '2026-11-26' });
  assert.equal(detail.items[1]?.expiry, null);
  assert.equal(detail.items[1]?.initialUnits, null);
  assert.equal(readSupplyDetail(batch()), null);
  assert.equal(readSupplyDetail({ items: [] }), null);
  assert.equal(readSupplyDetail(null), null);
});

test('a lot is judged against today, and a lot with nothing left worries nobody', () => {
  const lot = (expiry: string | null, remaining: number | null) => ({ expiry, remainingUnits: remaining });
  assert.equal(expiryState(lot('2026-11-22', 10000), '2026-11-23'), 'expired');
  assert.equal(expiryState(lot('2026-11-23', 10000), '2026-11-23'), 'soon');
  assert.equal(expiryState(lot('2026-11-30', 10000), '2026-11-23'), 'soon');
  assert.equal(expiryState(lot('2026-12-01', 10000), '2026-11-23'), 'ok');
  assert.equal(expiryState(lot('2026-11-01', 0), '2026-11-23'), 'none');
  assert.equal(expiryState(lot('2026-11-01', null), '2026-11-23'), 'none');
  assert.equal(expiryState(lot(null, 10000), '2026-11-23'), 'none');
  assert.equal(expiryState(lot('2026-11-30', 10000), 'today'), 'none');
});

test('expiry has words a person can read', () => {
  const lot = (expiry: string | null) => ({ expiry, remainingUnits: 10000 });
  assert.equal(expiryWords(lot('2026-11-22'), '2026-11-23'), 'Expired yesterday');
  assert.equal(expiryWords(lot('2026-11-20'), '2026-11-23'), 'Expired 3 days ago');
  assert.equal(expiryWords(lot('2026-11-23'), '2026-11-23'), 'Expires today');
  assert.equal(expiryWords(lot('2026-11-24'), '2026-11-23'), 'Expires tomorrow');
  assert.equal(expiryWords(lot('2026-11-28'), '2026-11-23'), 'Expires in 5 days');
  assert.equal(expiryWords(lot('2027-03-01'), '2026-11-23'), 'Expires in 98 days');
  assert.equal(expiryWords(lot(null), '2026-11-23'), '');
});

test('paths carry only the filters that are set', () => {
  assert.equal(supplyListPath({}), '/api/v1/inventory/supply-batches');
  assert.equal(supplyListPath({ branchId: 'main' }), '/api/v1/inventory/supply-batches?branchId=main');
  assert.equal(supplyListPath({ branchId: 'a b', status: 'active' }), '/api/v1/inventory/supply-batches?branchId=a%20b&status=active');
  assert.equal(supplyListPath({ status: 'unknown' }), '/api/v1/inventory/supply-batches');
  assert.equal(supplyDetailPath('sb 1'), '/api/v1/inventory/supply-batches/sb%201');
  assert.equal(clearPath('sb1'), '/api/v1/inventory/supply-batches/sb1/clear');
});

test('only a batch with stock left can be cleared, by someone who may write stock', () => {
  assert.equal(canClear({ status: 'active', remainingUnits: 100 }, true), true);
  assert.equal(canClear({ status: 'active', remainingUnits: 100 }, false), false);
  assert.equal(canClear({ status: 'active', remainingUnits: 0 }, true), false);
  assert.equal(canClear({ status: 'active', remainingUnits: null }, true), false);
  for (const status of ['soldout', 'clearing', 'closed', 'unknown'] as const) {
    assert.equal(canClear({ status, remainingUnits: 100 }, true), false, status);
  }
});

test('the clear body has the reason and, when given, the note', () => {
  assert.deepEqual(clearBody('EXPIRED'), { reason: 'EXPIRED' });
  assert.deepEqual(clearBody('EXPIRED', '  fridge failed '), { reason: 'EXPIRED', notes: 'fridge failed' });
  assert.deepEqual(clearBody('OTHER', '   '), { reason: 'OTHER' });
});

test('after a clear with no answer, a batch that is clearing or closed says it happened', () => {
  assert.equal(didClearHappen({ status: 'clearing' }), 'done');
  assert.equal(didClearHappen({ status: 'closed' }), 'done');
  assert.equal(didClearHappen({ status: 'active' }), 'not_done');
  assert.equal(didClearHappen({ status: 'soldout' }), 'unclear');
  assert.equal(didClearHappen(undefined), 'unclear');
});

test('a batch is called by its name, else its number, else its supplier', () => {
  assert.equal(batchTitle({ name: 'Weekly dairy', number: 'B-1', supplier: 'Brookside' }), 'Weekly dairy');
  assert.equal(batchTitle({ name: '', number: 'B-1', supplier: 'Brookside' }), 'Batch B-1');
  assert.equal(batchTitle({ name: '', number: '', supplier: 'Brookside' }), 'Brookside');
  assert.equal(batchTitle({ name: '', number: '', supplier: '' }), 'Delivery');
  assert.equal(statusWords('soldout'), 'Sold out');
  assert.equal(statusWords('unknown'), 'Unknown');
});

test('a batch id may be up to sixty-four characters, and a longer one is not an id', () => {
  assert.equal(readSupplyBatches([batch({ id: 'x'.repeat(64) })])?.[0]?.id, 'x'.repeat(64));
  assert.deepEqual(readSupplyBatches([batch({ id: 'x'.repeat(65) })]), []);
});

test('each state of a batch is read as itself, and anything else as unknown', () => {
  for (const status of ['active', 'soldout', 'clearing', 'closed']) {
    assert.equal(readSupplyBatches([batch({ status })])?.[0]?.status, status);
  }
  for (const status of ['ACTIVE', 'weird', '', null, 5]) assert.equal(readSupplyBatches([batch({ status })])?.[0]?.status, 'unknown', String(status));
});

test('the share sold is kept between nothing and all of it, and is unknown when it is not a number', () => {
  const sold = (soldPercentage: unknown) => readSupplyBatches([batch({ soldPercentage })])?.[0]?.soldPercent;
  assert.equal(sold(59.4), 59);
  assert.equal(sold(150), 100);
  assert.equal(sold(-20), 0);
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '59', null]) assert.equal(sold(bad), null, String(bad));
});

test('the number of items is what the server says when it is a count, and the names listed when it is not', () => {
  const count = (itemCount: unknown) => readSupplyBatches([batch({ itemCount, itemNames: ['Milk', 'Yoghurt'] })])?.[0]?.itemCount;
  assert.equal(count(7), 7);
  assert.equal(count(0), 0);
  for (const bad of [1.5, -3, '5', null]) assert.equal(count(bad), 2, String(bad));
});

test('an answer with no batch id is not a batch, even with lots', () => {
  assert.equal(readSupplyDetail({ items: [] }), null);
  assert.equal(readSupplyDetail({ ...batch(), id: '', items: [] }), null);
  assert.equal(readSupplyDetail(null), null);
});

test('a lot with nothing left, or with no date, has no words about its date', () => {
  const today = '2026-11-23';
  assert.equal(expiryWords({ expiry: today, remainingUnits: 0 }, today), '');
  assert.equal(expiryWords({ expiry: today, remainingUnits: null }, today), '');
  assert.equal(expiryWords({ expiry: null, remainingUnits: 50000 }, today), '');
  assert.equal(expiryWords({ expiry: today, remainingUnits: 50000 }, today), 'Expires today');
});
