import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import {
  advanceWebOrder,
  closeShift,
  createSale,
  ensureCustomerByPhone,
  fetchFreshItems,
  fetchItemTypes,
  fetchLastClosed,
  fetchShopFlags,
  fetchWebOrders,
  findCustomerByPhone,
  lookupCustomerByPhone,
  markWeighed,
  openShift,
  pageRows,
  quickCreateItem,
  searchItems,
} from '../src/api/pos-api';

type Call = { method: 'get' | 'post' | 'patch' | 'put'; path: string; body?: unknown; options?: unknown };

type Handlers = {
  get?: (path: string) => unknown;
  post?: (path: string, body: unknown) => unknown;
  patch?: (path: string, body: unknown) => unknown;
  put?: (path: string, body: unknown) => unknown;
};

/** A stand-in for the api client that records what it was asked and answers from `handlers`. */
function fakeApi(handlers: Handlers) {
  const calls: Call[] = [];
  const api = {
    get: async (path: string) => {
      calls.push({ method: 'get', path });
      return handlers.get ? handlers.get(path) : [];
    },
    post: async (path: string, body: unknown, options?: unknown) => {
      calls.push({ method: 'post', path, body, options });
      if (!handlers.post) throw new Error('no post handler');
      return handlers.post(path, body);
    },
    patch: async (path: string, body: unknown, options?: unknown) => {
      calls.push({ method: 'patch', path, body, options });
      if (!handlers.patch) throw new Error('no patch handler');
      return handlers.patch(path, body);
    },
    put: async (path: string, body: unknown, options?: unknown) => {
      calls.push({ method: 'put', path, body, options });
      if (!handlers.put) throw new Error('no put handler');
      return handlers.put(path, body);
    },
  };
  return { api: api as never, calls };
}

const query = (path: string) => new URL(path, 'https://shop.test').searchParams;
const phoneOf = (path: string) => query(path).get('phone');

const ANN = { id: 'c-1', name: 'Ann' };
const BEN = { id: 'c-2', name: 'Ben' };

test('a customer is looked for under both spellings of the number, one page of five at a time', async () => {
  const { api, calls } = fakeApi({ get: () => [] });
  await findCustomerByPhone(api, '0712 345 678');
  assert.deepEqual(calls.map((c) => phoneOf(c.path)), ['254712345678', '0712345678']);
  for (const call of calls) {
    assert.ok(call.path.startsWith('/api/v1/customers?'), call.path);
    assert.equal(query(call.path).get('page'), '0');
    assert.equal(query(call.path).get('size'), '5');
  }
});

test('what is not a mobile number is never looked up', async () => {
  const { api, calls } = fakeApi({ get: () => [ANN] });
  for (const raw of ['', '123', 'abc', '0212345678']) assert.equal(await findCustomerByPhone(api, raw), null, raw);
  assert.equal(calls.length, 0);
});

test('a number held by one customer is that customer, by either spelling and in either shape of answer', async () => {
  const answering = (byPhone: Record<string, unknown>) => fakeApi({ get: (path) => byPhone[phoneOf(path) ?? ''] ?? [] }).api;
  assert.deepEqual(await findCustomerByPhone(answering({ '254712345678': [ANN] }), '0712345678'), { kind: 'one', customer: ANN });
  assert.deepEqual(await findCustomerByPhone(answering({ '0712345678': { content: [ANN] } }), '254712345678'), {
    kind: 'one',
    customer: ANN,
  });
  assert.deepEqual(await findCustomerByPhone(answering({ '254712345678': [ANN], '0712345678': [ANN] }), '0712345678'), {
    kind: 'one',
    customer: ANN,
  });
});

test('a number two customers have is several, and a number nobody has is none', async () => {
  const answering = (byPhone: Record<string, unknown>) => fakeApi({ get: (path) => byPhone[phoneOf(path) ?? ''] ?? [] }).api;
  assert.deepEqual(await findCustomerByPhone(answering({ '254712345678': [ANN], '0712345678': [BEN] }), '0712345678'), { kind: 'several' });
  assert.deepEqual(await findCustomerByPhone(answering({ '254712345678': [ANN, BEN] }), '0712345678'), { kind: 'several' });
  assert.deepEqual(await findCustomerByPhone(answering({}), '0712345678'), { kind: 'none' });
});

test('nothing typed is not looked up', async () => {
  const { api, calls } = fakeApi({ get: () => [ANN] });
  assert.equal(await lookupCustomerByPhone(api, '   '), null);
  assert.equal(calls.length, 0);
  assert.deepEqual(await lookupCustomerByPhone(api, '254712345678'), ANN);
});

