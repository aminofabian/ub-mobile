import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addUnit, addWeight, setLinePrice, setUnits, type CartItem, type CartLine } from '../src/lib/cart';
import {
  basketsOf,
  describeBasket,
  describeRecall,
  dropBasket,
  emptyBook,
  holdCart,
  HOLD_LIFETIME_MS,
  MAX_HELD,
  parseHoldBook,
  recallBasket,
  refreshLines,
  serializeHoldBook,
  type HoldBook,
  type Holder,
  withoutExpired,
} from '../src/lib/holds';

const MILK: CartItem = { id: 'i-milk', name: 'Milk 500ml', sellingPrice: 65 };
const BEEF: CartItem = { id: 'i-beef', name: 'Beef', sellingPrice: 450, weighed: true, unitType: 'kg' };
const WANJIKU: Holder = { branchId: 'b-1', userId: 'u-1' };
const OTIENO: Holder = { branchId: 'b-1', userId: 'u-2' };
const WANJIKU_ELSEWHERE: Holder = { branchId: 'b-2', userId: 'u-1' };
const NOON = Date.parse('2026-11-23T12:00:00.000Z');

function basket(): CartLine[] {
  let cart = addUnit([], MILK) ?? [];
  cart = setUnits(cart, 'i-milk', 2) ?? [];
  return addWeight(cart, BEEF, 1250) ?? [];
}

function held(book: HoldBook, cart: CartLine[], who: Holder, id: string, at = NOON): HoldBook {
  const result = holdCart(book, cart, who, at, id);
  assert.equal(result.ok, true);
  return result.ok ? result.book : book;
}

test('a basket can be put aside, and comes back with exactly what was in it', () => {
  const cart = basket();
  const result = holdCart(emptyBook(), cart, WANJIKU, NOON, 'h-1');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.basket.label, 'Basket 1');
  assert.equal(result.basket.heldAt, '2026-11-23T12:00:00.000Z');
  assert.deepEqual(result.basket.lines, cart);
  const recalled = recallBasket(result.book, [], 'h-1', WANJIKU, NOON, 'h-2');
  assert.deepEqual(recalled?.lines, cart);
  assert.deepEqual(recalled?.book.baskets, []);
  assert.equal(recalled?.parked, null);
});

test('what was held is a copy: changing the basket afterwards does not change the hold', () => {
  const cart = basket();
  const book = held(emptyBook(), cart, WANJIKU, 'h-1');
  (cart[0] as CartLine).quantity = 99;
  assert.equal(book.baskets[0]?.lines[0]?.quantity, 2);
  const recalled = recallBasket(book, [], 'h-1', WANJIKU, NOON, 'h-2');
  (recalled?.lines[0] as CartLine).quantity = 77;
  assert.equal(book.baskets[0]?.lines[0]?.quantity, 2);
});

test('an empty basket is not held', () => {
  assert.deepEqual(holdCart(emptyBook(), [], WANJIKU, NOON, 'h-1'), { ok: false, reason: 'empty' });
});

test('baskets are named by the lowest number free, and a freed number is used again', () => {
  let book = emptyBook();
  book = held(book, basket(), WANJIKU, 'h-1');
  book = held(book, basket(), WANJIKU, 'h-2');
  book = held(book, basket(), WANJIKU, 'h-3');
  assert.deepEqual(basketsOf(book, WANJIKU, NOON).map((b) => b.label).sort(), ['Basket 1', 'Basket 2', 'Basket 3']);
  book = dropBasket(book, 'h-2', WANJIKU);
  book = held(book, basket(), WANJIKU, 'h-4');
  assert.equal(book.baskets.find((b) => b.id === 'h-4')?.label, 'Basket 2');
});

test('one person holds no more than the limit at a branch, and the limit is theirs alone', () => {
  let book = emptyBook();
  for (let n = 0; n < MAX_HELD; n += 1) book = held(book, basket(), WANJIKU, `h-${n}`);
  assert.deepEqual(holdCart(book, basket(), WANJIKU, NOON, 'h-x'), { ok: false, reason: 'full' });
  assert.equal(holdCart(book, basket(), OTIENO, NOON, 'h-y').ok, true, 'another person is not held up by it');
  assert.equal(holdCart(book, basket(), WANJIKU_ELSEWHERE, NOON, 'h-z').ok, true, 'nor the same person at another branch');
});

