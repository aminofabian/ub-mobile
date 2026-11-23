import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import type { CartItem, CartLine } from '../src/lib/cart';
import { describeRecall, MAX_HELD, type HeldBasket } from '../src/lib/holds';
import { checkPriceEntry, describePriceChange } from '../src/lib/price-entry';
import { prepareRecall } from '../src/lib/recall-flow';
import { pickScanned } from '../src/lib/scan-result';
import {
  describeAddRefusal,
  describeItemsFailure,
  describeLoadedHolds,
  holdRefusalWords,
  HOLD_NOT_SAVED,
  HOLDS_NOT_READ,
  RECALL_REFUSED,
} from '../src/lib/till-words';
import { holderOf } from '../src/lib/till-person';

const MILK: CartItem = { id: 'i-1', name: 'Milk', barcode: '6001', sellingPrice: 130 };
const TEA: CartItem = { id: 'i-2', name: 'Tea', barcode: '6002', sellingPrice: 50 };

test('a price is typed like an amount, above zero, and nothing else is a price', () => {
  assert.deepEqual(checkPriceEntry('120'), { ok: true, cents: 12000 });
  assert.deepEqual(checkPriceEntry(' 1,250.5 '), { ok: true, cents: 125050 });
  assert.deepEqual(checkPriceEntry('0.01'), { ok: true, cents: 1 });
  for (const bad of ['', ' ', 'abc', '12,50', '1e3', '-5', '12.345', '99999999999']) {
    const result = checkPriceEntry(bad);
    assert.equal(result.ok, false, bad);
  }
  const zero = checkPriceEntry('0');
  assert.deepEqual(zero, { ok: false, words: 'The price must be above zero.' });
  assert.match(checkPriceEntry('abc').ok ? '' : (checkPriceEntry('abc') as { words: string }).words, /like 120 or 120.50/);
});

test('a price far from the shelf price is said to be, with how far, so a missing zero is seen', () => {
  assert.deepEqual(describePriceChange(12000, 1200), {
    percent: 90,
    direction: 'lower',
    words: '12.00 is 90% below the shelf price of 120.00',
    large: true,
  });
  assert.deepEqual(describePriceChange(12000, 120000), {
    percent: 900,
    direction: 'higher',
    words: '1,200.00 is 900% above the shelf price of 120.00',
    large: true,
  });
  const small = describePriceChange(12000, 11000);
  assert.deepEqual([small.percent, small.direction, small.large], [8, 'lower', false]);
  assert.equal(describePriceChange(12000, 18000).large, true, 'half as much again is far');
  assert.equal(describePriceChange(12000, 17900).large, false);
  assert.equal(describePriceChange(12000, 6000).large, true, 'half the price is far');
  assert.equal(describePriceChange(12000, 12000).direction, 'same');
  assert.equal(describePriceChange(0, 100).direction, 'same', 'no shelf price to compare with');
});

test('a scan that finds one product with that barcode is rung up, and nothing is ever added on a guess', () => {
  assert.deepEqual(pickScanned([MILK], '6001'), { kind: 'one', item: MILK });
  assert.deepEqual(pickScanned([MILK, TEA], ' 6002 '), { kind: 'one', item: TEA }, 'a scanner may add whitespace');
  assert.deepEqual(pickScanned([], '6001'), { kind: 'none' });
  assert.deepEqual(pickScanned([TEA], '6001'), { kind: 'several', items: [TEA] }, 'a product with another barcode is offered, not added');
  assert.deepEqual(pickScanned([MILK, { ...TEA, barcode: '6001' }], '6001'), { kind: 'several', items: [MILK, { ...TEA, barcode: '6001' }] });
  assert.deepEqual(pickScanned([{ ...MILK, barcode: undefined }], ''), { kind: 'several', items: [{ ...MILK, barcode: undefined }] }, 'an empty scan matches nothing');
});

test('no lookup failure is shown to the cashier as the server\'s own words', () => {
  assert.match(describeItemsFailure(new ApiError('Forbidden', { status: 403 })), /not allowed to look up products/);
  for (const error of [new ApiError('<html>proxy</html>', { status: 502, foreign: true }), new Error('Network request failed'), 'x', null]) {
    assert.match(describeItemsFailure(error), /Check the connection/);
  }
});