test('a customer already on file under the number is used, and nobody new is made', async () => {
  const { api, calls } = fakeApi({ get: (path) => (phoneOf(path) === '0712345678' ? { content: [ANN] } : []) });
  assert.deepEqual(await ensureCustomerByPhone(api, '254712345678'), ANN);
  assert.equal(calls.some((c) => c.method === 'post'), false);
  assert.deepEqual(calls.map((c) => phoneOf(c.path)), ['254712345678', '0712345678']);
});

test('a number nobody has is made a customer named by the number', async () => {
  const made = { id: 'c-9', name: '254712345678' };
  const { api, calls } = fakeApi({ get: () => [], post: () => made });
  assert.deepEqual(await ensureCustomerByPhone(api, '0712345678'), made);
  const post = calls.find((c) => c.method === 'post');
  assert.equal(post?.path, '/api/v1/customers');
  assert.deepEqual(post?.body, { name: '254712345678', phones: [{ phone: '254712345678', primary: true }] });
  assert.deepEqual(post?.options, { idempotent: true });
});

test('when the customer cannot be made, the one another till made a moment ago is used, and failing that there is none', async () => {
  const other = { id: 'c-5', name: '254712345678' };
  let made = false;
  const racing = fakeApi({
    get: () => (made ? [other] : []),
    post: () => {
      made = true;
      throw new Error('Conflict');
    },
  });
  assert.deepEqual(await ensureCustomerByPhone(racing.api, '254712345678'), other);

  const failing = fakeApi({
    get: () => [],
    post: () => {
      throw new Error('offline');
    },
  });
  assert.equal(await ensureCustomerByPhone(failing.api, '254712345678'), null);
});

test('no digits, no customer', async () => {
  const { api, calls } = fakeApi({});
  assert.equal(await ensureCustomerByPhone(api, 'abc'), null);
  assert.equal(calls.length, 0);
});

test('the shift calls ask for this branch, open with the float, and close on what was counted', async () => {
  const { api, calls } = fakeApi({
    get: () => ({ countedClosingCash: 4000, closedAt: '2026-11-22T18:00:00Z' }),
    post: () => ({ id: 's-1' }),
  });
  assert.deepEqual(await fetchLastClosed(api, 'b 1'), { countedClosingCash: 4000, closedAt: '2026-11-22T18:00:00Z' });
  assert.equal(calls[0]?.path, '/api/v1/shifts/last-closed?branchId=b%201');

  await openShift(api, 'b-1', 500, 'early');
  assert.deepEqual(calls[1], {
    method: 'post',
    path: '/api/v1/shifts/open',
    body: { branchId: 'b-1', openingCash: 500, notes: 'early' },
    options: { idempotent: true },
  });

  const body = { countedClosingCash: 12500, cashTakenOut: 10000, varianceReason: 'coins' };
  await closeShift(api, 's-1', body);
  assert.deepEqual(calls[2], { method: 'post', path: '/api/v1/shifts/s-1/close', body, options: { idempotent: true } });
});

test('a sale is sent with the key the till holds for it, so the server records it once', async () => {
  const { api, calls } = fakeApi({ post: () => ({ id: 'sale-1' }) });
  const request = { branchId: 'b-1', lines: [], payments: [] } as never;
  await createSale(api, request, 'key-7');
  assert.deepEqual(calls[0], {
    method: 'post',
    path: '/api/v1/sales',
    body: request,
    options: { idempotent: true, idempotencyKey: 'key-7' },
  });
});

test('an item search sends only what was asked for, and reads either shape of answer', async () => {
  const wrapped = fakeApi({ get: () => ({ items: [{ id: 'i-1', name: 'Bread', sellingPrice: 60 }] }) });
  assert.equal((await searchItems(wrapped.api, { search: 'bre ad', branchId: 'b-1' })).length, 1);
  assert.equal(wrapped.calls[0]?.path, '/api/v1/items?search=bre%20ad&branchId=b-1');

  const bare = fakeApi({ get: () => [{ id: 'i-2', name: 'Milk', sellingPrice: 120 }] });
  assert.deepEqual((await searchItems(bare.api, { barcode: '6001' })).map((i) => i.id), ['i-2']);
  assert.equal(bare.calls[0]?.path, '/api/v1/items?barcode=6001');
  await searchItems(bare.api, {});
  assert.equal(bare.calls[1]?.path, '/api/v1/items');
});