test('a basket belongs to the person who held it, at the branch where they held it', () => {
  const book = held(emptyBook(), basket(), WANJIKU, 'h-1');
  assert.equal(basketsOf(book, WANJIKU, NOON).length, 1);
  assert.equal(basketsOf(book, OTIENO, NOON).length, 0, 'the next cashier does not see it');
  assert.equal(basketsOf(book, WANJIKU_ELSEWHERE, NOON).length, 0, 'nor does the same person at another branch');
  assert.equal(recallBasket(book, [], 'h-1', OTIENO, NOON, 'h-2'), null, 'and cannot pick it up');
  assert.equal(recallBasket(book, [], 'h-1', WANJIKU_ELSEWHERE, NOON, 'h-2'), null);
  assert.equal(dropBasket(book, 'h-1', OTIENO).baskets.length, 1, 'nor throw it away');
  assert.equal(dropBasket(book, 'h-1', WANJIKU).baskets.length, 0);
});

test('baskets are listed most recent first', () => {
  let book = emptyBook();
  book = held(book, basket(), WANJIKU, 'h-old', NOON - 60_000);
  book = held(book, basket(), WANJIKU, 'h-new', NOON);
  book = held(book, basket(), WANJIKU, 'h-mid', NOON - 30_000);
  assert.deepEqual(basketsOf(book, WANJIKU, NOON).map((b) => b.id), ['h-new', 'h-mid', 'h-old']);
});

test('picking a basket up while one is being rung puts the one being rung aside, so no sale is thrown away', () => {
  const first = basket();
  const second = addUnit([], MILK) ?? [];
  const book = held(emptyBook(), first, WANJIKU, 'h-1');
  const recalled = recallBasket(book, second, 'h-1', WANJIKU, NOON + 1000, 'h-2');
  assert.deepEqual(recalled?.lines, first);
  assert.deepEqual(recalled?.parked?.lines, second);
  assert.equal(recalled?.parked?.id, 'h-2');
  assert.equal(recalled?.parked?.label, 'Basket 1', 'the freed number is used for the one put aside');
  assert.deepEqual(recalled?.book.baskets.map((b) => b.id), ['h-2']);
});

test('a basket that is not there cannot be picked up', () => {
  assert.equal(recallBasket(emptyBook(), [], 'nope', WANJIKU, NOON, 'h-2'), null);
});

test('the book survives being saved and read back', () => {
  let book = held(emptyBook(), basket(), WANJIKU, 'h-1');
  book = held(book, setLinePrice(basket(), 'i-beef', 40000) ?? [], OTIENO, 'h-2', NOON - 5000);
  const back = parseHoldBook(serializeHoldBook(book), NOON + 60_000);
  const byId = (b: HoldBook) => [...b.baskets].sort((x, y) => x.id.localeCompare(y.id));
  assert.deepEqual(byId(back.book), byId(book), 'the same baskets, whatever order they are kept in');
  assert.deepEqual(back.book.baskets.map((b) => b.id), ['h-1', 'h-2'], 'read back most recent first');
  assert.equal(back.expired, 0);
  assert.equal(back.damaged, 0);
});

test('a basket a day old is dropped when read, and counted', () => {
  const book = held(emptyBook(), basket(), WANJIKU, 'h-1');
  const edge = parseHoldBook(serializeHoldBook(book), NOON + HOLD_LIFETIME_MS);
  assert.equal(edge.book.baskets.length, 1, 'exactly a day is still kept');
  const late = parseHoldBook(serializeHoldBook(book), NOON + HOLD_LIFETIME_MS + 1);
  assert.deepEqual(late.book.baskets, []);
  assert.equal(late.expired, 1);
});

test('nothing stored, or something that is not a book, is an empty book', () => {
  for (const raw of [null, '', 'not json', '[]', '"x"', 'null', '{}', '{"baskets":"x"}', '{"baskets":{}}', '42']) {
    const parsed = parseHoldBook(raw, NOON);
    assert.deepEqual(parsed.book.baskets, [], String(raw));
    assert.equal(parsed.expired, 0);
  }
});

function storedWith(change: (b: Record<string, unknown>) => void): string {
  const book = held(emptyBook(), basket(), WANJIKU, 'h-1');
  const copy = JSON.parse(serializeHoldBook(book)) as { baskets: Record<string, unknown>[] };
  change(copy.baskets[0] as Record<string, unknown>);
  return JSON.stringify(copy);
}

