import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemWords } from '../src/lib/item-words';

test('a counted product says its price and what is on the shelf', () => {
  assert.deepEqual(itemWords({ id: 'i-1', name: 'Milk', sellingPrice: 130, stockOnHand: 12 }), {
    price: '130.00',
    stock: '12 in stock',
    byWeight: false,
  });
  assert.deepEqual(itemWords({ id: 'i-1', name: 'Milk', sellingPrice: 1250.5 }), { price: '1,250.50', byWeight: false });
});

test('a weighed product says its price per kilogram and its stock in kilograms', () => {
  assert.deepEqual(itemWords({ id: 'i-2', name: 'Beef', sellingPrice: 650, weighed: true, unitType: 'kg', stockOnHand: 12.5 }), {
    price: '650.00 per kg',
    stock: '12.5 kg in stock',
    byWeight: true,
  });
});

test('a product with nothing on the shelf says so, and can still be tapped: the till\'s stock may be old', () => {
  for (const stockOnHand of [0, -3, Number.NaN]) {
    const words = itemWords({ id: 'i-1', name: 'Milk', sellingPrice: 130, stockOnHand });
    assert.equal(words.stock, 'Out of stock', String(stockOnHand));
    assert.equal(words.blocked, undefined);
  }
});

test('a part of a unit is shown as it is, to three decimals', () => {
  assert.equal(itemWords({ id: 'i-1', name: 'Sugar', sellingPrice: 10, stockOnHand: 2.5 }).stock, '2.5 in stock');
  assert.equal(itemWords({ id: 'i-1', name: 'Sugar', sellingPrice: 10, stockOnHand: 2.12345 }).stock, '2.123 in stock');
});

test('a product that cannot be rung up as it stands says why, in the cashier\'s words', () => {
  assert.match(itemWords({ id: 'i-3', name: 'Flour', sellingPrice: 10, weighed: true, unitType: 'g' }).blocked ?? '', /priced per g/);
  assert.match(itemWords({ id: 'i-4', name: 'Eggs tray', sellingPrice: 400, weighed: true, packageVariant: true }).blocked ?? '', /sold as a pack/);
  const unpriced = itemWords({ id: 'i-5', name: 'New', sellingPrice: 0 });
  assert.equal(unpriced.price, '-');
  assert.match(unpriced.blocked ?? '', /no price/);
});

test('a weighed product with more than a scale holds, or too little to weigh, is still in stock', () => {
  const beef = { id: 'i-2', name: 'Beef', sellingPrice: 650, weighed: true, unitType: 'kg' };
  assert.equal(itemWords({ ...beef, stockOnHand: 2000 }).stock, 'In stock');
  assert.equal(itemWords({ ...beef, stockOnHand: 0.0001 }).stock, 'In stock');
});

test('a product marked as weighed that cannot be weighed here is not priced per kg', () => {
  const words = itemWords({ id: 'i-3', name: 'Flour', sellingPrice: 120, weighed: true, unitType: 'g' });
  assert.equal(words.byWeight, false);
  assert.equal(words.price, '120.00');
  assert.ok(words.blocked);
});