test('the rows of a list are read from a Spring page, an older wrapper or a bare array', () => {
  assert.deepEqual(pageRows<number>({ content: [1, 2], totalElements: 2 }), [1, 2]);
  assert.deepEqual(pageRows<number>({ items: [3] }), [3]);
  assert.deepEqual(pageRows<number>([4, 5]), [4, 5]);
  for (const nothing of [null, undefined, 'x', 7, {}, { content: 'no' }]) assert.deepEqual(pageRows(nothing), []);
});

test('the item list the server really sends (a page of summaries) is read, and only what can be sold is offered', async () => {
  const page = {
    content: [
      { id: 'i-1', name: ' Bread ', barcode: '6001', sellingPrice: 60, stockQty: 12, active: true, isSellable: true, groupLabelOnly: false },
      { id: 'i-2', name: 'Milk', barcode: null, sellingPrice: 120.5, stockQty: null },
      { id: 'i-3', name: 'Eggs (family)', sellingPrice: 400, groupLabelOnly: true },
      { id: 'i-4', name: 'Old stock', sellingPrice: 10, active: false },
      { id: 'i-5', name: 'Not for sale', sellingPrice: 10, isSellable: false },
      { id: 'i-6', name: 'No price yet', sellingPrice: null },
      { id: 'i-7', name: 'Odd price', sellingPrice: Number.NaN },
    ],
    totalElements: 7,
  };
  const { api, calls } = fakeApi({ get: () => page });
  const items = await searchItems(api, { search: 'b', branchId: 'b-1' });
  assert.equal(calls[0]?.path, '/api/v1/items?search=b&branchId=b-1');
  assert.deepEqual(items, [
    { id: 'i-1', name: 'Bread', barcode: '6001', sellingPrice: 60, stockOnHand: 12 },
    { id: 'i-2', name: 'Milk', sellingPrice: 120.5 },
  ]);
});

test('a number that two customers have is never guessed at: the sale is linked to nobody, and nobody is made', async () => {
  const both = fakeApi({ get: (path) => (phoneOf(path) === '254712345678' ? [ANN] : [BEN]), post: () => ({ id: 'c-9', name: 'x' }) });
  assert.equal(await ensureCustomerByPhone(both.api, '254712345678'), null);
  assert.equal(both.calls.some((c) => c.method === 'post'), false);
  // A number that is not a mobile is not looked up at all.
  const bad = fakeApi({ get: () => [ANN] });
  assert.equal(await ensureCustomerByPhone(bad.api, '0201234567'), null);
  assert.equal(bad.calls.length, 0);
});

test('when two customers turn out to have the number after a customer could not be made, nobody is chosen', async () => {
  let made = false;
  const racing = fakeApi({
    get: (path) => (!made ? [] : phoneOf(path) === '254712345678' ? [ANN] : [BEN]),
    post: () => {
      made = true;
      throw new Error('Conflict');
    },
  });
  assert.equal(await ensureCustomerByPhone(racing.api, '254712345678'), null);
});

test('a weighed product is offered with its unit, a pack is flagged, and a plain product carries nothing extra', async () => {
  const page = {
    content: [
      { id: 'w-1', name: 'Beef', sellingPrice: 650, isWeighed: true, unitType: ' KG ', stockQty: 12.5 },
      { id: 'w-2', name: 'Flour', sellingPrice: 10, isWeighed: true, unitType: 'g' },
      { id: 'w-3', name: 'Mystery', sellingPrice: 10, isWeighed: true },
      { id: 'w-4', name: 'Eggs tray', sellingPrice: 400, packageVariant: true, isWeighed: false, unitType: 'each' },
      { id: 'w-5', name: 'Bread', sellingPrice: 60, isWeighed: false, unitType: 'each', packageVariant: false },
    ],
  };
  const items = await searchItems(fakeApi({ get: () => page }).api, {});
  assert.deepEqual(items, [
    { id: 'w-1', name: 'Beef', sellingPrice: 650, stockOnHand: 12.5, weighed: true, unitType: 'kg' },
    { id: 'w-2', name: 'Flour', sellingPrice: 10, weighed: true, unitType: 'g' },
    { id: 'w-3', name: 'Mystery', sellingPrice: 10, weighed: true },
    { id: 'w-4', name: 'Eggs tray', sellingPrice: 400, packageVariant: true },
    { id: 'w-5', name: 'Bread', sellingPrice: 60 },
  ]);
});

test('two sizes of one product are offered under names that tell them apart', async () => {
  const page = {
    content: [
      { id: 'v-1', name: 'Coke', variantOfItemId: 'p-1', parentName: 'Coca Cola', variantName: '500ml', sellingPrice: 70 },
      { id: 'v-2', name: 'Coke', variantOfItemId: 'p-1', parentName: 'Coca Cola', variantName: '1L', sellingPrice: 130 },
    ],
  };
  const items = await searchItems(fakeApi({ get: () => page }).api, {});
  assert.deepEqual(items.map((item) => item.name), ['Coca Cola · 500ml', 'Coca Cola · 1L']);
});

