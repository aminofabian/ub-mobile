import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CartItem } from '../src/lib/cart';
import {
  CATALOG_MAX_CHARS,
  CATALOG_MAX_ROWS,
  CATALOG_VERSION,
  REFRESH_AFTER_MS,
  RETRY_AFTER_MS,
  SEARCH_LIMIT,
  encodeCatalog,
  findByBarcode,
  openCatalog,
  parseCatalog,
  searchCatalog,
  shouldRefresh,
  type Catalog,
} from '../src/lib/catalog';

const NOON = Date.parse('2026-11-23T12:00:00.000Z');

const MILK: CartItem = { id: 'i-1', name: 'Milk 500ml', barcode: '6001', sellingPrice: 65, stockOnHand: 12 };
const BEEF: CartItem = { id: 'i-2', name: 'Beef', sellingPrice: 650, stockOnHand: 3.5, weighed: true, unitType: 'kg' };
const EGGS: CartItem = { id: 'i-3', name: 'Eggs tray', barcode: '6002', sellingPrice: 480, packageVariant: true };
const BREAD: CartItem = { id: 'i-4', name: 'Bread', sellingPrice: 60 };

function textOf(items: CartItem[], extra: Partial<Parameters<typeof encodeCatalog>[0]> = {}): string {
  return encodeCatalog({ branchId: 'b-1', at: NOON, items, ...extra }).text;
}

function copyOf(text: string): Catalog {
  const read = parseCatalog(text, NOON);
  assert.equal(read.kind, 'copy');
  if (read.kind !== 'copy') throw new Error('not a copy');
  return read.catalog;
}

function shelf(count: number): CartItem[] {
  return Array.from({ length: count }, (_, n) => ({ id: `i-${n}`, name: `Product ${String(n).padStart(5, '0')}`, barcode: `7${String(n).padStart(8, '0')}`, sellingPrice: 100 + n, stockOnHand: n }));
}

test('what is kept comes back as it was, flags and unit and stock included', () => {
  const copy = copyOf(textOf([MILK, BEEF, EGGS, BREAD]));
  assert.deepEqual(copy.items, [MILK, BEEF, EGGS, BREAD]);
  assert.equal(copy.branchId, 'b-1');
  assert.equal(copy.at, NOON);
  assert.equal(copy.cut, false);
  assert.equal(copy.dropped, 0);
});

test('a product with no barcode, no stock and no unit keeps none of them', () => {
  const [bread] = copyOf(textOf([BREAD])).items;
  assert.deepEqual(bread, BREAD);
  assert.equal('barcode' in (bread ?? {}), false);
  assert.equal('stockOnHand' in (bread ?? {}), false);
  assert.equal('weighed' in (bread ?? {}), false);
});

test('the text names its layout, so a later version can be told from this one', () => {
  assert.equal(JSON.parse(textOf([MILK])).v, CATALOG_VERSION);
});

test('nothing but what the till reads is written down: no cost, no supplier, no picture', () => {
  const leaky = { ...MILK, buyingPrice: 41, imageKey: 'x.png', supplier: 'Acme' } as unknown as CartItem;
  const text = textOf([leaky]);
  assert.doesNotMatch(text, /buyingPrice|41|imageKey|Acme/);
});

test('past the size the phone keeps, the rest is left out and the copy says so, never cut through a row', () => {
  const items = shelf(200);
  const whole = encodeCatalog({ branchId: 'b-1', at: NOON, items });
  assert.equal(whole.kept, 200);
  assert.equal(whole.cut, false);
  const limit = Math.floor(whole.text.length / 2);
  const part = encodeCatalog({ branchId: 'b-1', at: NOON, items, maxChars: limit });
  assert.ok(part.text.length <= limit, `${part.text.length} <= ${limit}`);
  assert.ok(part.kept > 50 && part.kept < 150, String(part.kept));
  assert.equal(part.cut, true);
  const copy = copyOf(part.text);
  assert.equal(copy.items.length, part.kept);
  assert.equal(copy.dropped, 0, 'every row that was kept is whole');
  assert.equal(copy.cut, true);
  assert.deepEqual(copy.items, items.slice(0, part.kept), 'the first of the list is what is kept');
});

