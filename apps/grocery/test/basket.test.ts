import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addItem,
  BASKET_LIFETIME_MS,
  basketProblemWords,
  basketTotalCents,
  claimBasket,
  clearBasket,
  decodeBasket,
  emptyBasket,
  encodeBasket,
  lineTotalCents,
  MAX_BASKET_LINES,
  MAX_LINE_CENTS,
  removeLine,
  setQuantity,
  type Basket,
  type SaleItem,
} from '../src/lib/basket';

const OWNER = { ownerId: 'u1', branchId: 'b1' };
const SUGAR: SaleItem = { id: 'i1', name: 'Sugar', variantName: '1 kg', weighed: false, unitType: null, active: true, sellable: true, sellingCents: 19900 };
const FLOUR: SaleItem = { id: 'i2', name: 'Flour', variantName: null, weighed: true, unitType: 'kg', active: true, sellable: true, sellingCents: 12050 };
const ONE = 10_000;

function must(result: ReturnType<typeof addItem>): Basket {
  assert.ok(result.ok, JSON.stringify(result));
  return result.basket;
}

test('a line comes to quantity times price, to a whole cent, half up as the server rounds', () => {
  assert.equal(lineTotalCents(2 * ONE, 19900), 39800);
  assert.equal(lineTotalCents(15_000, 12050), 18075, '1.5 x 120.50');
  assert.equal(lineTotalCents(3333, 100), 33, '0.3333 x 1.00 = 0.3333, to 33 cents');
  assert.equal(lineTotalCents(5000, 1), 1, '0.5 x 0.01 = 0.005, half up to 1 cent');
  assert.equal(lineTotalCents(4999, 1), 0);
  assert.equal(lineTotalCents(1, 1), 0);
});

test('items go in at the shop price, named with their variant, and the same item adds to its line', () => {
  let basket = emptyBasket(OWNER, 1);
  basket = must(addItem(basket, SUGAR, 2 * ONE, 2, 'L1'));
  basket = must(addItem(basket, FLOUR, 15_000, 3, 'L2'));
  basket = must(addItem(basket, SUGAR, ONE, 4, 'L3'));
  assert.deepEqual(basket.lines, [
    { lineId: 'L1', itemId: 'i1', name: 'Sugar (1 kg)', unitName: 'each', weighed: false, quantityUnits: 3 * ONE, unitCents: 19900 },
    { lineId: 'L2', itemId: 'i2', name: 'Flour', unitName: 'kg', weighed: true, quantityUnits: 15_000, unitCents: 12050 },
  ]);
  assert.equal(basket.savedAt, 4);
  assert.equal(basketTotalCents(basket), 59700 + 18075);
});

test('adding the same item says which line it landed on, and keeps the line\'s price', () => {
  const first = addItem(emptyBasket(OWNER, 1), SUGAR, ONE, 2, 'L1');
  assert.ok(first.ok);
  const again = addItem(first.basket, { ...SUGAR, sellingCents: 25000 }, ONE, 3, 'L9');
  assert.ok(again.ok);
  assert.equal(again.lineId, 'L1');
  assert.equal(again.basket.lines[0]?.unitCents, 19900);
});

test('what cannot be sold is refused, and says why', () => {
  const basket = emptyBasket(OWNER, 1);
  const refused = (item: SaleItem, units: number) => {
    const result = addItem(basket, item, units, 2, 'L1');
    return result.ok ? 'ok' : result.why;
  };
  assert.equal(refused({ ...SUGAR, active: false }, ONE), 'not_for_sale');
  assert.equal(refused({ ...SUGAR, sellable: false }, ONE), 'not_for_sale');
  assert.equal(refused({ ...SUGAR, sellingCents: null }, ONE), 'no_price');
  assert.equal(refused({ ...SUGAR, sellingCents: 0 }, ONE), 'no_price');
  assert.equal(refused(SUGAR, 0), 'bad_quantity');
  assert.equal(refused(SUGAR, -ONE), 'bad_quantity');
  assert.equal(refused(SUGAR, 1.5), 'bad_quantity');
  assert.equal(refused(SUGAR, 15_000), 'fraction', 'sugar is sold whole');
  assert.equal(refused(FLOUR, 15_000), 'ok', 'flour is weighed');
  assert.equal(refused(SUGAR, 1_000_001 * ONE), 'too_big');
  assert.equal(refused({ ...SUGAR, sellingCents: 1_000_000_000 }, 1_000_000 * ONE), 'too_big', 'the line would come to more than the limit');
});

