import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTryAgain,
  classifyOrderFailure,
  describeRefusal,
  IN_DOUBT_MIN_GAP_MS,
  isShopsRefusal,
  itemIsGone,
  matchPlacedOrder,
  MATCH_SLACK_MS,
  parseDoubt,
  serializeDoubt,
  withoutKnown,
  type DoubtRecord,
} from '../src/lib/checkout-outcome';
import { ShopApiError } from '../src/lib/shop-http';

const T0 = Date.parse('2026-11-23T09:00:00.000Z');
const iso = (offsetSeconds: number) => new Date(T0 + offsetSeconds * 1000).toISOString();

const http = (status: number, detail = '') => new ShopApiError('http', status, detail);
/** An answer the shop wrote itself, as a problem body. */
const shops = (status: number, detail = '') => new ShopApiError('http', status, detail, true);

function record(over: Partial<DoubtRecord> = {}): DoubtRecord {
  return {
    cartId: 'cart-1',
    startedAt: iso(0),
    lastTriedAt: iso(0),
    attempts: 1,
    total: 300,
    currency: 'KES',
    request: { customerName: 'Wanjiru Kamau', customerPhone: '+254 712345678', customerEmail: 'w@example.com', notes: 'Street: Moi Ave' },
    ...over,
  };
}

test('no answer, a late answer and a server fault leave the order in doubt, because it may have been placed', () => {
  assert.deepEqual(classifyOrderFailure(new ShopApiError('network', null, '')), { kind: 'in-doubt', reason: 'no-answer' });
  assert.deepEqual(classifyOrderFailure(new ShopApiError('timeout', null, '')), { kind: 'in-doubt', reason: 'no-answer' });
  assert.deepEqual(classifyOrderFailure(new ShopApiError('unreadable', 200, '')), { kind: 'in-doubt', reason: 'no-answer' });
  assert.deepEqual(classifyOrderFailure(http(408)), { kind: 'in-doubt', reason: 'no-answer' });
  for (const status of [500, 502, 503, 504]) {
    assert.deepEqual(classifyOrderFailure(http(status)), { kind: 'in-doubt', reason: 'shop-fault' }, String(status));
  }
});

test('a cart the shop does not have is not an order that was placed by this call', () => {
  assert.deepEqual(classifyOrderFailure(http(404, 'Not found')), { kind: 'cart-gone' });
});

test('an answer that says no is a refusal, with words for the shopper', () => {
  for (const status of [400, 401, 403, 409, 422]) {
    const failure = classifyOrderFailure(http(status, 'Invalid email'));
    assert.equal(failure.kind, 'refused', String(status));
  }
  const limited = classifyOrderFailure(http(429));
  assert.equal(limited.kind, 'refused');
  assert.match((limited as { message: string }).message, /Too many tries/);
});

test('a repeat of an order that may have gone through is refused only by the shop itself', () => {
  for (const status of [400, 401, 403, 407, 413, 429]) {
    assert.deepEqual(classifyOrderFailure(http(status, 'whatever'), true), { kind: 'in-doubt', reason: 'no-answer' }, `${status} from something in between`);
  }
  for (const status of [401, 403, 407, 413, 429]) {
    assert.deepEqual(classifyOrderFailure(shops(status, 'x'), true), { kind: 'in-doubt', reason: 'no-answer' }, `${status} is not a refusal even from the shop`);
  }
  for (const status of [400, 409, 422]) {
    assert.equal(classifyOrderFailure(shops(status, 'Insufficient stock'), true).kind, 'refused', `${status} from the shop`);
  }
  assert.equal(classifyOrderFailure(shops(400, ''), true).kind, 'refused', 'a validation failure has no detail and is the shop\'s');
  assert.deepEqual(classifyOrderFailure(http(404), true), { kind: 'cart-gone' });
  assert.deepEqual(classifyOrderFailure(http(503), true), { kind: 'in-doubt', reason: 'shop-fault' });
  assert.deepEqual(classifyOrderFailure(http(408), true), { kind: 'in-doubt', reason: 'no-answer' });
});

test('a first call is refused by any answer that says no, as before', () => {
  for (const status of [400, 401, 403, 407, 409, 413, 422, 429]) {
    assert.equal(classifyOrderFailure(http(status, 'x'), false).kind, 'refused', String(status));
    assert.equal(classifyOrderFailure(http(status, 'x')).kind, 'refused', `${status} by default`);
  }
});

