import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemLabel, itemsPath, priceToCents, readItemsPage, readStockItem, searchTerms } from '../src/stock-items';

const MILK = {
  id: 'item-1',
  sku: 'MLK-1',
  barcode: '6161100010016',
  name: 'Fresh Milk',
  variantName: '500 ml',
  stockQty: 12.5,
  packageVariant: false,
  buyingPrice: '48.5',
  sellingPrice: 60,
  isWeighed: false,
  unitType: 'each',
  active: true,
  isSellable: true,
  groupLabelOnly: false,
};

test('a price is read from its digits to whole cents, half up', () => {
  assert.equal(priceToCents(12.5), 1250);
  assert.equal(priceToCents('12.50'), 1250);
  assert.equal(priceToCents(12.34), 1234);
  assert.equal(priceToCents(1.005), 101, 'a plain multiplication would give 100');
  assert.equal(priceToCents('1.005'), 101);
  assert.equal(priceToCents('0.004'), 0);
  assert.equal(priceToCents('0.005'), 1);
  assert.equal(priceToCents(0), 0);
  assert.equal(priceToCents('0'), 0);
  assert.equal(priceToCents('1234567.89'), 123456789);
  assert.equal(priceToCents('10000000'), 1_000_000_000);
});

test('what is not a price is not one', () => {
  for (const bad of [null, undefined, '', 'abc', '-1', -1, '1e3', NaN, Infinity, {}, '1,5', '10000000.01', '12345678901', 1e10, '99999999']) {
    assert.equal(priceToCents(bad), null, String(bad));
  }
});

test('an item row is read with its stock at the branch', () => {
  assert.deepEqual(readStockItem(MILK), {
    id: 'item-1',
    name: 'Fresh Milk',
    variantName: '500 ml',
    sku: 'MLK-1',
    barcode: '6161100010016',
    onHandUnits: 125000,
    weighed: false,
    unitType: 'each',
    packageVariant: false,
    active: true,
    sellable: true,
    buyingCents: 4850,
    sellingCents: 6000,
    itemTypeId: null,
    imageUrl: null,
  });
});

test('a catalogue photo is kept only when it is a web address', () => {
  assert.equal(readStockItem({ ...MILK, thumbnailUrl: 'https://cdn.example/milk.jpg' })?.imageUrl, 'https://cdn.example/milk.jpg');
  assert.equal(readStockItem({ ...MILK, imageKey: 'https://cdn.example/milk.jpg' })?.imageUrl, 'https://cdn.example/milk.jpg');
  assert.equal(readStockItem({ ...MILK, thumbnailUrl: '  https://cdn.example/milk.jpg  ' })?.imageUrl, 'https://cdn.example/milk.jpg');
  assert.equal(readStockItem({ ...MILK, thumbnailUrl: 'catalog/milk.jpg', imageKey: 'catalog/milk.jpg' })?.imageUrl, null);
  assert.equal(
    readStockItem({ ...MILK, thumbnailUrl: 'https://cdn.example/thumb.jpg', imageKey: 'https://cdn.example/full.jpg' })?.imageUrl,
    'https://cdn.example/thumb.jpg',
  );
  assert.equal(
    readStockItem({ ...MILK, images: [{ s3Key: 'catalog/milk.jpg' }, { secureUrl: 'https://cdn.example/gallery.jpg' }] })?.imageUrl,
    'https://cdn.example/gallery.jpg',
  );
});

test('a stock the server did not give is unknown, and a stock of nothing is zero', () => {
  const noStock = { ...MILK } as Record<string, unknown>;
  delete noStock.stockQty;
  assert.equal(readStockItem(noStock)?.onHandUnits, null);
  assert.equal(readStockItem({ ...MILK, stockQty: null })?.onHandUnits, null);
  assert.equal(readStockItem({ ...MILK, stockQty: 'lots' })?.onHandUnits, null);
  assert.equal(readStockItem({ ...MILK, stockQty: 0 })?.onHandUnits, 0);
  assert.equal(readStockItem({ ...MILK, stockQty: '0.0000' })?.onHandUnits, 0);
  assert.equal(readStockItem({ ...MILK, stockQty: -2 })?.onHandUnits, -20000);
  assert.equal(readStockItem({ ...MILK, stockQty: '7.25' })?.onHandUnits, 72500);
});