test('a line takes up to the quantity limit exactly, and not a unit more', () => {
  const cheap: SaleItem = { ...SUGAR, sellingCents: 1 };
  const cheapFlour: SaleItem = { ...FLOUR, sellingCents: 1 };
  const full = addItem(emptyBasket(OWNER, 1), cheap, 1_000_000 * ONE, 2, 'L1');
  assert.ok(full.ok, 'a million is allowed');
  assert.equal(full.basket.lines[0]?.quantityUnits, 1_000_000 * ONE);
  assert.deepEqual(addItem(full.basket, cheap, ONE, 3, 'L2'), { ok: false, why: 'too_big' }, 'one more on a full line');
  assert.ok(addItem(emptyBasket(OWNER, 1), cheapFlour, 1_000_000 * ONE, 2, 'L1').ok, 'a million, weighed');
  assert.deepEqual(addItem(emptyBasket(OWNER, 1), cheapFlour, 1_000_000 * ONE + 1, 2, 'L1'), { ok: false, why: 'too_big' }, 'weighed, the smallest step over');
  const nearly = must(addItem(emptyBasket(OWNER, 1), cheap, 999_999 * ONE, 2, 'L1'));
  assert.ok(addItem(nearly, cheap, ONE, 3, 'L2').ok, 'the last one that fits');
  assert.deepEqual(addItem(nearly, cheap, 2 * ONE, 3, 'L2'), { ok: false, why: 'too_big' });
  assert.ok(setQuantity(nearly, 'L1', 1_000_000 * ONE, 4).ok, 'a quantity can be set to the limit');
  assert.deepEqual(setQuantity(nearly, 'L1', 1_000_000 * ONE + ONE, 4), { ok: false, why: 'too_big' });
});

test('a refused add leaves the basket as it was, and a line that would grow too big is refused', () => {
  const basket = must(addItem(emptyBasket(OWNER, 1), { ...SUGAR, sellingCents: 1_000_000_000 }, 900 * ONE, 2, 'L1'));
  const more = addItem(basket, { ...SUGAR, sellingCents: 1_000_000_000 }, 900 * ONE, 3, 'L2');
  assert.deepEqual(more, { ok: false, why: 'too_big' });
  assert.equal(basket.lines[0]?.quantityUnits, 900 * ONE);
  assert.ok(MAX_LINE_CENTS >= 900 * 1_000_000_000);
});

test('a basket holds a limited number of different items, but an item on it can still take more', () => {
  let basket = emptyBasket(OWNER, 1);
  for (let n = 0; n < MAX_BASKET_LINES; n += 1) basket = must(addItem(basket, { ...SUGAR, id: `i${n}` }, ONE, 2, `L${n}`));
  assert.deepEqual(addItem(basket, { ...SUGAR, id: 'extra' }, ONE, 3, 'Lx'), { ok: false, why: 'too_many_lines' });
  assert.ok(addItem(basket, { ...SUGAR, id: 'i0' }, ONE, 3, 'Lx').ok);
});

test('a line\'s quantity can be changed, and taking a line out is its own step', () => {
  let basket = must(addItem(emptyBasket(OWNER, 1), SUGAR, ONE, 2, 'L1'));
  basket = must(addItem(basket, FLOUR, 15_000, 3, 'L2'));
  const changed = setQuantity(basket, 'L1', 4 * ONE, 5);
  assert.ok(changed.ok);
  assert.equal(changed.basket.lines[0]?.quantityUnits, 4 * ONE);
  assert.equal(changed.basket.savedAt, 5);
  assert.deepEqual(setQuantity(basket, 'L1', 0, 5), { ok: false, why: 'bad_quantity' });
  assert.deepEqual(setQuantity(basket, 'L1', 15_000, 5), { ok: false, why: 'fraction' });
  assert.deepEqual(setQuantity(basket, 'L2', 2 * ONE + 10, 5).ok, true, 'a weighed line takes a thousandth');
  assert.deepEqual(setQuantity(basket, 'nope', ONE, 5), { ok: false, why: 'no_line' });
  const same = setQuantity(basket, 'L1', ONE, 9);
  assert.ok(same.ok);
  assert.equal(same.basket, basket, 'the same quantity changes nothing, not even the time');
  assert.deepEqual(removeLine(basket, 'L1', 6).lines.map((line) => line.lineId), ['L2']);
  assert.equal(removeLine(basket, 'nope', 6), basket);
  assert.deepEqual(clearBasket(basket, 7).lines, []);
  const empty = emptyBasket(OWNER, 1);
  assert.equal(clearBasket(empty, 7), empty);
});

