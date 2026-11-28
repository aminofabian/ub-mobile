import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FLAG,
  mayAdvanceWebOrders,
  mayChangePrice,
  mayCreateProduct,
  mayListWebOrders,
  mayMarkWeighed,
  mayShowServices,
  encodeStoredFlags,
  parseShopFlags,
  parseStoredFlags,
  PERMISSION,
  STORED_FLAGS_LIFETIME_MS,
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

const NOON = Date.parse('2026-11-23T12:00:00.000Z');

test('the settings kept on the phone come back as they were, while they are recent', () => {
  const flags = { [FLAG.priceEdit]: true, [FLAG.createProduct]: false };
  const text = encodeStoredFlags(flags, NOON);
  assert.deepEqual(parseStoredFlags(text, NOON), flags);
  assert.deepEqual(parseStoredFlags(text, NOON + 60_000), flags);
  assert.deepEqual(parseStoredFlags(text, NOON + STORED_FLAGS_LIFETIME_MS), flags, 'on the last day it is still believed');
  assert.equal(parseStoredFlags(text, NOON + STORED_FLAGS_LIFETIME_MS + 1), null, 'a week later it is not');
});

test('settings from the future, or of no known age, are not believed', () => {
  assert.equal(parseStoredFlags(encodeStoredFlags({ a: true }, NOON + 1), NOON), null);
  assert.equal(parseStoredFlags('{"v":1,"flags":{"a":true}}', NOON), null);
  assert.equal(parseStoredFlags('{"v":1,"at":"1","flags":{"a":true}}', NOON), null);
});

test('settings written by another version of the app are not believed, however fresh they are', () => {
  assert.equal(parseStoredFlags(`{"v":2,"at":${NOON},"flags":{"a":true}}`, NOON), null);
  assert.equal(parseStoredFlags(`{"at":${NOON},"flags":{"a":true}}`, NOON), null, 'no version');
  assert.deepEqual(parseStoredFlags(`{"v":1,"at":${NOON},"flags":{"a":true}}`, NOON), { a: true });
});

test('what the shop said is believed for a week, to the millisecond', () => {
  assert.equal(STORED_FLAGS_LIFETIME_MS, 7 * 24 * 60 * 60 * 1000);
  const text = encodeStoredFlags({ a: true }, NOON);
  assert.deepEqual(parseStoredFlags(text, NOON + STORED_FLAGS_LIFETIME_MS), { a: true });
  assert.equal(parseStoredFlags(text, NOON + STORED_FLAGS_LIFETIME_MS + 1), null);
});

test('settings that cannot be read are not believed, and are never an error', () => {
  for (const text of [null, '', 'nope', '[]', '"x"', '12', 'null', '{}', '{"v":2,"at":1,"flags":{}}', '{"at":1,"flags":{}}']) {
    assert.equal(parseStoredFlags(text, NOON), null, String(text));
  }
});

test('what is kept is read as the shop\'s own settings are: only plain true and false', () => {
  const text = `{"v":1,"at":${NOON},"flags":{"a":true,"b":"true","c":1,"bad name":true,"d":false}}`;
  assert.deepEqual(parseStoredFlags(text, NOON), { a: true, d: false });
  assert.deepEqual(parseStoredFlags(`{"v":1,"at":${NOON},"flags":[true]}`, NOON), {});
});

test('whole milliseconds are kept, never a fraction', () => {
  assert.equal(JSON.parse(encodeStoredFlags({}, 1.9)).at, 1);
});

test('the permission that lets a person throw away a paid sale is the server\'s own key', () => {
  assert.equal(PERMISSION.voidAny, 'sales.void.any');
});

test('a shop that runs a service format is marked as selling services: by the till, from the shop record', () => {
  for (const storeTypes of [['salon'], ['mini-mart', 'barbershop'], ['SPA'], [' nail-studio '], ['beauty-parlour', 'cafe']]) {
    assert.equal(parseShopFlags({ profile: { storeTypes } })[FLAG.sellsServices], true, storeTypes.join());
  }
});

test('a shop with no service format is not marked', () => {
  for (const storeTypes of [['mini-mart'], ['restaurant', 'lodging'], [], ['clinic'], ['supplier'], ['pharmacy', 'wines-spirits'], ['hair salon']]) {
    assert.equal(FLAG.sellsServices in parseShopFlags({ profile: { storeTypes } }), false, storeTypes.join());
  }
});

test('the first format the shop chose is read when it lists none, and the list wins when it lists some', () => {
  assert.equal(parseShopFlags({ profile: { storeType: 'salon' } })[FLAG.sellsServices], true);
  assert.equal(parseShopFlags({ profile: { storeType: 'salon', storeTypes: [] } })[FLAG.sellsServices], true);
  assert.equal(FLAG.sellsServices in parseShopFlags({ profile: { storeType: 'salon', storeTypes: ['mini-mart'] } }), false);
});

test('a list of formats with nothing readable in it leaves the format the shop started with to speak', () => {
  const marked = (profile: unknown) => parseShopFlags({ profile })[FLAG.sellsServices] === true;
  assert.equal(marked({ storeTypes: [1, null, {}], storeType: 'salon' }), true);
  assert.equal(marked({ storeTypes: ['  ', ''], storeType: 'salon' }), true, 'blank formats are no formats');
  assert.equal(marked({ storeTypes: ['  '], storeType: '  ' }), false);
  assert.equal(marked({ storeTypes: ['mini-mart', '  '], storeType: 'salon' }), false, 'one readable format is a list');
  // A profile with only blanks names nothing, so the setup answers are read.
  assert.equal(parseShopFlags({ profile: { storeTypes: ['  '], storeType: ' ' }, onboarding: { answers: { storeType: 'salon' } } })[FLAG.sellsServices], true);
});