test('a basket that could not be held says why, and one that was held says nothing', () => {
  assert.equal(holdRefusalWords({ ok: true, book: { baskets: [] }, basket: {} as HeldBasket }), '');
  assert.match(holdRefusalWords({ ok: false, reason: 'empty' }), /Add something/);
  assert.match(holdRefusalWords({ ok: false, reason: 'full' }), new RegExp(`${MAX_HELD} baskets`));
  assert.match(holdRefusalWords({ ok: false, reason: 'big' }), /100 items at most/);
  assert.match(HOLD_NOT_SAVED, /lost/);
  assert.match(RECALL_REFUSED, /throw one away/);
});

test('a refused add says the limit it hit', () => {
  assert.match(describeAddRefusal(false), /9,999/);
  assert.match(describeAddRefusal(true), /999\.999 kg/);
});

test('a person at a branch owns what they hold there, and no one else does', () => {
  assert.deepEqual(holderOf({ userId: 'u-1', name: 'Ann', permissions: [] }, 'b-1'), { branchId: 'b-1', userId: 'u-1' });
});

const LINE_MILK: CartLine = { itemId: 'i-1', name: 'Milk', quantity: 2, unitPrice: 120 };
const LINE_TEA: CartLine = { itemId: 'i-2', name: 'Tea', quantity: 1, unitPrice: 50 };
const BASKET: HeldBasket = {
  id: 'h-1',
  label: 'Basket 1',
  branchId: 'b-1',
  userId: 'u-1',
  heldAt: '2026-11-23T09:00:00.000Z',
  lines: [LINE_MILK, LINE_TEA],
};

test('a recalled basket is brought up to date line by line, and what changed is said', async () => {
  const asked: string[] = [];
  const { lines, notes } = await prepareRecall(BASKET, async (given) => {
    asked.push(...given.map((line) => line.itemId));
    return { 'i-1': MILK, 'i-2': null };
  });
  assert.deepEqual(asked, ['i-1', 'i-2']);
  assert.deepEqual(lines, [{ ...LINE_MILK, unitPrice: 130 }]);
  assert.deepEqual(notes, ['Milk is now 130.00 (it was 120.00).', 'Tea is no longer for sale, so it was taken out.']);
});

test('when the shop cannot be asked, the basket comes back as it was held, and says so', async () => {
  const { lines, notes } = await prepareRecall(BASKET, async () => {
    throw new ApiError('Bad gateway', { status: 502 });
  });
  assert.deepEqual(lines, [LINE_MILK, LINE_TEA]);
  assert.deepEqual(notes, ['2 prices could not be checked. They stay as they were held.']);
});

test('a basket whose prices are all as held is picked up with nothing to say', async () => {
  const { lines, notes } = await prepareRecall(BASKET, async () => ({ 'i-1': { ...MILK, sellingPrice: 120 }, 'i-2': TEA }));
  assert.deepEqual(lines, [LINE_MILK, LINE_TEA]);
  assert.deepEqual(notes, []);
  assert.deepEqual(describeRecall({ repriced: [], removed: [], unchecked: 0 }), []);
});

test('baskets that were not kept when the phone was read say how many and why, and a clean read says nothing', () => {
  assert.deepEqual(describeLoadedHolds({ expired: 0, damaged: 0 }), []);
  assert.deepEqual(describeLoadedHolds({ expired: 1, damaged: 0 }), ['A held basket was over a day old and was removed.']);
  assert.deepEqual(describeLoadedHolds({ expired: 3, damaged: 2 }), [
    '3 held baskets were over a day old and were removed.',
    '2 held baskets could not be read and were removed.',
  ]);
  assert.deepEqual(describeLoadedHolds({ expired: 0, damaged: 1 }), ['A held basket could not be read and was removed.']);
  assert.match(HOLDS_NOT_READ, /switched off/);
});

test('how far a price is from the shelf price is to the nearest whole percent', () => {
  const lower = describePriceChange(30000, 10000);
  assert.equal(lower.percent, 67);
  assert.match(lower.words, /67% below/);
  assert.equal(describePriceChange(30000, 40000).percent, 33);
});

test('a scan with nothing in it never matches a product that has no barcode', () => {
  const NO_CODE: CartItem = { id: 'i-9', name: 'Loose sweets', barcode: '', sellingPrice: 5 };
  assert.equal(pickScanned([NO_CODE], '').kind, 'several');
  assert.equal(pickScanned([NO_CODE], '   ').kind, 'several');
});
