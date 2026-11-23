import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  closeShift,
  createSale,
  ensureCustomerByPhone,
  fetchLastClosed,
  findCustomerByPhone,
  lookupCustomerByPhone,
  openShift,
  searchItems,
} from '../src/api/pos-api';

type Call = { method: 'get' | 'post'; path: string; body?: unknown; options?: unknown };

/** A stand-in for the api client that records what it was asked and answers from `handlers`. */
function fakeApi(handlers: { get?: (path: string) => unknown; post?: (path: string, body: unknown) => unknown }) {
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
