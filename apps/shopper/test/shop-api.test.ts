import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createShopCartApi,
  createShopCheckoutApi,
  MAX_CART_LINES,
  MAX_GUEST_KEY_LENGTH,
  MAX_ORDER_CODE_LENGTH,
  orderCodeOf,
  toPlacedOrder,
  toServerCart,
  type ShopApiDeps,
} from '../src/lib/shop-api';
import { ShopApiError, type FetchLike } from '../src/lib/shop-http';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function fakeFetch(answers: Array<{ status?: number; body?: unknown; text?: string } | Error>) {
  const calls: Call[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body === undefined ? undefined : JSON.parse(init.body) });
    const next = answers.shift();
    if (!next) throw new Error('no answer left');
    if (next instanceof Error) throw next;
    const status = next.status ?? 200;
    const text = next.text ?? (next.body === undefined ? '' : JSON.stringify(next.body));
    return { ok: status >= 200 && status < 300, status, text: async () => text };
  };
  return { calls, impl };
}

function deps(over: Partial<ShopApiDeps> & { fetchImpl: FetchLike }): ShopApiDeps & { kept: string[] } {
  const kept: string[] = [];
  return {
    kept,
    baseUrl: 'https://api.example.test',
    slug: 'palmart',
    getBearer: async () => null,
    readGuestKey: async () => null,
    writeGuestKey: async (key) => void kept.push(key),
    correlationId: () => 'corr-1',
    ...over,
  };
}

const BASE = 'https://api.example.test/api/v1/public/businesses/palmart';

const CART = {
  id: 'c1',
  currency: 'KES',
  expiresAt: '2026-12-01T00:00:00Z',
  subtotal: 300,
  lines: [
    { itemId: 'tea', name: 'Tea 500g', variantName: null, imageUrl: 'https://img/t.png', quantity: 2, unitPrice: 120, lineTotal: 240, weighed: false },
    { itemId: 'milk', name: 'Milk', quantity: '1', unitPrice: '60.00', lineTotal: '60.00' },
  ],
};

test('a cart is made with a post and no sign-in, and read into the basket\'s terms', async () => {
  const f = fakeFetch([{ status: 201, body: CART }]);
  const api = createShopCartApi(deps({ fetchImpl: f.impl, getBearer: async () => 'tok', readGuestKey: async () => 'gk' }));
  const cart = await api.createCart();
  assert.deepEqual(f.calls[0], { url: `${BASE}/carts`, method: 'POST', headers: { Accept: 'application/json', 'X-Correlation-Id': 'corr-1' }, body: undefined });
  assert.equal(cart.id, 'c1');
  assert.equal(cart.subtotal, 300);
  assert.deepEqual(cart.lines?.map((l) => [l.itemId, l.quantity, l.unitPrice, l.lineTotal]), [['tea', 2, 120, 240], ['milk', 1, 60, 60]]);
  assert.equal(cart.lines?.[0].imageUrl, 'https://img/t.png');
});

test('a line is set by an absolute quantity, in the cart named, with the cart\'s name made safe for a path', async () => {
  const f = fakeFetch([{ body: CART }]);
  const api = createShopCartApi(deps({ fetchImpl: f.impl }));
  await api.setLine('c/1 x', { itemId: 'tea', quantity: 0 });
  assert.equal(f.calls[0].url, `${BASE}/carts/c%2F1%20x/lines`);
  assert.equal(f.calls[0].method, 'POST');
  assert.deepEqual(f.calls[0].body, { itemId: 'tea', quantity: 0 });
  assert.equal(f.calls[0].headers['Content-Type'], 'application/json');
  assert.equal(f.calls[0].headers.Authorization, undefined);
});