test('the limit is on the text, to the character', () => {
  const items = shelf(5);
  const text = encodeCatalog({ branchId: 'b-1', at: NOON, items }).text;
  const exact = encodeCatalog({ branchId: 'b-1', at: NOON, items, maxChars: text.length });
  assert.equal(exact.kept, 5, 'a list that fits exactly is kept whole');
  assert.equal(exact.cut, false);
  assert.ok(exact.text.length <= text.length);
  const short = encodeCatalog({ branchId: 'b-1', at: NOON, items, maxChars: text.length - 1 });
  assert.equal(short.kept, 4, 'one character short loses the last row, and only that');
  assert.equal(short.cut, true);
  assert.ok(short.text.length <= text.length - 1);
});

test('even a copy cut short is under the limit it was given', () => {
  for (const maxChars of [120, 200, 333, 1000]) {
    const out = encodeCatalog({ branchId: 'b-1', at: NOON, items: shelf(50), maxChars });
    assert.ok(out.text.length <= maxChars, `${out.text.length} <= ${maxChars}`);
    assert.equal(copyOf(out.text.length ? out.text : '').items.length, out.kept);
  }
});

test('there is a limit on how many products as well', () => {
  assert.ok(CATALOG_MAX_ROWS >= 5_000 && CATALOG_MAX_ROWS <= 50_000);
  const out = encodeCatalog({ branchId: 'b-1', at: NOON, items: shelf(30), maxRows: 10 });
  assert.equal(out.kept, 10);
  assert.equal(out.cut, true);
  const exactly = encodeCatalog({ branchId: 'b-1', at: NOON, items: shelf(10), maxRows: 10 });
  assert.equal(exactly.kept, 10);
  assert.equal(exactly.cut, false);
});

test('a list the shop itself sent in part stays marked as a part', () => {
  const out = encodeCatalog({ branchId: 'b-1', at: NOON, items: [MILK], cut: true });
  assert.equal(out.cut, true);
  assert.equal(copyOf(out.text).cut, true);
});

test('the default limit leaves room: about a megabyte and a half at most', () => {
  assert.ok(CATALOG_MAX_CHARS <= 2_000_000, 'a text over two megabytes may not be readable back on an older phone');
  assert.ok(CATALOG_MAX_CHARS >= 500_000);
  const big = encodeCatalog({ branchId: 'b-1', at: NOON, items: shelf(15_000) });
  assert.ok(big.text.length <= CATALOG_MAX_CHARS);
});

test('nothing stored means no copy; text that is not a copy is unreadable, not "none"', () => {
  assert.deepEqual(parseCatalog(null, NOON), { kind: 'none' });
  assert.deepEqual(parseCatalog('', NOON), { kind: 'none' });
  for (const text of ['not json', '[]', '[1,2]', '"x"', '12', 'null', '{}', '{"v":1}', '{"v":0,"branch":"b","at":1,"rows":[]}']) {
    assert.deepEqual(parseCatalog(text, NOON), { kind: 'unreadable' }, text);
  }
});

test('a copy missing its branch, its time or its rows is unreadable', () => {
  const row = '["i-1","Milk","",65,null,0]';
  assert.equal(parseCatalog(`{"v":1,"branch":"b-1","at":5,"rows":[${row}]}`, NOON).kind, 'copy');
  assert.equal(parseCatalog(`{"v":1,"at":5,"rows":[${row}]}`, NOON).kind, 'unreadable');
  assert.equal(parseCatalog(`{"v":1,"branch":"","at":5,"rows":[${row}]}`, NOON).kind, 'unreadable');
  assert.equal(parseCatalog(`{"v":1,"branch":7,"at":5,"rows":[${row}]}`, NOON).kind, 'unreadable');
  assert.equal(parseCatalog(`{"v":1,"branch":"b-1","rows":[${row}]}`, NOON).kind, 'unreadable');
  assert.equal(parseCatalog(`{"v":1,"branch":"b-1","at":"5","rows":[${row}]}`, NOON).kind, 'unreadable');
  assert.equal(parseCatalog(`{"v":1,"branch":"b-1","at":-1,"rows":[${row}]}`, NOON).kind, 'unreadable');
  assert.equal(parseCatalog('{"v":1,"branch":"b-1","at":5}', NOON).kind, 'unreadable');
  assert.equal(parseCatalog('{"v":1,"branch":"b-1","at":5,"rows":"nope"}', NOON).kind, 'unreadable');
});

