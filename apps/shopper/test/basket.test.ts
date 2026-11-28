import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptAnswer,
  changedSince,
  clearBasket,
  emptyBasket,
  forgetCart,
  hasPending,
  itemCount,
  LAPSE_MARGIN_MS,
  nextRetryDelayMs,
  parseBasket,
  pendingChanges,
  quantityOf,
  readyToOrder,
  refuse,
  serializeBasket,
  setQuantity,
  viewOf,
  type Basket,
  type ItemFacts,
  type ServerCart,
} from '../src/lib/basket';

const T0 = new Date('2026-11-23T09:00:00.000Z');
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);

const TEA: ItemFacts = { itemId: 'tea', name: 'Tea 500g', unitPrice: 120 };
const MILK: ItemFacts = { itemId: 'milk', name: 'Milk 1L', unitPrice: 65, imageUrl: 'https://img/milk.png' };

function cartOf(lines: Array<[string, number, number]>, extra: Partial<ServerCart> = {}): ServerCart {
  return {
    id: 'cart-1',
    currency: 'KES',
    expiresAt: '2026-12-01T00:00:00.000Z',
    subtotal: lines.reduce((sum, [, q, p]) => sum + q * p, 0),
    lines: lines.map(([itemId, quantity, unitPrice]) => ({ itemId, name: itemId.toUpperCase(), quantity, unitPrice, lineTotal: quantity * unitPrice })),
    ...extra,
  };
}

test('a tap is kept at once, with what the product showed, and counted', () => {
  let basket = emptyBasket(T0);
  basket = setQuantity(basket, TEA, 2, at(1));
  basket = setQuantity(basket, MILK, 1, at(2));
  assert.equal(itemCount(basket), 3);
  assert.equal(quantityOf(basket, 'tea'), 2);
  assert.deepEqual(basket.lines[0], { itemId: 'tea', name: 'Tea 500g', variantName: null, imageUrl: null, quantity: 2, unitPrice: 120, lineTotal: 240 });
  assert.equal(basket.lines[1].imageUrl, 'https://img/milk.png');
  assert.equal(basket.updatedAt, at(2).toISOString());
});

test('changing a quantity keeps the line where it was, and zero takes it out', () => {
  let basket = setQuantity(setQuantity(emptyBasket(T0), TEA, 2, at(1)), MILK, 1, at(2));
  basket = setQuantity(basket, TEA, 5, at(3));
  assert.deepEqual(basket.lines.map((l) => [l.itemId, l.quantity, l.lineTotal]), [['tea', 5, 600], ['milk', 1, 65]]);
  basket = setQuantity(basket, TEA, 0, at(4));
  assert.deepEqual(basket.lines.map((l) => l.itemId), ['milk']);
  assert.equal(setQuantity(basket, TEA, -3, at(5)).lines.length, 1, 'less than nothing is nothing');
  assert.equal(setQuantity(basket, TEA, Number.NaN, at(5)).lines.length, 1);
});

test('a quantity is kept to the four places the shop keeps', () => {
  const basket = setQuantity(emptyBasket(T0), TEA, 0.123456, at(1));
  assert.equal(basket.lines[0].quantity, 0.1235);
});

test('a product shown without a price is added, and priced when the shop answers', () => {
  const basket = setQuantity(emptyBasket(T0), { itemId: 'x', name: 'X' }, 1, at(1));
  assert.equal(basket.lines[0].unitPrice, null);
  assert.equal(basket.lines[0].lineTotal, null);
  assert.equal(viewOf(basket).subtotal, null);
});

test('what the shop has not been told is what differs from what it holds, removals last', () => {
  let basket = setQuantity(setQuantity(emptyBasket(T0), TEA, 2, at(1)), MILK, 1, at(2));
  assert.deepEqual(pendingChanges(basket), [{ itemId: 'tea', quantity: 2 }, { itemId: 'milk', quantity: 1 }]);
  basket = acceptAnswer(basket, cartOf([['tea', 2, 120], ['milk', 1, 65]]), at(3));
  assert.equal(hasPending(basket), false);
  basket = setQuantity(basket, TEA, 3, at(4));
  basket = setQuantity(basket, MILK, 0, at(5));
  assert.deepEqual(pendingChanges(basket), [{ itemId: 'tea', quantity: 3 }, { itemId: 'milk', quantity: 0 }]);
});