test('a cart is read with a get, in the cart named, with nothing sent and the cart\'s name made safe', async () => {
  const f = fakeFetch([{ body: CART }, { status: 404, body: { detail: 'Cart not found or expired' } }]);
  const api = createShopCartApi(deps({ fetchImpl: f.impl }));
  const cart = await api.getCart('c/1 x');
  assert.equal(f.calls[0].url, `${BASE}/carts/c%2F1%20x`);
  assert.equal(f.calls[0].method, 'GET');
  assert.equal(f.calls[0].body, undefined);
  assert.equal(f.calls[0].headers['Content-Type'], undefined);
  assert.equal(f.calls[0].headers.Authorization, undefined);
  assert.equal(cart.subtotal, 300);
  assert.deepEqual(cart.lines?.map((l) => [l.itemId, l.quantity, l.unitPrice]), [['tea', 2, 120], ['milk', 1, 60]]);
  await assert.rejects(api.getCart('c1'), (error: ShopApiError) => error.kind === 'http' && error.status === 404 && error.answered);
});

test('the shop saying no to a line is an error with its words; no signal is an error that says so', async () => {
  const f = fakeFetch([{ status: 400, body: { detail: 'Only 3 available at this store' } }, new TypeError('Network request failed')]);
  const api = createShopCartApi(deps({ fetchImpl: f.impl }));
  await assert.rejects(api.setLine('c1', { itemId: 'tea', quantity: 9 }), (error: ShopApiError) => error.kind === 'http' && error.status === 400 && error.detail === 'Only 3 available at this store');
  await assert.rejects(api.setLine('c1', { itemId: 'tea', quantity: 9 }), (error: ShopApiError) => error.kind === 'network' && !error.answered);
});

test('a cart answer that is not a cart is unreadable, and lines with no item or no quantity are left out', () => {
  assert.throws(() => toServerCart(null), (e: ShopApiError) => e.kind === 'unreadable');
  assert.throws(() => toServerCart('x'), (e: ShopApiError) => e.kind === 'unreadable');
  const cart = toServerCart({ id: 'c', lines: [{ itemId: 'a', quantity: 1 }, { quantity: 2 }, { itemId: 'b' }, 'x', { itemId: 'c', quantity: 'many' }] });
  assert.deepEqual(cart.lines?.map((l) => l.itemId), ['a']);
  assert.equal(cart.subtotal, null);
  assert.deepEqual(toServerCart({}).lines, []);
});

test('the contact step carries the shopper\'s sign-in and the guest key the shop gave, and keeps the key it gives back', async () => {
  const f = fakeFetch([{ body: { authenticated: false, guestKey: 'new-key' } }]);
  const d = deps({ fetchImpl: f.impl, getBearer: async () => 'tok', readGuestKey: async () => 'old-key' });
  const api = createShopCheckoutApi(d);
  const body = { firstName: 'Wanjiru', lastName: 'Kamau', email: 'w@example.com', areaCode: '+254', phone: '712345678', whatsApp: '' };
  await api.saveContact('c1', body);
  assert.equal(f.calls[0].url, `${BASE}/carts/c1/checkout-state/contact`);
  assert.equal(f.calls[0].method, 'PATCH');
  assert.deepEqual(f.calls[0].body, body);
  assert.equal(f.calls[0].headers.Authorization, 'Bearer tok');
  assert.equal(f.calls[0].headers['X-Checkout-Guest-Key'], 'old-key');
  assert.deepEqual(d.kept, ['new-key']);
});

const EXPIRED = { status: 401, body: { type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'token_expired' } };
const STEP = { firstName: 'Wanjiru', lastName: 'Kamau', email: 'w@example.com', areaCode: '+254', phone: '712345678', whatsApp: '' };
const STEP_TO = { county: 'Nairobi', subCounty: 'Westlands', ward: 'Westlands', streetAddress: 'Moi Ave', deliveryNotes: '', saveForNextTime: false };