test('which answers are the shop\'s own refusal', () => {
  assert.equal(isShopsRefusal(shops(400)), true);
  assert.equal(isShopsRefusal(shops(409)), true);
  assert.equal(isShopsRefusal(shops(422)), true);
  assert.equal(isShopsRefusal(http(400)), false, 'not read as the shop\'s');
  assert.equal(isShopsRefusal(shops(404)), false);
  assert.equal(isShopsRefusal(shops(429)), false);
  assert.equal(isShopsRefusal(new ShopApiError('timeout', null, '', true)), false, 'no answer is not a refusal');
});

test('a reason that is only spaces, or an empty bracket, is not read out', () => {
  assert.match(describeRefusal(http(400, '   ')), /could not take the order/);
  assert.equal(describeRefusal(http(400, 'Insufficient stock for one or more items (   )')), 'Something in your basket is no longer in stock in that amount.');
  assert.equal(describeRefusal(http(400, 'Insufficient stock for one or more items ()')), 'Something in your basket is no longer in stock in that amount.');
  assert.equal(describeRefusal(http(400, '  minimum order is 2  ')), 'Minimum order is 2.');
});

test('an item the shop no longer sells is told apart from other refusals', () => {
  for (const text of ['Item no longer available', 'item not found', 'Item not available', '  Item no longer available  ']) assert.equal(itemIsGone(text), true, text);
  for (const text of ['Insufficient stock for one or more items', 'Cart is empty', 'Pricing unavailable for an item', '', 'Out of an item no longer available']) {
    assert.equal(itemIsGone(text), false, text);
  }
  assert.match(describeRefusal(http(400, 'Item no longer available')), /no longer sold.*marked/);
});

test('the shop\'s own sentences are turned into ones a shopper can act on', () => {
  const say = (detail: string, status = 400) => describeRefusal(http(status, detail));
  assert.equal(say('Cart is empty'), 'Your basket is empty. Add something, then place the order.');
  assert.match(say('Item no longer available'), /no longer sold/);
  assert.match(say('Item not found'), /no longer sold/);
  assert.equal(
    say('Insufficient stock for one or more items (only 3 left at this store for an item in your cart)'),
    'Something in your basket is no longer in stock in that amount. Only 3 left at this store for an item in your cart.',
  );
  assert.equal(say('Insufficient stock for one or more items'), 'Something in your basket is no longer in stock in that amount.');
  const unpriced = say('Pricing unavailable for checkout: Tea. Set a shelf price in Products or remove these items from your cart.');
  assert.match(unpriced, /not priced/);
  assert.doesNotMatch(unpriced, /Products|shelf/, 'an instruction to the shop\'s staff is not shown to a shopper');
  assert.equal(say('Contact details required'), 'Add your name and phone.');
  assert.match(say('Invalid email'), /does not look right/);
});

test('a sentence of the shop\'s own is kept, made a sentence, and a refusal with no words is given some', () => {
  assert.equal(describeRefusal(http(400, 'Weight may have at most 3 decimal places')), 'Weight may have at most 3 decimal places.');
  assert.equal(describeRefusal(http(400, 'Minimum order is 2.')), 'Minimum order is 2.');
  assert.match(describeRefusal(http(400, '')), /could not take the order/);
});

test('the same order is not sent again within twenty seconds of the last try, since that one may still be running', () => {
  const tried = record({ lastTriedAt: iso(0) });
  const soon = canTryAgain(tried, new Date(T0 + 5_000));
  assert.deepEqual(soon, { ok: false, waitMs: IN_DOUBT_MIN_GAP_MS - 5_000 });
  assert.deepEqual(canTryAgain(tried, new Date(T0 + IN_DOUBT_MIN_GAP_MS)), { ok: true });
  assert.deepEqual(canTryAgain(tried, new Date(T0 + IN_DOUBT_MIN_GAP_MS - 1)), { ok: false, waitMs: 1 });
});

test('a phone clock set back is not a reason to make the shopper wait', () => {
  assert.deepEqual(canTryAgain(record({ lastTriedAt: iso(0) }), new Date(T0 - 3_600_000)), { ok: true });
});

test('an order the shopper can see at the shop, made since this one was sent, for the same amount, is this one', () => {
  const doubt = record({ total: 300, startedAt: iso(0) });
  const orders = [
    { id: 'old', grandTotal: 300, createdAt: iso(-MATCH_SLACK_MS / 1000 - 60) },
    { id: 'other-amount', grandTotal: 250, createdAt: iso(30) },
    { id: 'mine', grandTotal: '300.00', createdAt: iso(30) },
  ];
  assert.equal(matchPlacedOrder(doubt, orders)?.id, 'mine');
});

