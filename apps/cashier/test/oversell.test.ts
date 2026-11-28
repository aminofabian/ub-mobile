import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLAG, maySellWhenOutOfStock, parseShopFlags } from '../src/lib/shop-flags';

test('a shop that has never set the oversell rule sells from an empty shelf', () => {
  assert.equal(maySellWhenOutOfStock(parseShopFlags({ name: 'Test' })), true);
  assert.equal(maySellWhenOutOfStock(parseShopFlags({ inventory: {} })), true);
  assert.equal(maySellWhenOutOfStock(parseShopFlags({ inventory: { stockLevels: {} } })), true);
});

test('an owner who turned overselling off closes it for the till', () => {
  const flags = parseShopFlags({ inventory: { stockLevels: { allowNegativeStock: false } } });
  assert.equal(maySellWhenOutOfStock(flags), false);
  assert.equal(flags[FLAG.allowOutOfStock], false);
});

test('an owner who turned overselling on leaves it open', () => {
  const flags = parseShopFlags({ inventory: { stockLevels: { allowNegativeStock: true } } });
  assert.equal(maySellWhenOutOfStock(flags), true);
});

test('a value that is not a boolean does not close the door', () => {
  // Only an explicit false blocks: the web reads the same setting the same way.
  assert.equal(maySellWhenOutOfStock(parseShopFlags({ inventory: { stockLevels: { allowNegativeStock: 'no' } } })), true);
  assert.equal(maySellWhenOutOfStock(parseShopFlags({ inventory: { stockLevels: { allowNegativeStock: 0 } } })), true);
  assert.equal(maySellWhenOutOfStock(parseShopFlags({ inventory: 'nonsense' })), true);
});

test('a feature flag cannot pass itself off as the shop setting', () => {
  const flags = parseShopFlags({
    featureFlags: { 'kiosk.allow_out_of_stock': true },
    inventory: { stockLevels: { allowNegativeStock: false } },
  });
  assert.equal(maySellWhenOutOfStock(flags), false, 'the setting decides, not a flag of the same name');
});
