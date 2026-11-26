import assert from 'node:assert/strict';
import test from 'node:test';
import { basketProblemWords, type SaleItem } from '../src/lib/basket';
import { planPick, typedQuantity, unitsFromThousandths } from '../src/lib/pick';

const ONE = 10_000;
const SUGAR: SaleItem = { id: 'i1', name: 'Sugar', variantName: null, weighed: false, unitType: null, active: true, sellable: true, sellingCents: 19900 };
const TOMATOES: SaleItem = { ...SUGAR, id: 'i2', name: 'Tomatoes', weighed: true, unitType: 'kg', sellingCents: 12000 };

test('one of a thing sold one by one goes straight in', () => {
  assert.deepEqual(planPick(SUGAR), { kind: 'add', units: ONE });
});

test('a thing sold by weight asks how much', () => {
  assert.deepEqual(planPick(TOMATOES), { kind: 'weigh' });
});

test('a thing that cannot be sold says so, and a weighed one is not asked a weight first', () => {
  assert.deepEqual(planPick({ ...SUGAR, active: false }), { kind: 'refuse', why: 'not_for_sale' });
  assert.deepEqual(planPick({ ...SUGAR, sellable: false }), { kind: 'refuse', why: 'not_for_sale' });
  assert.deepEqual(planPick({ ...SUGAR, sellingCents: null }), { kind: 'refuse', why: 'no_price' });
  assert.deepEqual(planPick({ ...SUGAR, sellingCents: 0 }), { kind: 'refuse', why: 'no_price' });
  assert.deepEqual(planPick({ ...TOMATOES, sellingCents: null }), { kind: 'refuse', why: 'no_price' });
  assert.deepEqual(planPick({ ...TOMATOES, active: false }), { kind: 'refuse', why: 'not_for_sale' });
  for (const why of ['not_for_sale', 'no_price'] as const) assert.ok(basketProblemWords[why].length > 0);
});

test('WeightSheet thousandths become basket ten-thousandths (1 kg is 10_000, not 1_000)', () => {
  assert.equal(unitsFromThousandths(1000), ONE);
  assert.equal(unitsFromThousandths(250), 2_500);
  assert.equal(unitsFromThousandths(1), 10);
});

test('a quantity typed in a box is read to four decimals, and wrong ones say what is wrong', () => {
  assert.deepEqual(typedQuantity('2.5'), { ok: true, units: 25_000 });
  assert.deepEqual(typedQuantity(' 3 '), { ok: true, units: 30_000 });
  assert.deepEqual(typedQuantity('0.125'), { ok: true, units: 1_250 });
  assert.deepEqual(typedQuantity(''), { ok: false, words: 'Enter a quantity.' });
  assert.deepEqual(typedQuantity('0'), { ok: false, words: 'The quantity must be above zero.' });
  assert.deepEqual(typedQuantity('abc'), { ok: false, words: 'Use digits and a point, like 2.5.' });
  assert.deepEqual(typedQuantity('2,5'), { ok: false, words: 'Use digits and a point, like 2.5.' });
  assert.deepEqual(typedQuantity('1.00001'), { ok: false, words: 'Four decimals at most, like 0.125.' });
  assert.deepEqual(typedQuantity('99999999'), { ok: false, words: 'That is over a million. Check the number.' });
});