test('what is not an item, or only a heading, is left out', () => {
  assert.equal(readStockItem(null), null);
  assert.equal(readStockItem('milk'), null);
  assert.equal(readStockItem({ ...MILK, id: '' }), null);
  assert.equal(readStockItem({ ...MILK, id: 7 }), null);
  assert.equal(readStockItem({ ...MILK, id: 'x'.repeat(65) }), null);
  assert.equal(readStockItem({ ...MILK, name: '   ' }), null);
  assert.equal(readStockItem({ ...MILK, name: undefined }), null);
  assert.equal(readStockItem({ ...MILK, groupLabelOnly: true }), null);
});

test('flags are read as the server means them', () => {
  assert.equal(readStockItem({ ...MILK, packageVariant: true })?.packageVariant, true);
  assert.equal(readStockItem({ ...MILK, isWeighed: true })?.weighed, true);
  assert.equal(readStockItem({ ...MILK, active: false })?.active, false);
  assert.equal(readStockItem({ ...MILK, isSellable: false })?.sellable, false);
  const bare = readStockItem({ id: 'a', name: 'A' });
  assert.equal(bare?.active, true);
  assert.equal(bare?.sellable, true);
  assert.equal(bare?.packageVariant, false);
  assert.equal(bare?.buyingCents, null);
});

test('a name is cleaned of what hides or reorders text', () => {
  const dirty = readStockItem({ ...MILK, name: '  Fresh‮​   Milk\n', variantName: '\u0007' });
  assert.equal(dirty?.name, 'Fresh Milk');
  assert.equal(dirty?.variantName, null);
});

test('an item is named with its variant', () => {
  assert.equal(itemLabel({ name: 'Milk', variantName: '500 ml' }), 'Milk (500 ml)');
  assert.equal(itemLabel({ name: 'Milk', variantName: null }), 'Milk');
});

test('a Spring page is read whether its counts sit beside the rows or inside a page object', () => {
  const flat = readItemsPage({ content: [MILK, { id: 'b', name: 'Bread' }], totalElements: 5, last: false }, { page: 0, size: 2 });
  assert.equal(flat?.items.length, 2);
  assert.equal(flat?.total, 5);
  assert.equal(flat?.more, true);
  const nested = readItemsPage({ content: [MILK], page: { size: 40, number: 0, totalElements: 1, totalPages: 1 } }, { page: 0, size: 40 });
  assert.equal(nested?.total, 1);
  assert.equal(nested?.more, false);
});

test('whether there is more comes from the server, then the total, then the page size', () => {
  const rows = [MILK, { ...MILK, id: 'b' }];
  assert.equal(readItemsPage({ content: rows, last: true, totalElements: 99 }, { page: 0, size: 2 })?.more, false);
  assert.equal(readItemsPage({ content: rows, last: false }, { page: 0, size: 40 })?.more, true);
  assert.equal(readItemsPage({ content: rows, totalElements: 4 }, { page: 0, size: 2 })?.more, true);
  assert.equal(readItemsPage({ content: rows, totalElements: 4 }, { page: 1, size: 2 })?.more, false);
  assert.equal(readItemsPage({ content: rows }, { page: 0, size: 2 })?.more, true);
  assert.equal(readItemsPage({ content: [MILK] }, { page: 0, size: 2 })?.more, false);
  assert.equal(readItemsPage({ content: [] }, { page: 0, size: 2 })?.more, false);
});

test('a page counts the rows the server sent, not the ones kept', () => {
  const page = readItemsPage({ content: [MILK, { groupLabelOnly: true, id: 'h', name: 'Dairy' }, 'junk', null], last: true }, { page: 0, size: 40 });
  assert.equal(page?.items.length, 1);
  assert.equal(page?.seen, 4);
});

