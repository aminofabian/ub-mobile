import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import {
  checkProduct,
  describeCreateFailure,
  EMPTY_FORM,
  parseItemTypes,
  weighedFailureWords,
  type ItemType,
  type ProductForm,
} from '../src/lib/quick-product';

const TYPES: ItemType[] = [
  { id: 't-1', name: 'Groceries' },
  { id: 't-2', name: 'Meat' },
];

function form(change: Partial<ProductForm> = {}): ProductForm {
  return { ...EMPTY_FORM, name: 'Beef fillet', price: '650', typeId: 't-2', ...change };
}

/** A kind as the server sends it (`ItemTypeResponse`). */
const served = (id: string, label: string, more: Record<string, unknown> = {}) => ({
  id,
  key: label.toLowerCase(),
  label,
  icon: null,
  color: null,
  sortOrder: 0,
  active: true,
  isDefault: false,
  defaultMarkupPct: null,
  ...more,
});

test('the kinds of product are read as the server sends them: a bare list of rows with a label', () => {
  assert.deepEqual(parseItemTypes([served('t-2', 'Meat'), served('t-1', 'Groceries')]), TYPES);
});

test('a kind the owner has switched off is not offered, and one with no word about it is', () => {
  assert.deepEqual(parseItemTypes([served('t-1', 'Groceries'), served('t-9', 'Old range', { active: false })]), [TYPES[0]]);
  assert.deepEqual(parseItemTypes([{ id: 't-1', label: 'Groceries' }]), [TYPES[0]]);
  assert.deepEqual(parseItemTypes([served('t-1', 'Groceries', { active: 'no' })]), [TYPES[0]], 'only a real false switches it off');
});

test('an older shape that said name is still read, and a label wins over a name', () => {
  assert.deepEqual(parseItemTypes([{ id: 't-2', name: 'Meat' }, { id: 't-1', name: 'Groceries' }]), TYPES);
  assert.deepEqual(parseItemTypes([{ id: 't-1', label: 'Groceries', name: 'Old name' }]), [TYPES[0]]);
});

test('the kinds are read from a page too, sorted, and rows that are not kinds are left out', () => {
  assert.deepEqual(parseItemTypes({ content: [served('t-1', 'Groceries')] }), [TYPES[0]]);
  assert.deepEqual(parseItemTypes([null, 'x', {}, { id: '', label: 'x' }, { id: 't-3' }, { id: 't-4', label: '  ' }, { id: 7, label: 'x' }]), []);
  for (const nothing of [null, undefined, 'x', 7, {}, { content: 'no' }]) assert.deepEqual(parseItemTypes(nothing), []);
  assert.equal(parseItemTypes([served('t-1', 'Gro‮ceries\n')])[0]?.name, 'Groceries');
  assert.equal(parseItemTypes([served('x'.repeat(65), 'Long id')]).length, 0);
});

test('a product with a name, a kind and a price is what the server takes, at this branch', () => {
  assert.deepEqual(checkProduct(form(), 'b-1', TYPES), {
    ok: true,
    byWeight: false,
    body: { name: 'Beef fillet', itemTypeId: 't-2', branchId: 'b-1', unitType: 'each', unitPrice: 650 },
  });
});

test('everything optional is sent when given, and only then', () => {
  const full = checkProduct(
    form({ price: '1,250.50', cost: '900', barcode: ' 6001234567890 ', stock: '24', name: '  Cooking   oil  ' }),
    'b-1',
    TYPES
  );
  assert.deepEqual(full, {
    ok: true,
    byWeight: false,
    body: {
      name: 'Cooking oil',
      itemTypeId: 't-2',
      branchId: 'b-1',
      unitType: 'each',
      unitPrice: 1250.5,
      buyingPrice: 900,
      barcode: '6001234567890',
      initialStockQty: 24,
    },
  });
  const zeroCost = checkProduct(form({ cost: '0' }), 'b-1', TYPES);
  assert.equal(zeroCost.ok && 'buyingPrice' in zeroCost.body, false, 'a cost of nothing is no cost');
});