test('the shop\'s settings are read from the business, and anything that is not a true or false is not read', async () => {
  const { api, calls } = fakeApi({
    get: () => ({ id: 'b-1', featureFlags: { 'pos.cashier_price_edit': true, 'pos.cashier_weighed_toggle': false, odd: 'yes' } }),
  });
  assert.deepEqual(await fetchShopFlags(api), { 'pos.cashier_price_edit': true, 'pos.cashier_weighed_toggle': false });
  assert.equal(calls[0]?.path, '/api/v1/businesses/me');
  assert.deepEqual(await fetchShopFlags(fakeApi({ get: () => null }).api), {});
});

test('the items of a held basket are looked up one by name, picked out by id, and what cannot be told is left unsaid', async () => {
  const rows: Record<string, unknown[]> = {
    milk: [{ id: 'i-0', name: 'Milk skimmed', sellingPrice: 1 }, { id: 'i-1', name: 'Milk', sellingPrice: 130, stockQty: 4 }],
    old: [{ id: 'i-2', name: 'Old stock', sellingPrice: 10, active: false }],
    heading: [{ id: 'i-3', name: 'Eggs', sellingPrice: 400, groupLabelOnly: true }],
    nothing: [{ id: 'i-9', name: 'Something else', sellingPrice: 5 }],
    unpriced: [{ id: 'i-5', name: 'No price yet', sellingPrice: null }],
  };
  const { api, calls } = fakeApi({
    get: (path) => {
      const term = query(path).get('search') ?? '';
      if (term === 'broken') throw new ApiError('Bad gateway', { status: 502 });
      return { content: rows[term] ?? [] };
    },
  });
  const fresh = await fetchFreshItems(
    api,
    [
      { itemId: 'i-1', name: 'milk' },
      { itemId: 'i-2', name: 'old' },
      { itemId: 'i-3', name: 'heading' },
      { itemId: 'i-4', name: 'nothing' },
      { itemId: 'i-5', name: 'unpriced' },
      { itemId: 'i-6', name: 'broken' },
    ],
    'b-1'
  );
  assert.deepEqual(fresh['i-1'], { id: 'i-1', name: 'Milk', sellingPrice: 130, stockOnHand: 4 });
  assert.equal(fresh['i-2'], null, 'found, and no longer offered: gone');
  assert.equal(fresh['i-3'], null, 'a heading over its sizes cannot be sold');
  assert.equal('i-4' in fresh, false, 'not in the answer is not the same as gone');
  assert.equal(fresh['i-5']?.sellingPrice, 0, 'found with no price: carried so the basket can say so');
  assert.equal('i-6' in fresh, false, 'a failed lookup is not an answer');
  for (const call of calls) {
    assert.equal(query(call.path).get('branchId'), 'b-1');
    assert.equal(query(call.path).get('includeInactive'), 'true', 'an item switched off since is found, and reported as gone');
    assert.equal(query(call.path).get('size'), '50');
  }
});

test('an item is looked up by the words of its name, without the dot the till puts between a product and its size', async () => {
  const { api, calls } = fakeApi({ get: () => ({ content: [] }) });
  await fetchFreshItems(api, [{ itemId: 'i-1', name: 'Coca Cola · 500ml' }, { itemId: 'i-2', name: '·' }], 'b-1');
  assert.equal(calls.length, 1, 'a name with nothing to search for is not searched');
  assert.equal(query(calls[0]?.path ?? '').get('search'), 'Coca Cola 500ml');
});

test('one item twice in a basket is looked up once, and no more than three lookups run at the same time', async () => {
  let running = 0;
  let peak = 0;
  const api = {
    get: async (path: string) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return { content: [{ id: query(path).get('search'), name: 'x', sellingPrice: 1 }] };
    },
  } as never;
  const lines = ['a', 'b', 'c', 'd', 'e', 'f', 'a', 'b'].map((id) => ({ itemId: id, name: id }));
  const fresh = await fetchFreshItems(api, lines, 'b-1');
  assert.deepEqual(Object.keys(fresh).sort(), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.equal(peak, 3);
});

