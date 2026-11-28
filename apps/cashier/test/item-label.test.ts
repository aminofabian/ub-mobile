import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemLabel } from '../src/lib/item-label';

test('an ordinary product is its name', () => {
  assert.equal(itemLabel({ name: 'Milk 500ml' }), 'Milk 500ml');
  assert.equal(itemLabel({ name: '  Milk   500ml ' }), 'Milk 500ml');
});

test('a product with an option its name does not say gets the option', () => {
  assert.equal(itemLabel({ name: 'Rice', variantName: '2kg' }), 'Rice · 2kg');
  assert.equal(itemLabel({ name: 'Rice 2kg', variantName: '2kg' }), 'Rice 2kg');
  assert.equal(itemLabel({ name: 'Rice 2KG', variantName: '2kg' }), 'Rice 2KG', 'case does not make a new word');
  assert.equal(itemLabel({ name: 'Rice', size: '1kg' }), 'Rice · 1kg', 'the size when there is no option');
  assert.equal(itemLabel({ name: 'Rice', variantName: '2kg', size: '1kg' }), 'Rice · 2kg', 'the option before the size');
});

test('an option the name already says is only recognised as whole words', () => {
  assert.equal(itemLabel({ name: 'Rice 12kg', variantName: '2kg' }), 'Rice 12kg · 2kg', '"2kg" is not in "12kg"');
  assert.equal(itemLabel({ name: 'Pack of 12', variantName: '2' }), 'Pack of 12 · 2', '"2" is not in "12"');
  assert.equal(itemLabel({ name: 'Cola 500ml', variantName: '500' }), 'Cola 500ml · 500', 'a part of a word is not the word');
  assert.equal(itemLabel({ name: 'Rice (2kg)', variantName: '2kg' }), 'Rice (2kg)', 'brackets and commas end a word');
  assert.equal(itemLabel({ name: 'Rice, 2kg, white', variantName: '2kg' }), 'Rice, 2kg, white');
  assert.equal(itemLabel({ name: 'Sukari 2kg', variantName: 'Sukari 2kg' }), 'Sukari 2kg', 'an option that is the whole name says nothing more');
});

test('the option is found when the first place it appears is part of a longer word and a later one is not', () => {
  assert.equal(itemLabel({ name: 'Rice 12kg or 2kg', variantName: '2kg' }), 'Rice 12kg or 2kg');
  assert.equal(itemLabel({ name: 'Rice 12kg and 120kg', variantName: '2kg' }), 'Rice 12kg and 120kg · 2kg', 'it is nowhere as a word');
});

test('an option an import left as a placeholder is not shown', () => {
  for (const variantName of ['variant', 'Option', 'VARIATION', ' default ', '', null, undefined, '3f2a1b4c-0000-4000-8000-00000000abcd']) {
    assert.equal(itemLabel({ name: 'Rice', variantName }), 'Rice', String(variantName));
  }
});

test('a size of a product is named from the product as it is named now', () => {
  const sizeOf = { variantOfItemId: 'p-1', parentName: 'Coca Cola' };
  assert.equal(itemLabel({ ...sizeOf, name: 'Coke', variantName: '500ml' }), 'Coca Cola · 500ml', 'after a rename of the product');
  assert.equal(itemLabel({ ...sizeOf, name: 'Coca Cola 500ml', variantName: 'Coca Cola 500ml' }), 'Coca Cola · 500ml');
  assert.equal(itemLabel({ ...sizeOf, name: 'Coca Cola 500ml', variantName: '500ml' }), 'Coca Cola · 500ml');
  assert.equal(itemLabel({ ...sizeOf, name: 'Coca Cola', variantName: 'Coca Cola' }), 'Coca Cola', 'an option that is the family says nothing more');
  assert.equal(itemLabel({ ...sizeOf, name: 'Coca Cola 500ml' }), 'Coca Cola 500ml', 'no option: the row\'s own name');
  assert.equal(itemLabel({ variantOfItemId: 'p-1', name: 'Coca Cola 500ml', variantName: '500ml' }), 'Coca Cola 500ml', 'no parent name: the row\'s own');
});

test('two sizes of one product never read the same', () => {
  const sizeOf = { variantOfItemId: 'p-1', parentName: 'Juice' };
  const labels = ['250ml', '500ml', '1L'].map((variantName) => itemLabel({ ...sizeOf, name: 'Juice', variantName }));
  assert.equal(new Set(labels).size, 3);
});