test('the shop\'s answer sets the prices and the total, and the basket then agrees with it', () => {
  let basket = setQuantity(emptyBasket(T0), TEA, 2, at(1));
  basket = acceptAnswer(basket, cartOf([['tea', 2, 110]]), at(2));
  assert.equal(basket.cartId, 'cart-1');
  assert.equal(basket.subtotal, 220);
  assert.equal(basket.lines[0].unitPrice, 110, 'a price break the phone did not know of');
  assert.equal(basket.lines[0].lineTotal, 220);
  assert.equal(basket.answeredAt, at(2).toISOString());
  assert.equal(basket.cartExpiresAt, '2026-12-01T00:00:00.000Z');
  assert.deepEqual(viewOf(basket), { currency: 'KES', subtotal: 220, isEstimate: false, waiting: false });
});

test('a quantity changed since the shop last heard is not overwritten by its answer', () => {
  let basket = setQuantity(emptyBasket(T0), TEA, 2, at(1));
  basket = acceptAnswer(basket, cartOf([['tea', 2, 120]]), at(2));
  basket = setQuantity(basket, TEA, 3, at(3));
  basket = acceptAnswer(basket, cartOf([['tea', 2, 118]]), at(4));
  assert.equal(basket.lines[0].quantity, 3, 'the shopper\'s tap stands');
  assert.equal(basket.lines[0].unitPrice, 118, 'the shop\'s price is taken');
  assert.equal(basket.lines[0].lineTotal, 354, 'and the line is reckoned at it');
  assert.deepEqual(pendingChanges(basket), [{ itemId: 'tea', quantity: 3 }]);
  assert.deepEqual(viewOf(basket), { currency: 'KES', subtotal: 354, isEstimate: true, waiting: true });
});

test('a line taken out since the shop last heard is not brought back by its answer', () => {
  let basket = setQuantity(emptyBasket(T0), TEA, 2, at(1));
  basket = acceptAnswer(basket, cartOf([['tea', 2, 120]]), at(2));
  basket = setQuantity(basket, TEA, 0, at(3));
  basket = acceptAnswer(basket, cartOf([['tea', 2, 120]]), at(4));
  assert.equal(basket.lines.length, 0);
  assert.deepEqual(pendingChanges(basket), [{ itemId: 'tea', quantity: 0 }]);
});

test('with nothing waiting, the shop\'s cart wins: a line it dropped is dropped, and one it holds is shown', () => {
  let basket = setQuantity(emptyBasket(T0), TEA, 2, at(1));
  basket = acceptAnswer(basket, cartOf([['tea', 2, 120]]), at(2));
  basket = acceptAnswer(basket, cartOf([['milk', 4, 65]]), at(3));
  assert.deepEqual(basket.lines.map((l) => [l.itemId, l.quantity]), [['milk', 4]]);
  assert.deepEqual(basket.sent, { milk: 4 });
});

test('the shop capping a quantity is taken when nothing else is waiting', () => {
  let basket = setQuantity(emptyBasket(T0), TEA, 9, at(1));
  basket = acceptAnswer(basket, cartOf([['tea', 5, 120]]), at(2));
  assert.equal(basket.lines[0].quantity, 9, 'it was waiting to be told, so the shopper\'s amount stands until it is');
  assert.deepEqual(pendingChanges(basket), [{ itemId: 'tea', quantity: 9 }]);
});