test('a step the shop answers 401 for a sign-in that has run out is made again without it, once, as a guest does', async () => {
  const f = fakeFetch([EXPIRED, { body: { authenticated: false, guestKey: 'new-key' } }]);
  const d = deps({ fetchImpl: f.impl, getBearer: async () => 'old-token', readGuestKey: async () => 'guest-key' });
  const state = await createShopCheckoutApi(d).saveContact('c1', STEP);
  assert.deepEqual(state, { authenticated: false, guestKey: 'new-key' });
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].headers.Authorization, 'Bearer old-token');
  assert.equal(f.calls[1].headers.Authorization, undefined, 'the second call has no sign-in');
  assert.equal(f.calls[1].headers['X-Checkout-Guest-Key'], 'guest-key', 'and keeps the guest key');
  assert.equal(f.calls[1].url, f.calls[0].url);
  assert.deepEqual(f.calls[1].body, STEP, 'with the same details');
  assert.deepEqual(d.kept, ['new-key']);

  const g = fakeFetch([EXPIRED, { body: {} }]);
  await createShopCheckoutApi(deps({ fetchImpl: g.impl, getBearer: async () => 'old-token' })).saveDelivery('c1', STEP_TO);
  assert.equal(g.calls.length, 2, 'the delivery step too');
  assert.equal(g.calls[1].headers.Authorization, undefined);
});

test('a 401 is answered once only, and only for a shopper who sent a sign-in', async () => {
  const twice = fakeFetch([EXPIRED, EXPIRED]);
  await assert.rejects(
    createShopCheckoutApi(deps({ fetchImpl: twice.impl, getBearer: async () => 'tok' })).saveContact('c1', STEP),
    (e: ShopApiError) => e.status === 401 && e.answered,
  );
  assert.equal(twice.calls.length, 2, 'not a third time');

  const guest = fakeFetch([EXPIRED]);
  await assert.rejects(createShopCheckoutApi(deps({ fetchImpl: guest.impl })).saveContact('c1', STEP), (e: ShopApiError) => e.status === 401);
  assert.equal(guest.calls.length, 1, 'a guest has nothing to take away');
});

test('no other answer, and no silence, makes a step be tried again', async () => {
  for (const answer of [{ status: 403, body: { title: 'Forbidden', status: 403 } }, { status: 400, body: { title: 'Validation failed', status: 400 } }, { status: 500, text: 'oops' }, { status: 429, text: 'slow down' }]) {
    const f = fakeFetch([answer, { body: {} }]);
    await assert.rejects(createShopCheckoutApi(deps({ fetchImpl: f.impl, getBearer: async () => 'tok' })).saveContact('c1', STEP), ShopApiError, String(answer.status));
    assert.equal(f.calls.length, 1, `${answer.status} is not made again`);
  }
  const silent = fakeFetch([new Error('Network request failed'), { body: {} }]);
  await assert.rejects(createShopCheckoutApi(deps({ fetchImpl: silent.impl, getBearer: async () => 'tok' })).saveDelivery('c1', STEP_TO), ShopApiError);
  assert.equal(silent.calls.length, 1);
});

test('an answer with far more lines than a cart can hold is not a cart, and is not taken', () => {
  const lines = (n: number) => Array.from({ length: n }, (_, i) => ({ itemId: `i${i}`, quantity: 1, unitPrice: 1, lineTotal: 1 }));
  assert.equal(toServerCart({ id: 'c', lines: lines(MAX_CART_LINES) }).lines.length, MAX_CART_LINES);
  assert.throws(() => toServerCart({ id: 'c', lines: lines(MAX_CART_LINES + 1) }), (e: ShopApiError) => e.kind === 'unreadable');
});

test('a guest key far longer than a key can be is not kept, and one of the longest length that is, is', async () => {
  const f = fakeFetch([{ body: { guestKey: 'k'.repeat(MAX_GUEST_KEY_LENGTH + 1) } }, { body: { guestKey: 'k'.repeat(MAX_GUEST_KEY_LENGTH) } }]);
  const d = deps({ fetchImpl: f.impl });
  await createShopCheckoutApi(d).saveContact('c1', STEP);
  assert.deepEqual(d.kept, []);
  await createShopCheckoutApi(d).saveContact('c1', STEP);
  assert.equal(d.kept.length, 1);
});

test('the order itself is never sent again by the api, whatever answers', async () => {
  const f = fakeFetch([EXPIRED, { body: { id: 'o1', grandTotal: 300, currency: 'KES' } }]);
  await assert.rejects(createShopCheckoutApi(deps({ fetchImpl: f.impl, getBearer: async () => 'tok' })).submit('c1', { customerName: 'A B', customerPhone: '0712345678' }), ShopApiError);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].headers.Authorization, undefined, 'and it carries no sign-in to expire');
});