test('a basket that is damaged is dropped whole, never repaired by guessing', () => {
  const damage: [string, (b: Record<string, unknown>) => void][] = [
    ['no id', (b) => delete b.id],
    ['no label', (b) => delete b.label],
    ['no branch', (b) => delete b.branchId],
    ['no person', (b) => delete b.userId],
    ['no time', (b) => delete b.heldAt],
    ['a time that is not a time', (b) => (b.heldAt = 'yesterday-ish')],
    ['no lines', (b) => (b.lines = [])],
    ['lines that are not a list', (b) => (b.lines = 'x')],
    ['too many lines', (b) => (b.lines = Array.from({ length: 101 }, (_, n) => ({ itemId: `i-${n}`, name: 'x', quantity: 1, unitPrice: 1 })))],
    ['a line with no item', (b) => delete (b.lines as Record<string, unknown>[])[0]!.itemId],
    ['a line with no name', (b) => delete (b.lines as Record<string, unknown>[])[0]!.name],
    ['a quantity of zero', (b) => ((b.lines as Record<string, unknown>[])[0]!.quantity = 0)],
    ['a negative quantity', (b) => ((b.lines as Record<string, unknown>[])[0]!.quantity = -1)],
    ['half a unit', (b) => ((b.lines as Record<string, unknown>[])[0]!.quantity = 1.5)],
    ['a quantity that is text', (b) => ((b.lines as Record<string, unknown>[])[0]!.quantity = '2')],
    ['a price of zero', (b) => ((b.lines as Record<string, unknown>[])[0]!.unitPrice = 0)],
    ['a price that is text', (b) => ((b.lines as Record<string, unknown>[])[0]!.unitPrice = '65')],
    ['a price too large to be real', (b) => ((b.lines as Record<string, unknown>[])[0]!.unitPrice = 1e12)],
    ['a weight with grams of grams', (b) => ((b.lines as Record<string, unknown>[])[1]!.quantity = 1.2345)],
    ['a weight over the most', (b) => ((b.lines as Record<string, unknown>[])[1]!.quantity = 1000)],
    ['a shelf price that is text', (b) => ((b.lines as Record<string, unknown>[])[0]!.shelfPrice = 'x')],
    ['the same item twice', (b) => (b.lines as Record<string, unknown>[]).push({ ...(b.lines as Record<string, unknown>[])[0]! })],
    ['a line that is not an object', (b) => (b.lines as unknown[]).push(7)],
  ];
  for (const [what, change] of damage) {
    const parsed = parseHoldBook(storedWith(change), NOON);
    assert.deepEqual(parsed.book.baskets, [], what);
    assert.equal(parsed.damaged, 1, what);
  }
});

test('one damaged basket does not take the good ones with it', () => {
  const good = held(emptyBook(), basket(), WANJIKU, 'h-good');
  const stored = JSON.parse(serializeHoldBook(good)) as { baskets: unknown[] };
  stored.baskets.push({ id: 'h-bad' }, 'junk', null);
  const parsed = parseHoldBook(JSON.stringify(stored), NOON);
  assert.deepEqual(parsed.book.baskets.map((b) => b.id), ['h-good']);
  assert.equal(parsed.damaged, 3);
});

test('two baskets with one id are one basket', () => {
  const book = held(emptyBook(), basket(), WANJIKU, 'h-1');
  const stored = JSON.parse(serializeHoldBook(book)) as { baskets: unknown[] };
  stored.baskets.push(stored.baskets[0]);
  const parsed = parseHoldBook(JSON.stringify(stored), NOON);
  assert.equal(parsed.book.baskets.length, 1);
  assert.equal(parsed.damaged, 1);
});

test('a book with more baskets than a person may hold keeps the most recent ones', () => {
  const baskets = Array.from({ length: MAX_HELD + 3 }, (_, n) => ({
    id: `h-${n}`,
    label: `Basket ${n + 1}`,
    branchId: 'b-1',
    userId: 'u-1',
    heldAt: new Date(NOON - n * 1000).toISOString(),
    lines: [{ itemId: 'i-milk', name: 'Milk', quantity: 1, unitPrice: 65 }],
  }));
  const parsed = parseHoldBook(JSON.stringify({ baskets }), NOON);
  assert.equal(parsed.book.baskets.length, MAX_HELD);
  assert.equal(parsed.damaged, 3);
  assert.deepEqual(parsed.book.baskets.map((b) => b.id), baskets.slice(0, MAX_HELD).map((b) => b.id));
});