test('a copy written by a later version of the app is not used and not mistaken for damage', () => {
  assert.deepEqual(parseCatalog('{"v":2,"branch":"b-1","at":5,"rows":[]}', NOON), { kind: 'newer' });
  assert.deepEqual(parseCatalog('{"v":99}', NOON), { kind: 'newer' });
  assert.deepEqual(parseCatalog('{"v":1.5,"branch":"b-1","at":5,"rows":[]}', NOON), { kind: 'unreadable' });
});

test('a row that cannot be trusted is left out and counted; its neighbours are kept', () => {
  const good = '["i-1","Milk","6001",65,12,0]';
  const rows = [
    good,
    '["i-2","No price","",null,null,0]',
    '["i-3","Negative","",-5,null,0]',
    '["i-4","Text price","","65",null,0]',
    '["i-5","Huge","",99999999999,null,0]',
    '["i-6","","",5,null,0]',
    '["i-7","   ","",5,null,0]',
    '["","No id","",5,null,0]',
    '[7,"Number id","",5,null,0]',
    `["${'x'.repeat(81)}","Long id","",5,null,0]`,
    `["i-8","${'n'.repeat(201)}","",5,null,0]`,
    `["i-9","Long barcode","${'9'.repeat(65)}",5,null,0]`,
    '["i-10","Bad flags","",5,null,4]',
    '["i-11","Bad flags","",5,null,-1]',
    '["i-12","Bad flags","",5,null,1.5]',
    '["i-13","Bad stock","",5,"3",0]',
    '["i-14","Bad unit","",5,null,1,""]',
    '["i-15","Bad unit","",5,null,1,"kilograms-and-more"]',
    '["i-16","Bad unit","",5,null,1,5]',
    '["i-17","Short"]',
    '["i-18","Long","",5,null,0,"kg","extra"]',
    '"just a string"',
    'null',
    '{"id":"i-19"}',
    '["i-20","Zero is a price, shown as having none","",0,null,0]',
  ];
  const copy = copyOf(`{"v":1,"branch":"b-1","at":${NOON},"rows":[${rows.join(',')}]}`);
  assert.deepEqual(copy.items.map((item) => item.id), ['i-1', 'i-20']);
  assert.equal(copy.dropped, rows.length - 2);
});

test('the same product twice is one product, and the second is counted', () => {
  const rows = [['i-1', 'First', '', 1, null, 0], ['i-1', 'Second', '', 2, null, 0], ['i-2', 'Other', '', 3, null, 0]];
  const copy = copyOf(JSON.stringify({ v: 1, branch: 'b-1', at: NOON, rows }));
  assert.deepEqual(copy.items.map((item) => item.id), ['i-1', 'i-2']);
  assert.equal(copy.items[0]?.name, 'First');
  assert.equal(copy.dropped, 1);
});

test('a copy with nothing readable in it is not a copy', () => {
  assert.equal(parseCatalog(`{"v":1,"branch":"b-1","at":${NOON},"rows":[]}`, NOON).kind, 'unreadable');
  assert.equal(parseCatalog(`{"v":1,"branch":"b-1","at":${NOON},"rows":[["i-1","No price","",null,null,0]]}`, NOON).kind, 'unreadable');
});