test('the delivery step goes to its own path with the same identity, and a key already kept is not asked for again if none comes back', async () => {
  const f = fakeFetch([{ body: { authenticated: true } }]);
  const d = deps({ fetchImpl: f.impl });
  const api = createShopCheckoutApi(d);
  const body = { county: 'Nairobi', subCounty: 'Westlands', ward: 'Westlands', streetAddress: 'Moi Ave', deliveryNotes: '', saveForNextTime: true };
  await api.saveDelivery('c1', body);
  assert.equal(f.calls[0].url, `${BASE}/carts/c1/checkout-state/delivery`);
  assert.deepEqual(f.calls[0].body, body);
  assert.equal(f.calls[0].headers.Authorization, undefined, 'a guest sends no sign-in');
  assert.equal(f.calls[0].headers['X-Checkout-Guest-Key'], undefined);
  assert.deepEqual(d.kept, []);
});

test('a blank key from the shop is not kept, and a key that cannot be written does not fail the step', async () => {
  const f = fakeFetch([{ body: { guestKey: '   ' } }, { body: { guestKey: 'k' } }]);
  const d = deps({
    fetchImpl: f.impl,
    writeGuestKey: async () => {
      throw new Error('disk');
    },
  });
  const api = createShopCheckoutApi(d);
  const body = { firstName: 'A', lastName: 'B', email: 'a@b.co', areaCode: '+254', phone: '700000000', whatsApp: '' };
  await api.saveContact('c1', body);
  await assert.doesNotReject(api.saveContact('c1', body));
});

test('an access token or key that cannot be read is no token and no key, not a failed step', async () => {
  const f = fakeFetch([{ body: {} }]);
  const d = deps({
    fetchImpl: f.impl,
    getBearer: async () => {
      throw new Error('keychain');
    },
    readGuestKey: async () => {
      throw new Error('disk');
    },
  });
  await createShopCheckoutApi(d).saveContact('c1', { firstName: 'A', lastName: 'B', email: 'a@b.co', areaCode: '+254', phone: '7', whatsApp: '' });
  assert.equal(f.calls[0].headers.Authorization, undefined);
});

test('the order is a post with the four things the website sends, and no sign-in or guest key whatever the shopper has', async () => {
  const f = fakeFetch([{ status: 201, body: { orderId: 'o1', orderCode: 'PM-1', status: 'PENDING_PAYMENT', grandTotal: '300.00', currency: 'KES', createdAt: '2026-11-23T09:00:00Z', receiptToken: 'rt' } }]);
  const api = createShopCheckoutApi(deps({ fetchImpl: f.impl, getBearer: async () => 'tok', readGuestKey: async () => 'gk' }));
  const order = await api.submit('c1', { customerName: 'Wanjiru Kamau', customerPhone: '+254 712345678', customerEmail: '', notes: undefined });
  assert.equal(f.calls[0].url, `${BASE}/carts/c1/checkout`);
  assert.equal(f.calls[0].method, 'POST');
  assert.deepEqual(f.calls[0].body, { customerName: 'Wanjiru Kamau', customerPhone: '+254 712345678' }, 'an empty email and no notes are left out');
  assert.equal(f.calls[0].headers.Authorization, undefined);
  assert.equal(f.calls[0].headers['X-Checkout-Guest-Key'], undefined);
  assert.deepEqual(order, { orderId: 'o1', orderCode: 'PM-1', status: 'PENDING_PAYMENT', grandTotal: 300, currency: 'KES', createdAt: '2026-11-23T09:00:00Z', receiptToken: 'rt' });
});

test('an email and notes that were given are sent as given', async () => {
  const f = fakeFetch([{ status: 201, body: { orderId: 'o1', grandTotal: 10 } }]);
  await createShopCheckoutApi(deps({ fetchImpl: f.impl })).submit('c1', { customerName: 'A B', customerPhone: '+254 700000000', customerEmail: 'a@b.co', notes: 'Street: X' });
  assert.deepEqual(f.calls[0].body, { customerName: 'A B', customerPhone: '+254 700000000', customerEmail: 'a@b.co', notes: 'Street: X' });
});