test('a shelf price that equals the price on the line is not kept as a change', () => {
  const stored = storedWith((b) => ((b.lines as Record<string, unknown>[])[0]!.shelfPrice = 65));
  const line = parseHoldBook(stored, NOON).book.baskets[0]?.lines[0];
  assert.equal(line !== undefined && 'shelfPrice' in line, false);
});

test('what the list says about a basket', () => {
  const book = held(emptyBook(), basket(), WANJIKU, 'h-1', NOON - 5 * 60_000);
  const [only] = book.baskets;
  assert.deepEqual(describeBasket(only!, NOON), { title: 'Basket 1', detail: '2 items · KES 692.50 · 5 min ago' });
  assert.equal(describeBasket(only!, NOON - 5 * 60_000).detail.endsWith('just now'), true);
  assert.equal(describeBasket(only!, NOON + 125 * 60_000).detail.endsWith('2 h ago'), true);
  const single = held(emptyBook(), addUnit([], MILK) ?? [], WANJIKU, 'h-2');
  assert.equal(describeBasket(single.baskets[0]!, NOON).detail.startsWith('1 item ·'), true);
});

// ---- bringing a recalled basket up to date ----

test('a line follows the shelf price when it has moved, and says so', () => {
  const cart = basket();
  const { lines, report } = refreshLines(cart, { 'i-milk': { ...MILK, sellingPrice: 70 }, 'i-beef': BEEF });
  assert.equal(lines.find((l) => l.itemId === 'i-milk')?.unitPrice, 70);
  assert.deepEqual(report.repriced, [{ name: 'Milk 500ml', from: 65, to: 70 }]);
  assert.deepEqual(describeRecall(report), ['Milk 500ml is now 70.00 (it was 65.00).']);
});

test('a line whose price has not moved is left alone', () => {
  const cart = basket();
  const { lines, report } = refreshLines(cart, { 'i-milk': MILK, 'i-beef': BEEF });
  assert.deepEqual(lines, cart);
  assert.deepEqual(report, { repriced: [], removed: [], unchecked: 0 });
  assert.deepEqual(describeRecall(report), []);
});

test("the cashier's own price stays when the shelf price moves, and what it is measured against moves", () => {
  const cart = setLinePrice(basket(), 'i-beef', 40000) ?? [];
  const { lines, report } = refreshLines(cart, { 'i-milk': MILK, 'i-beef': { ...BEEF, sellingPrice: 480 } });
  const beef = lines.find((l) => l.itemId === 'i-beef');
  assert.equal(beef?.unitPrice, 400);
  assert.equal(beef?.shelfPrice, 480);
  assert.deepEqual(report.repriced, []);
});

test("the cashier's own price that now equals the shelf price is no longer a change", () => {
  const cart = setLinePrice(basket(), 'i-beef', 40000) ?? [];
  const { lines } = refreshLines(cart, { 'i-milk': MILK, 'i-beef': { ...BEEF, sellingPrice: 400 } });
  const beef = lines.find((l) => l.itemId === 'i-beef');
  assert.equal(beef?.unitPrice, 400);
  assert.equal(beef !== undefined && 'shelfPrice' in beef, false);
});

test("the cashier's own price is left untouched when the shelf price is where it was", () => {
  const cart = setLinePrice(basket(), 'i-beef', 40000) ?? [];
  const { lines } = refreshLines(cart, { 'i-milk': MILK, 'i-beef': BEEF });
  assert.deepEqual(lines, cart);
});

test('an item that is no longer for sale is taken out, with the reason', () => {
  const { lines, report } = refreshLines(basket(), { 'i-milk': null, 'i-beef': BEEF });
  assert.deepEqual(lines.map((l) => l.itemId), ['i-beef']);
  assert.deepEqual(report.removed, [{ name: 'Milk 500ml', because: 'gone' }]);
  assert.deepEqual(describeRecall(report), ['Milk 500ml is no longer for sale, so it was taken out.']);
});

test('an item now sold another way cannot stay as it was', () => {
  const byUnit = refreshLines(basket(), { 'i-milk': { ...MILK, weighed: true, unitType: 'kg' }, 'i-beef': BEEF });
  assert.deepEqual(byUnit.report.removed, [{ name: 'Milk 500ml', because: 'changed' }]);
  const byWeight = refreshLines(basket(), { 'i-milk': MILK, 'i-beef': { ...BEEF, weighed: false } });
  assert.deepEqual(byWeight.report.removed, [{ name: 'Beef', because: 'changed' }]);
  const inGrams = refreshLines(basket(), { 'i-milk': MILK, 'i-beef': { ...BEEF, unitType: 'g' } });
  assert.deepEqual(inGrams.report.removed, [{ name: 'Beef', because: 'blocked' }]);
});