test('a line the shop refused keeps its words and is not sent again until the shopper changes it', () => {
  let basket = setQuantity(emptyBasket(T0), TEA, 9, at(1));
  basket = acceptAnswer(basket, cartOf([]), at(2));
  basket = refuse(basket, 'tea', 'Only 3 available at this store', at(3));
  assert.equal(basket.refused.tea, 'Only 3 available at this store');
  assert.deepEqual(pendingChanges(basket), []);
  assert.deepEqual(viewOf(basket).isEstimate, true);
  basket = acceptAnswer(basket, cartOf([['milk', 1, 65]]), at(4));
  assert.equal(basket.lines.find((l) => l.itemId === 'tea')?.quantity, 9, 'a refused line is not lost to an answer about another');
  basket = setQuantity(basket, TEA, 3, at(5));
  assert.equal(basket.refused.tea, undefined);
  assert.deepEqual(pendingChanges(basket), [{ itemId: 'tea', quantity: 3 }], 'only the line the shopper changed is to be told; the shop already holds the milk');
});

test('a line changed since the shop was told is found out by the amount it was told', () => {
  let basket = setQuantity(emptyBasket(T0), TEA, 3, at(1));
  assert.equal(changedSince(basket, { itemId: 'tea', quantity: 3 }).size, 0, 'as told');
  assert.deepEqual([...changedSince(basket, { itemId: 'tea', quantity: 2 })], ['tea'], 'not as told');
  basket = setQuantity(basket, TEA, 0, at(2));
  assert.deepEqual([...changedSince(basket, { itemId: 'tea', quantity: 3 })], ['tea'], 'taken out since');
  assert.equal(changedSince(basket, { itemId: 'tea', quantity: 0 }).size, 0, 'taken out, as told');
});

test('an answer about a line the shopper has changed back since it was sent does not undo the change', () => {
  for (const [from, to] of [[2, 3], [3, 4]]) {
    let basket = setQuantity(emptyBasket(T0), TEA, from, at(1));
    basket = acceptAnswer(basket, cartOf([['tea', from, 120]]), at(2));
    basket = setQuantity(basket, TEA, to, at(3)); // told to the shop...
    const told = { itemId: 'tea', quantity: to };
    basket = setQuantity(basket, TEA, from, at(4)); // ...and taken back before the shop answered
    assert.equal(pendingChanges(basket).length, 0, 'to the basket it is where the shop was');
    basket = acceptAnswer(basket, cartOf([['tea', to, 120]]), at(5), changedSince(basket, told));
    assert.equal(quantityOf(basket, 'tea'), from, `${from}->${to}->${from} is ${from}`);
    assert.deepEqual(pendingChanges(basket), [{ itemId: 'tea', quantity: from }], 'and the shop is to be told again');
  }
});

test('an answer about a new line the shopper has taken out since it was sent does not bring it back', () => {
  let basket = setQuantity(emptyBasket(T0), TEA, 1, at(1));
  const told = { itemId: 'tea', quantity: 1 };
  basket = setQuantity(basket, TEA, 0, at(2));
  basket = acceptAnswer(basket, cartOf([['tea', 1, 120]]), at(3), changedSince(basket, told));
  assert.equal(basket.lines.length, 0);
  assert.deepEqual(pendingChanges(basket), [{ itemId: 'tea', quantity: 0 }]);
});

test('with nothing changed since, an answer is the shop\'s word as before', () => {
  let basket = setQuantity(emptyBasket(T0), TEA, 3, at(1));
  const told = { itemId: 'tea', quantity: 3 };
  basket = acceptAnswer(basket, cartOf([['tea', 2, 118]]), at(2), changedSince(basket, told));
  assert.equal(quantityOf(basket, 'tea'), 3, 'the shopper\'s amount stands until the shop has it');
  assert.equal(basket.lines[0].unitPrice, 118);
});

test('a cart the shop dropped keeps the lines and starts again: all of it is waiting to be told', () => {
  let basket = setQuantity(setQuantity(emptyBasket(T0), TEA, 2, at(1)), MILK, 1, at(2));
  basket = acceptAnswer(basket, cartOf([['tea', 2, 120], ['milk', 1, 65]]), at(3));
  basket = forgetCart(basket, at(4));
  assert.equal(basket.cartId, null);
  assert.equal(basket.subtotal, null);
  assert.deepEqual(basket.sent, {});
  assert.equal(basket.lines.length, 2);
  assert.equal(pendingChanges(basket).length, 2);
});