test('a time ahead of the phone is not a time the copy was made', () => {
  const soon = encodeCatalog({ branchId: 'b-1', at: NOON + 4 * 60_000, items: [MILK] }).text;
  assert.equal(copyOf(soon).at, NOON + 4 * 60_000, 'a little ahead is a clock that is a little off');
  const far = encodeCatalog({ branchId: 'b-1', at: NOON + 6 * 60_000, items: [MILK] }).text;
  assert.equal(copyOf(far).at, 0, 'a clock that was set back: the time is not known');
  assert.equal(copyOf(encodeCatalog({ branchId: 'b-1', at: 1.9, items: [MILK] }).text).at, 1, 'whole milliseconds');
});

test('cut is only ever true when it says true', () => {
  const base = (cut: string) => `{"v":1,"branch":"b-1","at":${NOON},"rows":[["i-1","Milk","",65,null,0]],"cut":${cut}}`;
  assert.equal(copyOf(base('true')).cut, true);
  for (const cut of ['false', '1', '"true"', 'null', '0']) assert.equal(copyOf(base(cut)).cut, false, cut);
  assert.equal(copyOf(`{"v":1,"branch":"b-1","at":${NOON},"rows":[["i-1","Milk","",65,null,0]]}`).cut, false);
});

const LIST: CartItem[] = [
  { id: 'a', name: 'Apple juice 1L', barcode: '1001', sellingPrice: 150 },
  { id: 'b', name: 'Bread brown', barcode: '1002', sellingPrice: 60 },
  { id: 'c', name: 'Brown sugar 1kg', barcode: '1003', sellingPrice: 190 },
  { id: 'd', name: 'Milk 500ml', barcode: '1004', sellingPrice: 65 },
  { id: 'e', name: 'Milk 1L', barcode: '1005', sellingPrice: 120 },
  { id: 'f', name: 'Shake mix', sellingPrice: 80 },
  { id: 'g', name: 'Whole milk powder', barcode: '1006', sellingPrice: 300 },
  { id: 'h', name: 'Café crème', barcode: '1007', sellingPrice: 500 },
  { id: 'i', name: 'Sugar-free gum', barcode: '1008', sellingPrice: 20 },
];

function opened(items: CartItem[] = LIST) {
  return openCatalog({ branchId: 'b-1', at: NOON, cut: false, dropped: 0, items });
}

const idsOf = (items: CartItem[]) => items.map((item) => item.id);

test('a search finds what has every word typed, in any order, in any case', () => {
  const copy = opened();
  assert.deepEqual(idsOf(searchCatalog(copy, 'milk')), ['d', 'e', 'g']);
  assert.deepEqual(idsOf(searchCatalog(copy, 'MILK 1l')), ['e']);
  assert.deepEqual(idsOf(searchCatalog(copy, '1l milk')), ['e']);
  assert.deepEqual(idsOf(searchCatalog(copy, '  brown   sugar ')), ['c']);
  assert.deepEqual(idsOf(searchCatalog(copy, 'zebra')), []);
  assert.deepEqual(idsOf(searchCatalog(copy, 'milk zebra')), []);
});

test('what starts with the typing comes before what only has it inside', () => {
  const copy = opened();
  // "milk" starts "Milk 500ml" and "Milk 1L"; it is a later word in "Whole milk powder".
  assert.deepEqual(idsOf(searchCatalog(copy, 'milk')), ['d', 'e', 'g']);
  // "brown": "Bread brown" has it as a word, "Brown sugar" starts with it.
  assert.deepEqual(idsOf(searchCatalog(copy, 'brown')), ['c', 'b']);
  // "ake" is inside "Shake" and "Café"? only Shake; and inside no word start.
  assert.deepEqual(idsOf(searchCatalog(copy, 'ake')), ['f']);
});