test('an item that has lost its price is taken out', () => {
  for (const sellingPrice of [0, -1, Number.NaN]) {
    const { report } = refreshLines(basket(), { 'i-milk': { ...MILK, sellingPrice }, 'i-beef': BEEF });
    assert.deepEqual(report.removed, [{ name: 'Milk 500ml', because: 'unpriced' }], String(sellingPrice));
  }
});

test('a price that could not be checked stays as held, and the cashier is told how many', () => {
  const none = refreshLines(basket(), {});
  assert.deepEqual(none.lines, basket());
  assert.equal(none.report.unchecked, 2);
  assert.deepEqual(describeRecall(none.report), ['2 prices could not be checked. They stay as they were held.']);
  const one = refreshLines(basket(), { 'i-milk': MILK });
  assert.deepEqual(describeRecall(one.report), ['One price could not be checked. It stays as it was held.']);
});

test('everything that changed is told, one sentence each, in a fixed order', () => {
  const { report } = refreshLines(basket(), { 'i-milk': { ...MILK, sellingPrice: 70 } });
  const words = describeRecall({ ...report, removed: [{ name: 'Tea', because: 'blocked' }, { name: 'Rice', because: 'unpriced' }] });
  assert.deepEqual(words, [
    'Milk 500ml is now 70.00 (it was 65.00).',
    'Tea can no longer be sold here, so it was taken out.',
    'Rice has no price now, so it was taken out.',
    'One price could not be checked. It stays as it was held.',
  ]);
});

test('refreshing never changes the lines it was given', () => {
  const cart = basket();
  const before = JSON.stringify(cart);
  refreshLines(cart, { 'i-milk': { ...MILK, sellingPrice: 70 }, 'i-beef': null });
  assert.equal(JSON.stringify(cart), before);
});

test('a basket too big to be read back from the phone is refused when it is held, not lost when it is read', () => {
  const big: CartLine[] = Array.from({ length: 101 }, (_, i) => ({ itemId: `i-${i}`, name: `Item ${i}`, quantity: 1, unitPrice: 10 }));
  assert.deepEqual(holdCart(emptyBook(), big, WANJIKU, NOON, 'h-1'), { ok: false, reason: 'big' });
  const exactly = big.slice(0, 100);
  const result = holdCart(emptyBook(), exactly, WANJIKU, NOON, 'h-1');
  assert.equal(result.ok, true);
  const back = parseHoldBook(result.ok ? serializeHoldBook(result.book) : null, NOON);
  assert.equal(back.damaged, 0);
  assert.equal(back.book.baskets[0]?.lines.length, 100);
});

test('a basket cannot be picked up when the one in front of the cashier cannot be put aside, and nothing is lost', () => {
  const book = held(emptyBook(), basket(), WANJIKU, 'h-1');
  const big: CartLine[] = Array.from({ length: 101 }, (_, i) => ({ itemId: `i-${i}`, name: `Item ${i}`, quantity: 1, unitPrice: 10 }));
  assert.equal(recallBasket(book, big, 'h-1', WANJIKU, NOON, 'h-2'), null);
  assert.equal(basketsOf(book, WANJIKU, NOON).length, 1, 'the held basket is still held');
});

test('stored text that is blank or too long makes the basket damaged, and it is dropped whole', () => {
  const good = {
    id: 'h-1',
    label: 'Basket 1',
    branchId: 'b-1',
    userId: 'u-1',
    heldAt: '2026-11-23T11:00:00.000Z',
    lines: [{ itemId: 'i-1', name: 'Milk', quantity: 1, unitPrice: 65 }],
  };
  const read = (change: Record<string, unknown>) => parseHoldBook(JSON.stringify({ baskets: [{ ...good, ...change }] }), NOON);
  assert.equal(read({}).book.baskets.length, 1);
  for (const change of [
    { label: '   ' },
    { id: 'x'.repeat(65) },
    { label: 'x'.repeat(41) },
    { lines: [{ itemId: 'i-1', name: '  ', quantity: 1, unitPrice: 65 }] },
    { lines: [{ itemId: 'i-1', name: 'x'.repeat(601), quantity: 1, unitPrice: 65 }] },
  ]) {
    const result = read(change);
    assert.equal(result.book.baskets.length, 0, JSON.stringify(change).slice(0, 60));
    assert.equal(result.damaged, 1);
  }
});

