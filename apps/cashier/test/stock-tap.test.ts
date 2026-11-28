import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stockTap } from '../src/lib/stock-tap';

test('a product on the shelf is added on the first tap', () => {
  assert.equal(stockTap({ out: false, armed: false, allowOutOfStock: false }), 'add');
  assert.equal(stockTap({ out: false, armed: false, allowOutOfStock: true }), 'add');
});

test('an empty shelf asks first when the shop has not allowed overselling', () => {
  assert.equal(stockTap({ out: true, armed: false, allowOutOfStock: false }), 'arm');
  // already asked: the second tap sells it
  assert.equal(stockTap({ out: true, armed: true, allowOutOfStock: false }), 'add');
});

test('an empty shelf is one tap when the shop allows selling it', () => {
  assert.equal(stockTap({ out: true, armed: false, allowOutOfStock: true }), 'add');
  assert.equal(stockTap({ out: true, armed: true, allowOutOfStock: true }), 'add');
});