test('a word that starts after a dash or a space counts as a word; one inside another word does not', () => {
  const copy = opened();
  assert.deepEqual(idsOf(searchCatalog(copy, 'free')), ['i']);
  // "ugar": inside both sugars. Neither starts a word, neither starts the name.
  assert.deepEqual(idsOf(searchCatalog(copy, 'ugar')), ['c', 'i']);
  // "sugar": starts "Sugar-free gum", and is a first word of "Brown sugar"? no: "brown sugar" has it as a later word.
  assert.deepEqual(idsOf(searchCatalog(copy, 'sugar')), ['i', 'c']);
});

test('an exact barcode is found first, and a part of one is found too', () => {
  const copy = opened();
  assert.deepEqual(idsOf(searchCatalog(copy, '1004')), ['d']);
  assert.deepEqual(idsOf(searchCatalog(copy, '100')).length, 8, 'a part of a barcode finds every product with it');
  const tricky = opened([
    { id: 'x', name: 'Item 1004 special', sellingPrice: 1 },
    { id: 'y', name: 'Plain', barcode: '1004', sellingPrice: 2 },
  ]);
  assert.deepEqual(idsOf(searchCatalog(tricky, '1004')), ['y', 'x'], 'the barcode itself comes first');
});

test('letters with accents are letters', () => {
  const copy = opened();
  assert.deepEqual(idsOf(searchCatalog(copy, 'café')), ['h']);
  assert.deepEqual(idsOf(searchCatalog(copy, 'crème')), ['h']);
  assert.deepEqual(idsOf(searchCatalog(copy, 'CAFÉ')), ['h']);
});

test('nothing typed gives the first of the list, and no more than the limit', () => {
  const copy = opened();
  assert.deepEqual(idsOf(searchCatalog(copy, '')), idsOf(LIST));
  assert.deepEqual(idsOf(searchCatalog(copy, '   ')), idsOf(LIST));
  assert.deepEqual(idsOf(searchCatalog(copy, '', 3)), ['a', 'b', 'c']);
  const many = opened(shelf(300));
  assert.equal(searchCatalog(many, '').length, SEARCH_LIMIT);
  assert.equal(searchCatalog(many, 'product').length, SEARCH_LIMIT);
  assert.equal(searchCatalog(many, 'product', 7).length, 7);
});

test('a search with a great many words only reads the first few', () => {
  const copy = opened();
  assert.deepEqual(idsOf(searchCatalog(copy, 'milk 1l milk 1l milk 1l zebra zebra')), ['e'], 'words past the sixth are ignored, not required');
  assert.deepEqual(idsOf(searchCatalog(copy, 'milk 1l milk 1l milk zebra')), [], 'the sixth is still read');
});

test('a barcode finds the products that have it exactly', () => {
  const copy = opened([...LIST, { id: 'j', name: 'Twin of milk', barcode: '1004', sellingPrice: 66 }]);
  assert.deepEqual(idsOf(findByBarcode(copy, '1004')), ['d', 'j']);
  assert.deepEqual(idsOf(findByBarcode(copy, ' 1004 ')), ['d', 'j'], 'what a scanner adds around it is not part of it');
  assert.deepEqual(findByBarcode(copy, '100'), [], 'a part of a barcode is not the barcode');
  assert.deepEqual(findByBarcode(copy, '9999'), []);
  assert.deepEqual(findByBarcode(copy, ''), []);
  assert.deepEqual(findByBarcode(copy, 'APPLE'), []);
});

test('opening a copy does not change it', () => {
  const copy: Catalog = { branchId: 'b-1', at: NOON, cut: true, dropped: 2, items: LIST };
  const open = openCatalog(copy);
  assert.equal(open.items, LIST);
  assert.equal(open.cut, true);
  assert.equal(open.dropped, 2);
  assert.equal(open.at, NOON);
  assert.equal(open.hay.length, LIST.length);
});

function refresh(over: Partial<Parameters<typeof shouldRefresh>[0]> = {}) {
  const catalog: Catalog = { branchId: 'b-1', at: NOON, cut: false, dropped: 0, items: [MILK] };
  return shouldRefresh({ catalog, branchId: 'b-1', now: NOON + 60_000, offline: false, busy: false, failedAt: null, ...over });
}