test('the basket belongs to one person at one branch, and a day-old one is let go', () => {
  const basket = must(addItem(emptyBasket(OWNER, 1000), SUGAR, ONE, 1000, 'L1'));
  assert.equal(claimBasket(basket, OWNER, 2000), basket);
  assert.deepEqual(claimBasket(basket, { ownerId: 'u2', branchId: 'b1' }, 2000), emptyBasket({ ownerId: 'u2', branchId: 'b1' }, 2000));
  assert.deepEqual(claimBasket(basket, { ownerId: 'u1', branchId: 'b2' }, 2000).lines, []);
  assert.deepEqual(claimBasket(basket, OWNER, 1000 + BASKET_LIFETIME_MS + 1).lines, []);
  assert.equal(claimBasket(basket, OWNER, 1000 + BASKET_LIFETIME_MS), basket);
  assert.deepEqual(claimBasket(null, OWNER, 5), emptyBasket(OWNER, 5));
});

test('a basket is kept on the phone and read back exactly; an empty one is not kept', () => {
  let basket = must(addItem(emptyBasket(OWNER, 1000), SUGAR, 2 * ONE, 1001, 'L1'));
  basket = must(addItem(basket, FLOUR, 15_000, 1002, 'L2'));
  const text = encodeBasket(basket);
  assert.ok(text);
  assert.deepEqual(decodeBasket(text, 2000), basket);
  assert.equal(encodeBasket(emptyBasket(OWNER, 1)), null);
  assert.equal(encodeBasket(null), null);
});

test('a basket that cannot be read is no basket, and neither is a stale one', () => {
  assert.equal(decodeBasket(null, 1), null);
  assert.equal(decodeBasket('', 1), null);
  assert.equal(decodeBasket('{', 1), null);
  assert.equal(decodeBasket('[]', 1), null);
  const good = JSON.parse(encodeBasket(must(addItem(emptyBasket(OWNER, 1000), SUGAR, ONE, 1000, 'L1'))) as string);
  const line = good.lines[0];
  const broken = [
    { ...good, v: 2 },
    { ...good, ownerId: '' },
    { ...good, lines: [{ ...line, quantityUnits: 0 }] },
    { ...good, lines: [{ ...line, quantityUnits: 1.5 }] },
    { ...good, lines: [{ ...line, unitCents: 0 }] },
    { ...good, lines: [{ ...line, unitCents: 1.5 }] },
    { ...good, lines: [{ ...line, weighed: 'yes' }] },
    { ...good, lines: [{ ...line, unitName: '' }] },
    { ...good, lines: [{ ...line, quantityUnits: 1_000_000 * ONE, unitCents: 1_000_000_000 }] },
    { ...good, lines: [null] },
    { ...good, lines: Array.from({ length: MAX_BASKET_LINES + 1 }, () => line) },
  ];
  for (const item of broken) assert.equal(decodeBasket(JSON.stringify(item), 1500), null, JSON.stringify(item).slice(0, 80));
  assert.ok(decodeBasket(JSON.stringify(good), 1000 + BASKET_LIFETIME_MS));
  assert.equal(decodeBasket(JSON.stringify(good), 1000 + BASKET_LIFETIME_MS + 1), null);
});