test('a product sold by weight is priced per kilogram and stocked in kilograms', () => {
  const result = checkProduct(form({ byWeight: true, stock: '12.5' }), 'b-1', TYPES);
  assert.deepEqual(result, {
    ok: true,
    byWeight: true,
    body: { name: 'Beef fillet', itemTypeId: 't-2', branchId: 'b-1', unitType: 'kg', unitPrice: 650, initialStockQty: 12.5 },
  });
  assert.equal(checkProduct(form({ byWeight: true, stock: '1.2345' }), 'b-1', TYPES).ok, false);
  assert.equal(checkProduct(form({ byWeight: true, stock: '1,5' }), 'b-1', TYPES).ok, false);
  assert.equal(checkProduct(form({ byWeight: true, stock: '0' }), 'b-1', TYPES).ok, false);
});

test('the first thing wrong is the one reported, in the order the form reads', () => {
  const bad = form({ name: '', typeId: null, price: 'abc', cost: 'x', barcode: 'a b', stock: '1.5' });
  const fields: string[] = [];
  let current = bad;
  const fixes: Partial<ProductForm>[] = [{ name: 'Tea' }, { typeId: 't-1' }, { price: '100' }, { cost: '' }, { barcode: '' }];
  for (let step = 0; step <= fixes.length; step += 1) {
    const result = checkProduct(current, 'b-1', TYPES);
    if (result.ok) break;
    fields.push(result.field);
    current = { ...current, ...fixes[step] };
  }
  assert.deepEqual(fields, ['name', 'type', 'price', 'cost', 'barcode', 'stock']);
});

test('a name needs two characters and at most a hundred and twenty, and is cleaned like any text shown on the till', () => {
  for (const name of ['', ' ', 'x', '​​']) assert.equal(checkProduct(form({ name }), 'b-1', TYPES).ok, false, JSON.stringify(name));
  assert.equal(checkProduct(form({ name: 'xx' }), 'b-1', TYPES).ok, true);
  assert.equal(checkProduct(form({ name: 'x'.repeat(120) }), 'b-1', TYPES).ok, true);
  const long = checkProduct(form({ name: 'x'.repeat(121) }), 'b-1', TYPES);
  assert.equal(long.ok, false);
  assert.match(long.ok ? '' : long.words, /120/);
  const sneaky = checkProduct(form({ name: 'Rice‮gnp.exe\n' }), 'b-1', TYPES);
  assert.equal(sneaky.ok && sneaky.body.name, 'Ricegnp.exe');
});

test('a kind must be one of the shop\'s own', () => {
  assert.equal(checkProduct(form({ typeId: null }), 'b-1', TYPES).ok, false);
  assert.equal(checkProduct(form({ typeId: 't-9' }), 'b-1', TYPES).ok, false);
  assert.equal(checkProduct(form(), 'b-1', []).ok, false, 'a shop with no kinds cannot add a product from the till');
});

test('a price is strict, above zero, and a comma is a thousands mark and never a decimal one', () => {
  for (const price of ['', '0', '0.00', '-5', '12,50', '1e3', 'ten', '12.345', '99999999999']) {
    assert.equal(checkProduct(form({ price }), 'b-1', TYPES).ok, false, price);
  }
  const ok = checkProduct(form({ price: '0.01' }), 'b-1', TYPES);
  assert.equal(ok.ok && ok.body.unitPrice, 0.01);
});

test('a barcode is digits, as the server keeps it, or empty', () => {
  // The server keeps only digits, and drops anything else without a word: the till refuses it up front.
  for (const barcode of ['abc', 'AB-1234', 'AB-12.cd_9', 'a b c d', '<script>', '6'.repeat(65), 'é1234', '123', '1-2 3']) {
    assert.equal(checkProduct(form({ barcode }), 'b-1', TYPES).ok, false, JSON.stringify(barcode));
  }
  for (const barcode of ['6001', '6'.repeat(64), '', '   ']) {
    assert.equal(checkProduct(form({ barcode }), 'b-1', TYPES).ok, true, JSON.stringify(barcode));
  }
});