test('an order is placed only from a basket the shop has fully heard and priced', () => {
  const ok = (b: Basket, when = at(10)) => readyToOrder(b, when);
  assert.deepEqual(ok(emptyBasket(T0)), { ready: false, why: 'empty' });
  let basket = setQuantity(emptyBasket(T0), TEA, 2, at(1));
  assert.deepEqual(ok(basket), { ready: false, why: 'waiting' });
  basket = acceptAnswer(basket, cartOf([['tea', 2, 120]]), at(2));
  assert.deepEqual(ok(basket), { ready: true });
  assert.deepEqual(ok(refuse(basket, 'tea', 'no', at(3))), { ready: false, why: 'refused' });
  assert.deepEqual(ok(setQuantity(basket, TEA, 3, at(3))), { ready: false, why: 'waiting' });
  assert.deepEqual(ok({ ...basket, cartId: null, sent: {} }), { ready: false, why: 'waiting' }, 'nothing is held by a cart that is not there');
  assert.deepEqual(ok({ ...basket, subtotal: null }), { ready: false, why: 'unpriced' });
  assert.deepEqual(ok({ ...basket, lines: [{ ...basket.lines[0], unitPrice: null }] }), { ready: false, why: 'unpriced' });
});

test('a cart about to lapse is not ordered from', () => {
  let basket = setQuantity(emptyBasket(T0), TEA, 2, at(1));
  basket = acceptAnswer(basket, cartOf([['tea', 2, 120]], { expiresAt: at(100).toISOString() }), at(2));
  assert.deepEqual(readyToOrder(basket, new Date(at(100).getTime() - LAPSE_MARGIN_MS - 1)), { ready: true });
  assert.deepEqual(readyToOrder(basket, new Date(at(100).getTime() - LAPSE_MARGIN_MS)), { ready: false, why: 'lapsed' });
  assert.deepEqual(readyToOrder(basket, at(200)), { ready: false, why: 'lapsed' });
});

test('the total is the shop\'s when it has heard everything, and the phone\'s, marked, when it has not', () => {
  assert.deepEqual(viewOf(emptyBasket(T0)), { currency: 'KES', subtotal: 0, isEstimate: false, waiting: false });
  let basket = setQuantity(setQuantity(emptyBasket(T0), TEA, 2, at(1)), MILK, 1, at(2));
  assert.deepEqual(viewOf(basket), { currency: 'KES', subtotal: 305, isEstimate: true, waiting: true });
  basket = acceptAnswer(basket, cartOf([['tea', 2, 120], ['milk', 1, 65]], { subtotal: 300 }), at(3));
  assert.deepEqual(viewOf(basket), { currency: 'KES', subtotal: 300, isEstimate: false, waiting: false });
});

test('the wait before trying the shop again grows, and stops growing at a minute', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9, 50].map(nextRetryDelayMs), [0, 5000, 10000, 20000, 40000, 60000, 60000, 60000]);
  assert.equal(nextRetryDelayMs(-1), 0);
});

test('after an order the basket is empty', () => {
  const basket = clearBasket(at(9));
  assert.deepEqual(basket.lines, []);
  assert.equal(basket.cartId, null);
});

test('what is read back is what was kept, and damaged data is an empty basket', () => {
  let basket = setQuantity(setQuantity(emptyBasket(T0), TEA, 2, at(1)), MILK, 1, at(2));
  basket = acceptAnswer(basket, cartOf([['tea', 2, 120]]), at(3));
  basket = refuse(basket, 'milk', 'Out of stock', at(4));
  assert.deepEqual(parseBasket(serializeBasket(basket), at(9)), basket);
  for (const bad of [null, undefined, '', 'x', '[]', '{"lines":"x"}', 'null']) {
    assert.deepEqual(parseBasket(bad, at(9)).lines, [], String(bad));
  }
});