test('an answer that is not a page is a failed read, not an empty list', () => {
  for (const bad of [null, undefined, 'x', 12, [], {}, { content: 'no' }, { items: [MILK] }]) {
    assert.equal(readItemsPage(bad, { page: 0, size: 40 }), null, JSON.stringify(bad));
  }
});

test('what was typed is a barcode only when it looks like one', () => {
  assert.deepEqual(searchTerms('6161100010016'), { barcode: '6161100010016' });
  assert.deepEqual(searchTerms(' 123456 '), { barcode: '123456' });
  assert.deepEqual(searchTerms('12345'), { search: '12345' });
  assert.deepEqual(searchTerms('1234567890123456'), { search: '1234567890123456' });
  assert.deepEqual(searchTerms('milk 500'), { search: 'milk 500' });
  assert.equal(searchTerms(''), null);
  assert.equal(searchTerms('   '), null);
});

test('the path to a page of items carries only what is set, encoded', () => {
  assert.equal(itemsPath({ branchId: 'b1' }), '/api/v1/items?branchId=b1&size=40&page=0');
  assert.equal(itemsPath({ branchId: 'b 1', search: 'a&b=c' }), '/api/v1/items?branchId=b%201&search=a%26b%3Dc&size=40&page=0');
  assert.equal(itemsPath({ branchId: 'b1', barcode: '6161100010016', page: 2, size: 20 }), '/api/v1/items?branchId=b1&barcode=6161100010016&size=20&page=2');
  assert.equal(itemsPath({ branchId: 'b1', lowStock: true }), '/api/v1/items?branchId=b1&lowStock=true&size=40&page=0');
  assert.equal(itemsPath({ branchId: 'b1', zeroStock: true, lowStock: false }), '/api/v1/items?branchId=b1&zeroStock=true&size=40&page=0');
  assert.equal(itemsPath({ branchId: 'b1', size: 5000, page: -3 }), '/api/v1/items?branchId=b1&size=100&page=0');
  assert.equal(itemsPath({ branchId: 'b1', size: 0, page: 1.9 }), '/api/v1/items?branchId=b1&size=1&page=1');
  assert.equal(itemsPath({ branchId: 'b1', search: '   ' }), '/api/v1/items?branchId=b1&size=40&page=0');
});

test('a price may be up to the largest the server can mean, and no more', () => {
  assert.equal(priceToCents(9_999_999), 999_999_900);
  assert.equal(priceToCents(10_000_000), null);
  for (const bad of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN, -1, -0.01]) assert.equal(priceToCents(bad), null, String(bad));
});

test('an item id may be up to sixty-four characters, and a longer one is not an id', () => {
  assert.equal(readStockItem({ ...MILK, id: 'x'.repeat(64) })?.id, 'x'.repeat(64));
  assert.equal(readStockItem({ ...MILK, id: 'x'.repeat(65) }), null);
  assert.equal(readStockItem({ ...MILK, id: '  ' }), null);
});

test('a total is a count: whole, and not below nothing', () => {
  const total = (totalElements: unknown) => readItemsPage({ content: [], totalElements }, { page: 0, size: 10 })?.total;
  assert.equal(total(0), 0);
  assert.equal(total(25), 25);
  for (const bad of [1.5, -1, '5', null, undefined]) assert.equal(total(bad), null, String(bad));
  assert.equal(readItemsPage({ content: [], page: null }, { page: 0, size: 10 })?.total, null);
  assert.equal(readItemsPage({ content: [], page: 'x' }, { page: 0, size: 10 })?.total, null);
  assert.equal(readItemsPage({ content: [], page: { totalElements: 7 } }, { page: 0, size: 10 })?.total, 7);
});

test('with no word from the server about more, a page that came back full may have more behind it', () => {
  const rows = (count: number) => Array.from({ length: count }, (_, n) => ({ ...MILK, id: `i${n}` }));
  const more = (count: number, size: number) => readItemsPage({ content: rows(count) }, { page: 0, size })?.more;
  assert.equal(more(10, 10), true, 'a full page');
  assert.equal(more(9, 10), false, 'a page that is not full');
  assert.equal(more(0, 10), false, 'nothing');
  assert.equal(more(0, 0), false, 'nothing asked for, nothing came');
});