test('a barcode is sent as the server will keep it: without spaces, dashes, dots and underscores', () => {
  for (const [typed, kept] of [
    ['6001234567890', '6001234567890'],
    ['6001 2345 67890', '6001234567890'],
    ['6001-2345.67890_', '6001234567890'],
    ['6001234567890\n', '6001234567890'],
    [' 4-0-0-6 ', '4006'],
  ] as const) {
    const checked = checkProduct(form({ barcode: typed }), 'b-1', TYPES);
    assert.equal(checked.ok && checked.body.barcode, kept, JSON.stringify(typed));
  }
});

test('a barcode of nothing but punctuation is no barcode, as it is to the server', () => {
  const checked = checkProduct(form({ barcode: ' - . _ ' }), 'b-1', TYPES);
  assert.equal(checked.ok && 'barcode' in checked.body, false);
});

test('the number on the shelf is a whole number of units, or empty to leave it to the server', () => {
  const none = checkProduct(form({ stock: '' }), 'b-1', TYPES);
  assert.equal(none.ok && 'initialStockQty' in none.body, false);
  for (const stock of ['0', '-1', '1.5', '12a', '100000', 'many']) {
    assert.equal(checkProduct(form({ stock }), 'b-1', TYPES).ok, false, stock);
  }
  const ok = checkProduct(form({ stock: '99999' }), 'b-1', TYPES);
  assert.equal(ok.ok && ok.body.initialStockQty, 99999);
});

test('the check never changes the form it was given', () => {
  const given = form({ name: '  Tea  ' });
  const before = JSON.stringify(given);
  checkProduct(given, 'b-1', TYPES);
  assert.equal(JSON.stringify(given), before);
});

test('a refusal says what the server said; a request with no answer says the product may exist', () => {
  assert.equal(describeCreateFailure(new ApiError('Forbidden', { status: 403 })).kind, 'refused');
  assert.match(describeCreateFailure(new ApiError('x', { status: 403 })).words, /not allowed to add products/);
  assert.match(describeCreateFailure(new ApiError('dup', { status: 409 })).words, /clashes/);
  const said = describeCreateFailure(new ApiError('Sell price is required', { status: 400 }));
  assert.deepEqual(said, { kind: 'refused', words: 'The server said no: Sell price is required' });
  assert.equal(describeCreateFailure(new ApiError('', { status: 422 })).kind, 'refused');
  for (const error of [new ApiError('boom', { status: 500 }), new ApiError('bad gateway', { status: 502 }), new Error('Network request failed'), 'x']) {
    const failure = describeCreateFailure(error);
    assert.equal(failure.kind, 'unknown', String(error));
    assert.match(failure.words, /may have been added.*Search for it/);
  }
  const proxy = describeCreateFailure(new ApiError('<html>blocked</html>', { status: 403, foreign: true }));
  assert.equal(proxy.kind, 'unknown', 'a web page in the way is not the server saying no');
});

test('a product that was added but could not be marked as sold by weight says it was added', () => {
  assert.match(weighedFailureWords(new ApiError('no', { status: 403 })), /^The product was added.*not allowed to mark it/);
  assert.match(weighedFailureWords(new ApiError('This product sells as a pack', { status: 400 })), /^The product was added.*sells as a pack/);
  assert.match(weighedFailureWords(new Error('offline')), /^The product was added.*sell by the unit/);
  assert.match(weighedFailureWords(new ApiError('<html>x</html>', { status: 400, foreign: true })), /sell by the unit/);
});

test('a clash with a product that already exists is a refusal, not a doubt', () => {
  assert.equal(describeCreateFailure(new ApiError('dup', { status: 409 })).kind, 'refused');
});

test('a kind of product is read with its id trimmed', () => {
  assert.deepEqual(parseItemTypes([{ id: ' t-1 ', label: 'Dairy' }]), [{ id: 't-1', name: 'Dairy' }]);
});
