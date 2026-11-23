import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FLAG,
  mayAdvanceWebOrders,
  mayChangePrice,
  mayCreateProduct,
  mayListWebOrders,
  mayMarkWeighed,
  parseShopFlags,
  PERMISSION,
} from '../src/lib/shop-flags';

const NONE: string[] = [];

test('the flags are read from the shop record, booleans only', () => {
  assert.deepEqual(
    parseShopFlags({ featureFlags: { 'pos.cashier_price_edit': true, 'pos.cashier_drawout': false, other_flag: true } }),
    { 'pos.cashier_price_edit': true, 'pos.cashier_drawout': false, other_flag: true }
  );
});

test('a flag that is not a real boolean is not on', () => {
  const flags = parseShopFlags({
    featureFlags: { a: 'true', b: 1, c: null, d: {}, e: [], f: true, 'bad name': true, '': true, ['x'.repeat(81)]: true },
  });
  assert.deepEqual(flags, { f: true });
});

test('a shop record with no flags, or a body that is not one, has none on', () => {
  for (const body of [null, undefined, 'x', 7, [], {}, { featureFlags: null }, { featureFlags: 'x' }, { featureFlags: [true] }]) {
    assert.deepEqual(parseShopFlags(body), {}, JSON.stringify(body));
  }
});

test('no more than a couple of hundred flags are read', () => {
  const many = Object.fromEntries(Array.from({ length: 500 }, (_, n) => [`flag.${n}`, true]));
  assert.equal(Object.keys(parseShopFlags({ featureFlags: many })).length, 200);
});

test('a price can be changed by the right to, or where the shop lets cashiers', () => {
  assert.equal(mayChangePrice({}, NONE), false);
  assert.equal(mayChangePrice({ [FLAG.priceEdit]: true }, NONE), true);
  assert.equal(mayChangePrice({ [FLAG.priceEdit]: false }, NONE), false);
  assert.equal(mayChangePrice({}, [PERMISSION.setPrice]), true);
  assert.equal(mayChangePrice({ [FLAG.priceEdit]: false }, [PERMISSION.setPrice]), true, 'the right does not need the setting');
  assert.equal(mayChangePrice({}, [PERMISSION.sell]), false, 'selling is not the right to change a price');
  assert.equal(mayChangePrice({ [FLAG.createProduct]: true }, NONE), false, 'creating products is not changing prices');
});

test('a product can be added where the server would take it', () => {
  assert.equal(mayCreateProduct({}, NONE), false);
  assert.equal(mayCreateProduct({ [FLAG.createProduct]: true }, NONE), true, 'the setting alone is enough');
  assert.equal(mayCreateProduct({}, [PERMISSION.writeCatalog]), false, 'writing the catalogue with no way to price it');
  assert.equal(mayCreateProduct({ [FLAG.priceEdit]: true }, [PERMISSION.writeCatalog]), true);
  assert.equal(mayCreateProduct({}, [PERMISSION.writeCatalog, PERMISSION.setPrice]), true);
  assert.equal(mayCreateProduct({ [FLAG.priceEdit]: true }, NONE), false, 'pricing alone does not write the catalogue');
  assert.equal(mayCreateProduct({}, [PERMISSION.setPrice]), false);
  assert.equal(mayCreateProduct({ [FLAG.createProduct]: false }, NONE), false);
});

test('marking a product as sold by weight is on unless the owner turned it off', () => {
  assert.equal(mayMarkWeighed({}, NONE), true, 'absent means on');
  assert.equal(mayMarkWeighed({ [FLAG.weighedToggle]: true }, NONE), true);
  assert.equal(mayMarkWeighed({ [FLAG.weighedToggle]: false }, NONE), false);
  assert.equal(mayMarkWeighed({ [FLAG.weighedToggle]: false }, [PERMISSION.writeCatalog]), true, 'the right overrides');
});

test('web orders: who can see the list and who can move an order along', () => {
  assert.equal(mayListWebOrders(NONE), false);
  assert.equal(mayListWebOrders([PERMISSION.sell]), false, 'a cashier cannot list them');
  assert.equal(mayListWebOrders([PERMISSION.readWebOrders]), true);
  assert.equal(mayAdvanceWebOrders([PERMISSION.sell]), true);
  assert.equal(mayAdvanceWebOrders([PERMISSION.readWebOrders]), true);
  assert.equal(mayAdvanceWebOrders(NONE), false);
  assert.equal(mayAdvanceWebOrders([PERMISSION.setPrice]), false);
});

test('the names are the ones the server uses', () => {
  assert.equal(FLAG.priceEdit, 'pos.cashier_price_edit');
  assert.equal(FLAG.createProduct, 'pos.cashier_create_product');
  assert.equal(FLAG.weighedToggle, 'pos.cashier_weighed_toggle');
  assert.equal(PERMISSION.setPrice, 'pricing.sell_price.set');
  assert.equal(PERMISSION.writeCatalog, 'catalog.items.write');
  assert.equal(PERMISSION.readWebOrders, 'storefront.orders.read');
  assert.equal(PERMISSION.sell, 'sales.sell');
});