test('a damaged line, a repeated line, or a refusal for a line that is not there is left out', () => {
  const raw = JSON.stringify({
    v: 1,
    cartId: 'c',
    lines: [
      { itemId: 'a', name: 'A', quantity: 1, unitPrice: 5, lineTotal: 5 },
      { itemId: 'a', name: 'A again', quantity: 9 },
      { itemId: '', name: 'No id', quantity: 1 },
      { itemId: 'b', name: 'B', quantity: 0 },
      { itemId: 'c', name: 'C', quantity: 'many' },
      { itemId: 'd', quantity: 2 },
    ],
    sent: { a: 1, z: -2, y: 'x' },
    refused: { a: 'Only 1', q: 'ghost' },
  });
  const basket = parseBasket(raw, at(9));
  assert.deepEqual(basket.lines.map((l) => [l.itemId, l.name, l.quantity]), [['a', 'A', 1], ['d', 'Item', 2]]);
  assert.deepEqual(basket.sent, { a: 1 });
  assert.deepEqual(basket.refused, { a: 'Only 1' });
  assert.equal(basket.cartId, 'c');
});

test('removals are told in the order of the item ids, so the same basket always sends the same calls', () => {
  const item = (itemId: string): ItemFacts => ({ itemId, name: itemId.toUpperCase(), unitPrice: 10 });
  let basket = emptyBasket(T0);
  for (const id of ['c', 'a', 'b']) basket = setQuantity(basket, item(id), 1, at(1));
  basket = acceptAnswer(basket, cartOf([['c', 1, 10], ['a', 1, 10], ['b', 1, 10]]), at(2));
  for (const id of ['c', 'a', 'b']) basket = setQuantity(basket, item(id), 0, at(3));
  assert.deepEqual(pendingChanges(basket).map((change) => change.itemId), ['a', 'b', 'c']);
});

test('what the shop says is taken as it says it: no price, no total, no expiry, and a line at nothing is no line', () => {
  let basket = acceptAnswer(setQuantity(emptyBasket(T0), TEA, 1, at(1)), cartOf([['tea', 1, 120]]), at(2));
  assert.equal(basket.lines[0].unitPrice, 120);
  assert.equal(basket.subtotal, 120);
  assert.equal(basket.cartExpiresAt, '2026-12-01T00:00:00.000Z');
  basket = acceptAnswer(
    basket,
    { id: 'cart-1', lines: [{ itemId: 'tea', quantity: 1, unitPrice: null, lineTotal: null }], subtotal: null, expiresAt: undefined },
    at(3),
  );
  assert.equal(basket.lines[0].unitPrice, null, 'a price the shop no longer gives is not kept from before');
  assert.equal(basket.subtotal, null, 'nor a total');
  assert.equal(basket.cartExpiresAt, null, 'nor an expiry');
  assert.deepEqual(readyToOrder(basket, at(4)), { ready: false, why: 'unpriced' });
  basket = acceptAnswer(basket, cartOf([['tea', 0, 120], ['milk', 2, 65]]), at(5));
  assert.deepEqual(basket.lines.map((line) => [line.itemId, line.quantity]), [['milk', 2]]);
});

test('each line the shop refuses keeps its own words', () => {
  let basket = setQuantity(setQuantity(emptyBasket(T0), TEA, 1, at(1)), MILK, 1, at(2));
  basket = refuse(basket, 'tea', 'No stock.', at(3));
  basket = refuse(basket, 'milk', 'Not sold online.', at(4));
  assert.deepEqual(basket.refused, { tea: 'No stock.', milk: 'Not sold online.' });
});

test('money is kept to the cent, not as floating point leaves it', () => {
  const basket = setQuantity(emptyBasket(T0), { itemId: 'x', name: 'X', unitPrice: 0.1 }, 3, at(1));
  assert.equal(basket.lines[0].lineTotal, 0.3);
  const two = setQuantity(basket, { itemId: 'y', name: 'Y', unitPrice: 0.2 }, 1, at(2));
  assert.equal(viewOf(two).subtotal, 0.5);
});