test('the most one line can come to is allowed to the cent, and a cent more is not, whichever way the line grows', () => {
  const costly: SaleItem = { ...SUGAR, id: 'costly', sellingCents: 1_000_000_000 };
  // 1,000 of them at KES 10,000,000.00 is exactly the most a line may come to.
  assert.ok(addItem(emptyBasket(OWNER, 1), costly, 1000 * ONE, 1, 'L').ok);
  assert.deepEqual(addItem(emptyBasket(OWNER, 1), costly, 1001 * ONE, 1, 'L'), { ok: false, why: 'too_big' });
  const line = must(addItem(emptyBasket(OWNER, 1), costly, 600 * ONE, 1, 'L'));
  assert.ok(addItem(line, costly, 400 * ONE, 2, 'M').ok);
  assert.deepEqual(addItem(line, costly, 401 * ONE, 2, 'M'), { ok: false, why: 'too_big' });
  assert.ok(setQuantity(line, 'L', 1000 * ONE, 3).ok);
  assert.deepEqual(setQuantity(line, 'L', 1001 * ONE, 3), { ok: false, why: 'too_big' });
});

function keptBasket(): { good: Record<string, unknown>; line: Record<string, unknown> } {
  const good = JSON.parse(encodeBasket(must(addItem(emptyBasket(OWNER, 1000), SUGAR, ONE, 1000, 'L1'))) as string);
  return { good, line: good.lines[0] };
}

test('a kept basket is read only when every part of it is right, one wrong part at a time', () => {
  const { good, line } = keptBasket();
  const withLine = (change: Record<string, unknown>) => ({ ...good, lines: [{ ...line, ...change }] });
  const broken = [
    withLine({ lineId: '' }),
    withLine({ itemId: '' }),
    withLine({ name: 5 }),
    withLine({ unitName: 'x'.repeat(25) }),
    withLine({ weighed: 1 }),
    withLine({ quantityUnits: 1_000_000 * ONE + 1 }),
    withLine({ unitCents: 1_000_000_001 }),
    withLine({ quantityUnits: 1001 * ONE, unitCents: 1_000_000_000 }),
    { ...good, branchId: '' },
    { ...good, savedAt: 'x' },
    { ...good, lines: 'x' },
  ];
  for (const item of broken) assert.equal(decodeBasket(JSON.stringify(item), 1500), null, JSON.stringify(item).slice(0, 90));
  assert.equal(decodeBasket('null', 1500), null);
  assert.equal(decodeBasket('5', 1500), null);
});

test('a kept basket at the very limits is still read', () => {
  const { good, line } = keptBasket();
  const withLine = (change: Record<string, unknown>) => ({ ...good, lines: [{ ...line, ...change }] });
  const edges = [
    withLine({ unitName: 'x'.repeat(24) }),
    withLine({ quantityUnits: 1_000_000 * ONE, unitCents: 1 }),
    withLine({ unitCents: 1_000_000_000, quantityUnits: ONE }),
    withLine({ quantityUnits: 1000 * ONE, unitCents: 1_000_000_000 }),
    { ...good, lines: Array.from({ length: MAX_BASKET_LINES }, () => line) },
  ];
  for (const item of edges) assert.ok(decodeBasket(JSON.stringify(item), 1500), JSON.stringify(item).slice(0, 90));
});

test('a weight takes three decimals at most, because the invoice keeps three', () => {
  const basket = emptyBasket(OWNER, 1);
  const flour = (units: number) => {
    const result = addItem(basket, FLOUR, units, 2, 'L1');
    return result.ok ? 'ok' : result.why;
  };
  assert.equal(flour(12_500), 'ok', '1.25');
  assert.equal(flour(3_750), 'ok', '0.375');
  assert.equal(flour(10), 'ok', 'the smallest weight: a gram');
  assert.equal(flour(12_345), 'too_precise', '1.2345 would be 1.235 on the invoice');
  assert.equal(flour(1), 'too_precise');
  assert.equal(flour(1_000_000 * ONE + 1), 'too_big', 'too big is said first');
  assert.match(basketProblemWords.too_precise, /three decimals/);

  const line = addItem(basket, FLOUR, 15_000, 2, 'L1');
  assert.ok(line.ok);
  assert.deepEqual(setQuantity(line.basket, 'L1', 12_345, 3), { ok: false, why: 'too_precise' }, 'a quantity changed on the line is held to the same step');
  assert.deepEqual(addItem(line.basket, FLOUR, 5, 4, 'L2'), { ok: false, why: 'too_precise' }, 'so is one added to it');
  assert.ok(setQuantity(line.basket, 'L1', 12_340, 3).ok);
  assert.deepEqual(addItem(basket, SUGAR, 15_000, 2, 'L1'), { ok: false, why: 'fraction' }, 'something sold whole still says so');
});