test('an order answer with no order in it is unreadable, so the order is in doubt rather than failed', async () => {
  for (const body of [{}, { orderId: 'o1' }, { grandTotal: 5 }, { orderId: '', grandTotal: 5 }, [], null]) {
    const f = fakeFetch([{ status: 201, body }]);
    await assert.rejects(
      createShopCheckoutApi(deps({ fetchImpl: f.impl })).submit('c1', { customerName: 'A', customerPhone: '1' }),
      (error: ShopApiError) => error.kind === 'unreadable' && !error.answered,
      JSON.stringify(body),
    );
  }
  const empty = fakeFetch([{ status: 201, text: '' }]);
  await assert.rejects(createShopCheckoutApi(deps({ fetchImpl: empty.impl })).submit('c1', { customerName: 'A', customerPhone: '1' }), (error: ShopApiError) => error.kind === 'unreadable');
});

test('a refusal of the order carries the shop\'s words, and no signal leaves it unanswered', async () => {
  const f = fakeFetch([{ status: 400, body: { detail: 'Cart is empty' } }, new TypeError('Network request failed')]);
  const api = createShopCheckoutApi(deps({ fetchImpl: f.impl }));
  await assert.rejects(api.submit('c1', { customerName: 'A', customerPhone: '1' }), (e: ShopApiError) => e.answered && e.detail === 'Cart is empty');
  await assert.rejects(api.submit('c1', { customerName: 'A', customerPhone: '1' }), (e: ShopApiError) => !e.answered);
});

test('an order answer is read with a total that may be text, and a currency when the shop leaves it out', () => {
  assert.deepEqual(toPlacedOrder({ orderId: 'o', grandTotal: '12.50' }), {
    orderId: 'o', orderCode: undefined, status: undefined, grandTotal: 12.5, currency: 'KES', createdAt: undefined, receiptToken: undefined,
  });
});

test('an order code is a few characters: trimmed, and left out when it is empty, not text or too long to be one', () => {
  assert.equal(orderCodeOf('AB12CD34'), 'AB12CD34');
  assert.equal(orderCodeOf('  AB12CD34 \n'), 'AB12CD34');
  assert.equal(orderCodeOf('x'.repeat(MAX_ORDER_CODE_LENGTH)), 'x'.repeat(MAX_ORDER_CODE_LENGTH));
  for (const bad of ['', '   ', 'x'.repeat(MAX_ORDER_CODE_LENGTH + 1), 12345678, null, undefined, {}, ['AB12CD34']]) {
    assert.equal(orderCodeOf(bad), undefined, String(bad));
  }
});

test('an order answer with a code that is too long to be one is placed with none', () => {
  const placed = toPlacedOrder({ orderId: 'o', grandTotal: 10, orderCode: 'x'.repeat(MAX_ORDER_CODE_LENGTH + 1) });
  assert.equal(placed.orderCode, undefined);
  assert.equal(toPlacedOrder({ orderId: 'o', grandTotal: 10, orderCode: ' AB12CD34 ' }).orderCode, 'AB12CD34');
});

test('the order is waited for longer than the other calls, because giving up on it only makes it uncertain', async () => {
  const delays: number[] = [];
  const realSet = globalThis.setTimeout;
  globalThis.setTimeout = ((callback: () => void, ms?: number, ...rest: unknown[]) => {
    delays.push(ms as number);
    return realSet(callback, ms, ...(rest as []));
  }) as typeof setTimeout;
  try {
    const f = fakeFetch([{ status: 201, body: { orderId: 'o1', grandTotal: 300 } }, { status: 201, body: CART }]);
    const checkout = createShopCheckoutApi(deps({ fetchImpl: f.impl }));
    await checkout.submit('c1', { customerName: 'Wanjiru Kamau', customerPhone: '+254 712345678' });
    await createShopCartApi(deps({ fetchImpl: f.impl })).createCart();
  } finally {
    globalThis.setTimeout = realSet;
  }
  assert.deepEqual(delays, [30_000, 20_000]);
});