test('a name that is no use is replaced by what the row does say', () => {
  assert.equal(itemLabel({ name: '', brand: 'Omo', size: '1kg' }), 'Omo · 1kg');
  assert.equal(itemLabel({ name: '210', brand: 'Omo', variantName: '1kg' }), 'Omo · 1kg', 'a bare code is not a name when the row has a brand');
  assert.equal(itemLabel({ name: '210', variantName: '1kg' }), '210 · 1kg', 'but it is all a cashier has when the row has nothing else');
  assert.equal(itemLabel({ name: '210' }), '210');
  assert.equal(itemLabel({ variantOfItemId: 'p-1', name: '210' }), '210');
  assert.equal(itemLabel({ name: 'IMP-3f2a1b4c-0000-4000-8000-00000000abcd', brand: 'Omo' }), 'Omo');
  assert.equal(itemLabel({ name: '3f2a1b4c-0000-4000-8000-00000000abcd', variantName: '1kg' }), '1kg');
  assert.equal(itemLabel({ variantOfItemId: 'p-1', name: '', parentName: 'Omo', variantName: '1kg' }), 'Omo · 1kg');
  assert.equal(itemLabel({ variantOfItemId: 'p-1', name: '210', variantName: '1kg', brand: 'Omo' }), 'Omo · 1kg');
  assert.equal(itemLabel({ variantOfItemId: 'p-1', name: '210', variantName: '1kg' }), '210 · 1kg');
  assert.equal(itemLabel({ variantOfItemId: 'p-1', name: '', brand: 'Omo' }), 'Omo');
});

test('a row with nothing to go on is still something a cashier can see', () => {
  for (const row of [{}, { name: null }, { name: '   ' }, { name: 5 }, { name: '​' }, { variantOfItemId: 'p-1' }]) {
    assert.equal(itemLabel(row), 'Item', JSON.stringify(row));
  }
});

test('the label is cleaned and cut like any text from the server', () => {
  assert.equal(itemLabel({ name: 'Tea‮ leaves\n' }), 'Tea leaves');
  assert.equal([...itemLabel({ name: 'x'.repeat(500) })].length, 120);
  assert.equal(itemLabel({ name: 'Rice', variantName: '2kg​' }), 'Rice · 2kg');
});

test('the product said again in its option is said once, whatever the capitals or the separator, and a longer word is not the product', () => {
  assert.equal(itemLabel({ name: 'Coca Cola', variantName: 'COCA COLA 500ml' }), 'Coca Cola · 500ml');
  for (const separator of [' - ', ' – ', ', ', ' · ', ' • ', ' ']) {
    assert.equal(itemLabel({ name: 'Coca Cola', variantName: `Coca Cola${separator}500ml` }), 'Coca Cola · 500ml', JSON.stringify(separator));
  }
  assert.equal(itemLabel({ name: 'Coca Cola', variantName: 'Coca Cola' }), 'Coca Cola');
  assert.equal(itemLabel({ name: 'Coca Cola', variantName: 'Coca Cola -' }), 'Coca Cola', 'an option that is only the product says nothing more');
  assert.equal(itemLabel({ name: 'Milk', variantName: 'Milkshake 500ml' }), 'Milk · Milkshake 500ml');
});

test('only a size of a product follows the product\'s name, and a blank link does not make a size', () => {
  assert.equal(itemLabel({ name: 'Own name', parentName: 'Other' }), 'Own name');
  assert.equal(itemLabel({ name: 'Own name', parentName: 'Other', variantOfItemId: '   ' }), 'Own name');
  assert.equal(itemLabel({ name: 'Own name', parentName: 'Other', variantOfItemId: '   ', variantName: '2kg' }), 'Own name · 2kg');
  assert.equal(itemLabel({ name: 'Own name', parentName: 'Other', variantOfItemId: null }), 'Own name');
  assert.equal(itemLabel({ name: 'Own name', parentName: 'Other', variantOfItemId: 'p-1', variantName: '2kg' }), 'Other · 2kg');
});

test('a brand is only for a product that has no name of its own', () => {
  assert.equal(itemLabel({ name: 'Milk 500ml', brand: 'Brookside' }), 'Milk 500ml');
  assert.equal(itemLabel({ name: '', brand: 'Brookside' }), 'Brookside');
  assert.equal(itemLabel({ name: '12345', brand: 'Brookside' }), 'Brookside');
});

test('a size with no option label of its own says its own name, unless that is only a code', () => {
  assert.equal(itemLabel({ name: 'Rice 2kg', parentName: 'Rice', variantOfItemId: 'p-1' }), 'Rice 2kg');
  assert.equal(itemLabel({ name: '12345', parentName: 'Rice', variantOfItemId: 'p-1' }), 'Rice');
});