test('a copy made a minute ago is left alone; one a day old is made again', () => {
  assert.equal(refresh(), false);
  assert.equal(refresh({ now: NOON + REFRESH_AFTER_MS - 1 }), false);
  assert.equal(refresh({ now: NOON + REFRESH_AFTER_MS }), true);
  assert.equal(refresh({ now: NOON + 24 * 60 * 60_000 }), true);
});

test('with no copy, or one for another branch, a copy is made at once', () => {
  assert.equal(refresh({ catalog: null }), true);
  assert.equal(refresh({ branchId: 'b-2' }), true);
});

test('a copy whose time is not known, or is ahead of the clock, is made again', () => {
  const unknown: Catalog = { branchId: 'b-1', at: 0, cut: false, dropped: 0, items: [MILK] };
  assert.equal(refresh({ catalog: unknown }), true);
  const future: Catalog = { branchId: 'b-1', at: NOON + 10 * 60_000, cut: false, dropped: 0, items: [MILK] };
  assert.equal(refresh({ catalog: future }), true);
});

test('not while the line is down, not while one is being made, not straight after a failure', () => {
  assert.equal(refresh({ catalog: null, offline: true }), false);
  assert.equal(refresh({ catalog: null, busy: true }), false);
  assert.equal(refresh({ catalog: null, failedAt: NOON }), false);
  assert.equal(refresh({ catalog: null, failedAt: NOON, now: NOON + RETRY_AFTER_MS - 1 }), false);
  assert.equal(refresh({ catalog: null, failedAt: NOON, now: NOON + RETRY_AFTER_MS }), true);
  assert.equal(refresh({ catalog: null, failedAt: null }), true);
});

test('a stored copy with no version, or a version this app does not know, is not read as if it were one', () => {
  const rows = '[["i-1","Milk","6001",65,12,0]]';
  const body = (v: string) => `{${v}"branch":"b-1","at":${NOON},"rows":${rows},"cut":false}`;
  assert.equal(parseCatalog(body(`"v":${CATALOG_VERSION},`), NOON).kind, 'copy');
  assert.equal(parseCatalog(body(''), NOON).kind, 'unreadable', 'no version');
  assert.equal(parseCatalog(body('"v":0,'), NOON).kind, 'unreadable');
  assert.equal(parseCatalog(body('"v":"1",'), NOON).kind, 'unreadable', 'a version written as text');
  assert.equal(parseCatalog(body('"v":1.5,'), NOON).kind, 'unreadable');
  assert.equal(parseCatalog(body('"v":-1,'), NOON).kind, 'unreadable');
});

test('a name with the typing at the start of one of its words comes before one that has it inside a word', () => {
  const list: CartItem[] = [
    { id: 'a', name: 'Rice 1kg', sellingPrice: 10 },
    { id: 'b', name: 'Bag of ice', sellingPrice: 10 },
    { id: 'c', name: 'Ice cream', sellingPrice: 10 },
  ];
  const copy = openCatalog({ branchId: 'b-1', at: NOON, cut: false, dropped: 0, items: list });
  assert.deepEqual(searchCatalog(copy, 'ice').map((item) => item.id), ['c', 'b', 'a']);
});

test('a digit before the typing means it is inside a word, not at the start of one', () => {
  const list: CartItem[] = [
    { id: 'a', name: 'Rice 5kg', sellingPrice: 10 },
    { id: 'b', name: 'Maize flour kg pack', sellingPrice: 10 },
  ];
  const copy = openCatalog({ branchId: 'b-1', at: NOON, cut: false, dropped: 0, items: list });
  assert.deepEqual(searchCatalog(copy, 'kg').map((item) => item.id), ['b', 'a']);
});

test('a copy with no known time is made again even on a phone whose clock is nearly at its start', () => {
  const unknown: Catalog = { branchId: 'b-1', at: 0, cut: false, dropped: 0, items: [MILK] };
  assert.equal(refresh({ catalog: unknown, now: 60_000 }), true);
});