test('orders the phone already heard about are left out, so a second basket of the same amount is not mistaken for the first', () => {
  const earlier = { id: 'o1', grandTotal: 300, createdAt: iso(-60) };
  const lost = { id: 'o2', grandTotal: 300, createdAt: iso(30) };
  assert.equal(matchPlacedOrder(record(), [earlier])?.id, 'o1', 'without leaving it out, the earlier order is taken for it');
  assert.deepEqual(withoutKnown([earlier, lost], new Set(['o1'])), [lost]);
  assert.equal(matchPlacedOrder(record(), withoutKnown([earlier], new Set(['o1']))), null);
  assert.equal(matchPlacedOrder(record(), withoutKnown([earlier, lost], new Set(['o1'])))?.id, 'o2', 'and the one it never heard about is still found');
  assert.deepEqual(withoutKnown([earlier, lost], new Set()), [earlier, lost], 'knowing none leaves all');
  assert.deepEqual(withoutKnown([], new Set(['o1'])), []);
});

test('an order a little before the phone\'s time is allowed, for a clock that is a little different', () => {
  const doubt = record({ total: 300, startedAt: iso(0) });
  assert.equal(matchPlacedOrder(doubt, [{ id: 'near', grandTotal: 300, createdAt: iso(-60) }])?.id, 'near');
  assert.equal(matchPlacedOrder(doubt, [{ id: 'far', grandTotal: 300, createdAt: iso(-MATCH_SLACK_MS / 1000 - 1) }]), null);
});

test('with the amount not known, or the order\'s time or total missing, nothing is guessed', () => {
  assert.equal(matchPlacedOrder(record({ total: null }), [{ id: 'a', grandTotal: 300, createdAt: iso(5) }]), null);
  assert.equal(matchPlacedOrder(record({ total: null }), [{ id: 'free', grandTotal: 0, createdAt: iso(5) }]), null, 'an order of nothing is not "no amount"');
  assert.equal(matchPlacedOrder(record(), [{ id: 'a', grandTotal: 300 }]), null);
  assert.equal(matchPlacedOrder(record(), [{ id: 'a', createdAt: iso(5) }]), null);
  assert.equal(matchPlacedOrder(record(), [{ id: 'a', grandTotal: 'lots', createdAt: iso(5) }]), null);
  assert.equal(matchPlacedOrder(record(), []), null);
});

test('the note of an order in doubt is read back as it was written', () => {
  const doubt = record({ attempts: 3, lastTriedAt: iso(40) });
  assert.deepEqual(parseDoubt(serializeDoubt(doubt)), doubt);
});

test('a note that is damaged, or does not say what was sent, is no note at all', () => {
  for (const bad of [null, undefined, '', 'x', '[]', 'null', '{}', '{"cartId":"c"}']) assert.equal(parseDoubt(bad), null, String(bad));
  assert.equal(parseDoubt(JSON.stringify({ ...record(), cartId: '' })), null);
  assert.equal(parseDoubt(JSON.stringify({ ...record(), startedAt: 'yesterday' })), null);
  assert.equal(parseDoubt(JSON.stringify({ ...record(), request: { customerName: '', customerPhone: '1' } })), null);
  assert.equal(parseDoubt(JSON.stringify({ ...record(), request: { customerName: 'A', customerPhone: '' } })), null);
});

test('a note with some fields missing is repaired, not dropped: the order it describes may be real', () => {
  const kept = parseDoubt(JSON.stringify({ cartId: 'c', startedAt: iso(0), request: { customerName: 'A B', customerPhone: '+254 700000000' } }));
  assert.ok(kept);
  assert.equal(kept.attempts, 1);
  assert.equal(kept.lastTriedAt, iso(0));
  assert.equal(kept.total, null);
  assert.equal(kept.currency, 'KES');
  assert.equal(kept.request.customerEmail, undefined);
  assert.equal(kept.request.notes, undefined);
});

test('the amount must be the same to the cent: an order a shilling different is another order', () => {
  const doubt = record({ total: 300, startedAt: iso(0) });
  assert.equal(matchPlacedOrder(doubt, [{ id: 'near', grandTotal: 300.5, createdAt: iso(5) }]), null);
  assert.equal(matchPlacedOrder(doubt, [{ id: 'same', grandTotal: '300.004', createdAt: iso(5) }])?.id, 'same');
});