test('a product name as long as the server allows is held and read back whole', () => {
  const name = 'N'.repeat(500);
  const result = holdCart(emptyBook(), [{ itemId: 'i-long', name, quantity: 1, unitPrice: 65 }], WANJIKU, NOON, 'h-1');
  assert.equal(result.ok, true);
  const back = parseHoldBook(result.ok ? serializeHoldBook(result.book) : null, NOON);
  assert.equal(back.damaged, 0);
  assert.equal(back.book.baskets[0]?.lines[0]?.name, name);
});

test('a basket the phone could not read back is refused when it is held, and nothing changes', () => {
  const book = held(emptyBook(), basket(), WANJIKU, 'h-1');
  const before = JSON.stringify(book);
  for (const odd of [
    { itemId: 'i-1', name: 'N'.repeat(601), quantity: 1, unitPrice: 65 },
    { itemId: 'i-1', name: 'Gold', quantity: 1, unitPrice: 20_000_000 },
    { itemId: 'i-1', name: 'Half', quantity: 1.5, unitPrice: 65 },
    { itemId: 'i-1', name: 'Nothing', quantity: 1, unitPrice: Number.NaN },
    { itemId: '', name: 'No id', quantity: 1, unitPrice: 65 },
  ] as CartLine[]) {
    assert.deepEqual(holdCart(book, [odd], WANJIKU, NOON, 'h-2'), { ok: false, reason: 'unreadable' }, JSON.stringify(odd).slice(0, 50));
  }
  assert.equal(JSON.stringify(book), before, 'the book it was given is untouched');
  assert.equal(basketsOf(book, WANJIKU, NOON).length, 1);
});

test('a basket cannot be picked up when the sale in front of the cashier cannot be read back, and nothing is lost', () => {
  const book = held(emptyBook(), basket(), WANJIKU, 'h-1');
  const odd: CartLine[] = [{ itemId: 'i-1', name: 'N'.repeat(601), quantity: 1, unitPrice: 65 }];
  assert.equal(recallBasket(book, odd, 'h-1', WANJIKU, NOON, 'h-2'), null);
  assert.equal(basketsOf(book, WANJIKU, NOON).length, 1, 'the held basket is still held');
});

test('a basket that has run out is not listed, not counted, and cannot be picked up, even in a till that stays open', () => {
  const book = held(emptyBook(), basket(), WANJIKU, 'h-1');
  const next = NOON + HOLD_LIFETIME_MS + 1;
  assert.equal(basketsOf(book, WANJIKU, NOON + HOLD_LIFETIME_MS).length, 1, 'on the last moment of its day it is still there');
  assert.deepEqual(basketsOf(book, WANJIKU, next), []);
  assert.equal(recallBasket(book, [], 'h-1', WANJIKU, next, 'h-2'), null);
  assert.equal(recallBasket(book, [], 'h-1', WANJIKU, next - 1, 'h-2')?.basket.id, 'h-1');
});

test('holding again drops what has run out instead of saving it, and it does not count against the limit', () => {
  let book = emptyBook();
  for (let n = 1; n <= MAX_HELD; n += 1) book = held(book, basket(), WANJIKU, `h-${n}`);
  const next = NOON + HOLD_LIFETIME_MS + 1;
  assert.deepEqual(holdCart(book, basket(), WANJIKU, NOON, 'h-x'), { ok: false, reason: 'full' }, 'full while they are young');
  const again = holdCart(book, basket(), WANJIKU, next, 'h-new');
  assert.equal(again.ok, true, 'a day later the old ones are not in the way');
  if (!again.ok) return;
  assert.deepEqual(again.book.baskets.map((b) => b.id), ['h-new'], 'and are not saved again');
});

test('another person\'s expired basket is dropped when anyone holds, and the live ones stay', () => {
  let book = held(emptyBook(), basket(), OTIENO, 'h-old', NOON - HOLD_LIFETIME_MS);
  book = held(book, basket(), OTIENO, 'h-young', NOON - 1000);
  const result = holdCart(book, basket(), WANJIKU, NOON + 5, 'h-mine');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.book.baskets.map((b) => b.id).sort(), ['h-mine', 'h-young']);
});