test('a profile that is not one marks nothing', () => {
  for (const profile of [null, undefined, 'salon', 7, [], ['salon'], { storeTypes: 'salon' }, { storeTypes: [1, null, {}] }, { storeType: 5 }]) {
    assert.deepEqual(parseShopFlags({ profile }), {}, JSON.stringify(profile));
  }
});

test('the formats and the shop settings are read together', () => {
  assert.deepEqual(parseShopFlags({ featureFlags: { 'pos.cashier_price_edit': true }, profile: { storeTypes: ['salon'] } }), {
    'pos.cashier_price_edit': true,
    [FLAG.sellsServices]: true,
  });
});

test('the shop\'s setup answers say which formats it runs when its profile names none, as on the web', () => {
  const marked = (body: unknown) => parseShopFlags(body)[FLAG.sellsServices] === true;
  assert.equal(marked({ onboarding: { answers: { storeTypes: ['salon'] } } }), true);
  assert.equal(marked({ onboarding: { answers: { storeType: 'spa' } } }), true, 'the format the shop started with');
  assert.equal(marked({ profile: {}, onboarding: { answers: { storeTypes: ['barbershop'] } } }), true);
  assert.equal(marked({ profile: { storeTypes: [] }, onboarding: { answers: { storeTypes: ['barbershop'] } } }), true);
  // The profile wins when it names any format, in either direction.
  assert.equal(marked({ profile: { storeTypes: ['mini-mart'] }, onboarding: { answers: { storeTypes: ['salon'] } } }), false);
  assert.equal(marked({ profile: { storeTypes: ['salon'] }, onboarding: { answers: { storeTypes: ['mini-mart'] } } }), true);
  assert.equal(marked({ onboarding: { answers: { storeTypes: ['mini-mart'] } } }), false);
  for (const onboarding of [null, undefined, 'salon', 7, [], { answers: null }, { answers: 'salon' }, { answers: { storeTypes: 'salon' } }, { answers: { storeTypes: [1, null] } }]) {
    assert.equal(marked({ onboarding }), false, JSON.stringify(onboarding));
  }
});

test('a setting of the till\'s own name that the server sends is not believed: the mark comes from the formats alone', () => {
  assert.deepEqual(parseShopFlags({ featureFlags: { [FLAG.sellsServices]: true } }), {}, 'a shop that is not a service shop is not made one');
  assert.deepEqual(parseShopFlags({ featureFlags: { [FLAG.sellsServices]: false }, profile: { storeTypes: ['salon'] } }), { [FLAG.sellsServices]: true });
  assert.deepEqual(parseShopFlags({ featureFlags: { [FLAG.sellsServices]: true }, profile: { storeTypes: ['mini-mart'] } }), {});
});

test('the mark is never the one that is cut when the shop has a great many settings, here or when read back from the phone', () => {
  const many = Object.fromEntries(Array.from({ length: 500 }, (_, n) => [`flag.number_${n}`, true]));
  const flags = parseShopFlags({ featureFlags: many, profile: { storeTypes: ['salon'] } });
  assert.equal(Object.keys(flags).length, 201, 'the most settings that are read, and the mark');
  assert.equal(flags[FLAG.sellsServices], true);
  const now = Date.parse('2026-11-23T10:00:00.000Z');
  const kept = parseStoredFlags(encodeStoredFlags(flags, now), now + 1000);
  assert.equal(kept?.[FLAG.sellsServices], true, 'still there when the phone gives it back');
  assert.equal(Object.keys(kept ?? {}).length, 201, 'and nothing was lost or added on the way');
  assert.deepEqual(kept, flags);
});

test('the mark is kept on the phone with the other settings, and believed again from there', () => {
  const now = Date.parse('2026-11-23T10:00:00.000Z');
  const flags = parseShopFlags({ profile: { storeTypes: ['salon'] } });
  const kept = parseStoredFlags(encodeStoredFlags(flags, now), now + 1000);
  assert.equal(kept?.[FLAG.sellsServices], true);
});

test('services are offered to a person who may sell in a shop that sells them, and to no one else', () => {
  const marked = { [FLAG.sellsServices]: true };
  assert.equal(mayShowServices(marked, [PERMISSION.sell]), true);
  assert.equal(mayShowServices(marked, NONE), false, 'a person who may not sell');
  assert.equal(mayShowServices({}, [PERMISSION.sell]), false, 'a shop that does not sell services');
  assert.equal(mayShowServices({ [FLAG.sellsServices]: false }, [PERMISSION.sell]), false);
});

// The server's own shop formats (StoreTypeCodes), and the ones it counts as service formats (ADR 0014).
const SERVER_FORMATS = [
  'butchery', 'mini-mart', 'full-grocery', 'fresh-market', 'mixed-shop', 'cosmetics', 'wines-spirits', 'pharmacy', 'other',
  'barbershop', 'salon', 'spa', 'nail-studio', 'beauty-parlour', 'restaurant', 'cafe', 'fast-food', 'bar', 'lodging', 'clinic', 'supplier',
];
const SERVER_SERVICE_FORMATS = ['barbershop', 'salon', 'spa', 'nail-studio', 'beauty-parlour'];

test('of every shop format the server has, exactly its service formats mark a shop as selling services', () => {
  for (const format of SERVER_FORMATS) {
    const says = parseShopFlags({ profile: { storeTypes: [format] } })[FLAG.sellsServices] === true;
    assert.equal(says, SERVER_SERVICE_FORMATS.includes(format), format);
    const saysAtStart = parseShopFlags({ profile: { storeType: format } })[FLAG.sellsServices] === true;
    assert.equal(saysAtStart, SERVER_SERVICE_FORMATS.includes(format), `${format} as the format the shop started with`);
  }
});