test('a lookup that takes too long is given up on, and the others still finish', async () => {
  const api = {
    get: (path: string) =>
      query(path).get('search') === 'slow'
        ? new Promise(() => undefined)
        : Promise.resolve({ content: [{ id: 'i-1', name: 'Milk', sellingPrice: 130 }] }),
  } as never;
  const fresh = await fetchFreshItems(
    api,
    [{ itemId: 'i-9', name: 'slow' }, { itemId: 'i-1', name: 'milk' }],
    'b-1',
    { waitMs: 20 }
  );
  assert.equal('i-9' in fresh, false);
  assert.equal(fresh['i-1']?.sellingPrice, 130);
  assert.deepEqual(await fetchFreshItems(api, [], 'b-1'), {});
});

test('web orders are read from the server\'s page, and what is not an order is left out', async () => {
  const { api, calls } = fakeApi({
    get: () => ({ content: [{ id: 'o-1', orderCode: 'ab12', status: 'paid', grandTotal: 500, customerName: 'Ann' }, null, 'x', {}] }),
  });
  const orders = await fetchWebOrders(api);
  assert.equal(calls[0]?.path, '/api/v1/web-orders?size=50');
  assert.deepEqual(orders.map((order) => [order.id, order.code, order.totalCents, order.paid]), [['o-1', 'AB12', 50000, true]]);
});

test('an order is moved along with a PATCH to its own address, one step, and the server\'s refusal reaches the caller', async () => {
  const done = fakeApi({ patch: () => ({}) });
  await advanceWebOrder(done.api, 'o 1/2', 'confirmed');
  assert.deepEqual(done.calls, [
    { method: 'patch', path: '/api/v1/web-orders/o%201%2F2/fulfillment', body: { fulfillmentStatus: 'confirmed' }, options: undefined },
  ]);
  const refused = fakeApi({
    patch: () => {
      throw new ApiError('Cannot move fulfillment from confirmed to confirmed', { status: 409 });
    },
  });
  await assert.rejects(advanceWebOrder(refused.api, 'o-1', 'confirmed'), (error: unknown) => error instanceof ApiError && error.status === 409);
});

test('the shop\'s kinds of product are read from the server\'s list', async () => {
  const { api, calls } = fakeApi({ get: () => [{ id: 't-2', name: 'Meat' }, { id: 't-1', name: 'Groceries' }, { nope: true }] });
  assert.deepEqual(await fetchItemTypes(api), [
    { id: 't-1', name: 'Groceries' },
    { id: 't-2', name: 'Meat' },
  ]);
  assert.equal(calls[0]?.path, '/api/v1/item-types');
});

test('a product is added with the request the form made, and comes back ready to ring up at the price it was given', async () => {
  const body = {
    name: 'Beef fillet',
    itemTypeId: 't-2',
    branchId: 'b-1',
    unitType: 'kg' as const,
    unitPrice: 650,
    barcode: '6001',
    initialStockQty: 12.5,
  };
  const { api, calls } = fakeApi({ post: () => ({ id: ' p-9 ', name: 'Beef fillet' }) });
  assert.deepEqual(await quickCreateItem(api, body), {
    id: 'p-9',
    name: 'Beef fillet',
    barcode: '6001',
    sellingPrice: 650,
    stockOnHand: 12.5,
  });
  assert.deepEqual(calls, [{ method: 'post', path: '/api/v1/pos/quick-items', body, options: { idempotent: true } }]);

  const plain = await quickCreateItem(fakeApi({ post: () => ({ id: 'p-1' }) }).api, {
    name: 'Tea',
    itemTypeId: 't-1',
    branchId: 'b-1',
    unitType: 'each',
    unitPrice: 50,
  });
  assert.deepEqual(plain, { id: 'p-1', name: 'Tea', sellingPrice: 50 });
});

test('an answer that does not say which product was made is an error, not a product with no id', async () => {
  for (const answer of [null, {}, { id: '' }, { id: '  ' }, { id: 5 }, 'ok']) {
    const { api } = fakeApi({ post: () => answer });
    await assert.rejects(
      quickCreateItem(api, { name: 'Tea', itemTypeId: 't-1', branchId: 'b-1', unitType: 'each', unitPrice: 50 }),
      /did not say which product/,
      JSON.stringify(answer)
    );
  }
});

test('a product is marked as sold by weight with a PUT to its own address', async () => {
  const { api, calls } = fakeApi({ put: () => ({}) });
  await markWeighed(api, 'p 9');
  await markWeighed(api, 'p-9', false);
  assert.deepEqual(calls, [
    { method: 'put', path: '/api/v1/pos/items/p%209/weighed', body: { weighed: true }, options: undefined },
    { method: 'put', path: '/api/v1/pos/items/p-9/weighed', body: { weighed: false }, options: undefined },
  ]);
});