test('a time ahead of the clock cannot make a basket last for ever: it counts from now', () => {
  const stored = storedWith((b) => (b.heldAt = '2999-01-01T00:00:00.000Z'));
  const parsed = parseHoldBook(stored, NOON);
  assert.equal(parsed.book.baskets.length, 1, 'the basket is kept');
  assert.equal(parsed.book.baskets[0]?.heldAt, '2026-11-23T12:00:00.000Z');
  assert.equal(parsed.expired, 0);
  assert.equal(parsed.damaged, 0);
  const later = parseHoldBook(serializeHoldBook(parsed.book), NOON + HOLD_LIFETIME_MS + 1);
  assert.deepEqual(later.book.baskets, [], 'and it runs out a day after that');
});

test('a time only a little ahead is also counted from now', () => {
  const parsed = parseHoldBook(storedWith((b) => (b.heldAt = '2026-11-23T12:00:01.000Z')), NOON);
  assert.equal(parsed.book.baskets[0]?.heldAt, '2026-11-23T12:00:00.000Z');
});

test('a time at or before now is left as it was written', () => {
  const parsed = parseHoldBook(storedWith((b) => (b.heldAt = '2026-11-23T11:00:00.000Z')), NOON);
  assert.equal(parsed.book.baskets[0]?.heldAt, '2026-11-23T11:00:00.000Z');
  const exactly = parseHoldBook(storedWith((b) => (b.heldAt = '2026-11-23T12:00:00.000Z')), NOON);
  assert.equal(exactly.book.baskets[0]?.heldAt, '2026-11-23T12:00:00.000Z');
});

test('a clock that cannot be read never makes a basket run out', () => {
  const book = held(emptyBook(), basket(), WANJIKU, 'h-1');
  assert.equal(basketsOf(book, WANJIKU, Number.NaN).length, 1);
  assert.equal(withoutExpired(book, Number.NaN), book);
});

test('nothing is copied when nothing has run out', () => {
  const book = held(emptyBook(), basket(), WANJIKU, 'h-1');
  assert.equal(withoutExpired(book, NOON + 1), book);
});

const SERVICE_LINE: CartLine = {
  itemId: 'svc:s-cut:p-1::30000',
  name: 'Haircut',
  quantity: 1,
  unitPrice: 300,
  service: { serviceId: 's-cut', performerId: 'p-1', performerName: 'Wanjiku', optionIds: [] },
};

test('a basket with a service in it is not put on hold, alone or among products', () => {
  for (const cart of [[SERVICE_LINE], [...basket(), SERVICE_LINE]]) {
    assert.deepEqual(holdCart(emptyBook(), cart, WANJIKU, NOON, 'h-1'), { ok: false, reason: 'service' });
  }
  assert.equal(holdCart(emptyBook(), basket(), WANJIKU, NOON, 'h-1').ok, true, 'products alone still can be');
});

test('a service line is never read back from what is stored, even if something wrote one', () => {
  const withService = storedWith((b) => {
    (b.lines as unknown[]).push(SERVICE_LINE);
  });
  const parsed = parseHoldBook(withService, NOON);
  assert.deepEqual(parsed.book.baskets, []);
  assert.equal(parsed.damaged, 1);
  // The made-up id alone is enough to refuse it: read back, it would be a product nobody sells.
  const idOnly = storedWith((b) => {
    (b.lines as Record<string, unknown>[])[0] = { itemId: 'svc:x', name: 'Odd', quantity: 1, unitPrice: 10 };
  });
  assert.equal(parseHoldBook(idOnly, NOON).book.baskets.length, 0);
});

test('picking a basket up while a service is being rung is refused, and nothing is lost', () => {
  const book = held(emptyBook(), basket(), WANJIKU, 'h-1');
  assert.equal(recallBasket(book, [SERVICE_LINE], 'h-1', WANJIKU, NOON, 'h-2'), null);
  assert.equal(book.baskets.length, 1);
});

test('a line that says it is a service is not read back, whatever its id', () => {
  const stored = storedWith((b) => {
    (b.lines as Record<string, unknown>[])[0] = { itemId: 'i-9', name: 'Odd', quantity: 1, unitPrice: 10, service: SERVICE_LINE.service };
  });
  assert.equal(parseHoldBook(stored, NOON).book.baskets.length, 0);
});
