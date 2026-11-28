import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, type ApiClient } from '@kiosk/core';
import {
  advanceOrder,
  fetchBalance,
  fetchCreditSummary,
  fetchOrders,
  fetchPulse,
  fetchStaff,
  fetchStockCounts,
  fetchStockList,
  fetchTabs,
  postTabPayment,
  STOCK_LIST_SIZE,
} from '../src/lib/owner-api';
import { STAFF_LIST_SIZE } from '../src/lib/staff';

type Call = { method: string; path: string; body?: unknown };

/** An API client that answers from a table of path prefixes and writes down every call it gets. */
function fakeApi(answer: (path: string) => unknown = () => ({})) {
  const calls: Call[] = [];
  const respond = async (method: string, path: string, body?: unknown) => {
    calls.push(body === undefined ? { method, path } : { method, path, body });
    const reply = answer(path);
    if (reply instanceof Error) throw reply;
    return reply;
  };
  const api = {
    get: (path: string) => respond('GET', path),
    post: (path: string, body?: unknown) => respond('POST', path, body),
    put: (path: string, body?: unknown) => respond('PUT', path, body),
    patch: (path: string, body?: unknown) => respond('PATCH', path, body),
    delete: (path: string) => respond('DELETE', path),
  } as unknown as ApiClient;
  return { api, calls };
}

const PULSE = { date: '2026-11-24', salesCount: 3, revenue: '4200.00', grossProfit: '900.00', expensesTotal: '100.00', netOperating: '800.00', openShifts: 2 };

test("today's takings are asked of the finance pulse, with no day given, and a day when one is", async () => {
  const today = fakeApi(() => PULSE);
  assert.equal((await fetchPulse(today.api))?.revenueCents, 420_000);
  assert.deepEqual(today.calls, [{ method: 'GET', path: '/api/v1/finance/pulse' }]);
  const before = fakeApi(() => PULSE);
  await fetchPulse(before.api, '2026-11-23');
  assert.deepEqual(before.calls, [{ method: 'GET', path: '/api/v1/finance/pulse?date=2026-11-23' }]);
  const odd = fakeApi(() => PULSE);
  await fetchPulse(odd.api, '2026-11-23&branchId=x');
  assert.deepEqual(odd.calls, [{ method: 'GET', path: '/api/v1/finance/pulse?date=2026-11-23%26branchId%3Dx' }]);
});

test('an answer that is not what was asked for is a failed read and not an empty one', async () => {
  assert.equal(await fetchPulse(fakeApi(() => ({})).api), null);
  assert.equal(await fetchCreditSummary(fakeApi(() => null).api), null);
  assert.equal(await fetchTabs(fakeApi(() => ({ tabs: [] })).api, ''), null);
  assert.equal(await fetchOrders(fakeApi(() => 'down').api), null);
  assert.equal(await fetchBalance(fakeApi(() => ({})).api, 'c-1'), null);
});

test('a read that cannot be made is not swallowed', async () => {
  const offline = fakeApi(() => new Error('offline'));
  await assert.rejects(fetchPulse(offline.api), /offline/);
  await assert.rejects(fetchOrders(offline.api), /offline/);
  await assert.rejects(fetchStockCounts(offline.api, 'b-1'), /offline/);
});

test('credit is read from the activity summary and the list of open tabs, and a search is part of the address', async () => {
  const summary = fakeApi(() => ({ totalOwed: '2000.00', openTabCount: 17, totalPaid: '300.00', paymentCount: 2 }));
  assert.equal((await fetchCreditSummary(summary.api))?.owedCents, 200_000);
  assert.deepEqual(summary.calls, [{ method: 'GET', path: '/api/v1/credits/activity-summary' }]);

  const tabs = fakeApi(() => [{ customerId: 'c-1', name: 'Wanjiku', primaryPhone: '0712345678', balanceOwed: '500.00', creditSuspended: false }]);
  assert.equal((await fetchTabs(tabs.api, ''))?.tabs.length, 1);
  await fetchTabs(tabs.api, ' wan jiku ');
  assert.deepEqual(
    tabs.calls.map((call) => call.path),
    ['/api/v1/customers/outstanding-tabs', '/api/v1/customers/outstanding-tabs?q=wan%20jiku']
  );
});

test("one customer's balance is read from the customer, with the id made safe for an address", async () => {
  const one = fakeApi(() => ({ credit: { balanceOwed: '1250.50' } }));
  assert.equal(await fetchBalance(one.api, 'c/1 2'), 125_050);
  assert.deepEqual(one.calls, [{ method: 'GET', path: '/api/v1/customers/c%2F1%202' }]);
});

test('a payment is posted once, to the tab payments route, with exactly the fields the server takes', async () => {
  const posted = fakeApi(() => ({ claimId: 'p-1', balanceOwed: '750.00' }));
  const answer = await postTabPayment(posted.api, { customerId: 'c-1', amount: 500, channel: 'mpesa', reference: 'QK12345678' });
  assert.deepEqual(answer, { claimId: 'p-1', balanceCents: 75_000 });
  assert.deepEqual(posted.calls, [{ method: 'POST', path: '/api/v1/credits/tab-payments', body: { customerId: 'c-1', amount: 500, channel: 'mpesa', reference: 'QK12345678' } }]);
});

test('a payment answer that cannot be read comes back with no claim, so the caller reads the tab instead of taking it for recorded', async () => {
  const odd = fakeApi(() => 'created');
  assert.deepEqual(await postTabPayment(odd.api, { customerId: 'c-1', amount: 5, channel: 'cash' }), { claimId: null, balanceCents: null });
});

test('a payment that is refused or gets no answer throws, and is not tried again', async () => {
  const down = fakeApi(() => new Error('timeout'));
  await assert.rejects(postTabPayment(down.api, { customerId: 'c-1', amount: 5, channel: 'cash' }), /timeout/);
  assert.equal(down.calls.length, 1);
});

test('a payment the server turns down, or fails on, throws as the server said it and is sent once', async () => {
  for (const status of [400, 403, 404, 409, 500, 502]) {
    const refused = fakeApi(() => new ApiError('no', { status }));
    await assert.rejects(
      postTabPayment(refused.api, { customerId: 'c-1', amount: 5, channel: 'cash' }),
      (error: unknown) => error instanceof ApiError && error.status === status
    );
    assert.equal(refused.calls.length, 1, `status ${status}`);
  }
});

test('web orders are read newest first from the web orders route, fifty at most', async () => {
  const list = fakeApi(() => ({ content: [] }));
  assert.deepEqual(await fetchOrders(list.api), []);
  assert.deepEqual(list.calls, [{ method: 'GET', path: '/api/v1/web-orders?size=50' }]);
});

test('an order is moved along by the fulfillment route with the status the server names, and the id is made safe', async () => {
  const moved = fakeApi();
  await advanceOrder(moved.api, 'o/1', 'confirmed');
  await advanceOrder(moved.api, 'o-2', 'dispatched');
  await advanceOrder(moved.api, 'o-3', 'completed');
  assert.deepEqual(moved.calls, [
    { method: 'PATCH', path: '/api/v1/web-orders/o%2F1/fulfillment', body: { fulfillmentStatus: 'confirmed' } },
    { method: 'PATCH', path: '/api/v1/web-orders/o-2/fulfillment', body: { fulfillmentStatus: 'dispatched' } },
    { method: 'PATCH', path: '/api/v1/web-orders/o-3/fulfillment', body: { fulfillmentStatus: 'completed' } },
  ]);
});

const PAGE = (total: number | undefined) => ({ content: [], ...(total === undefined ? {} : { totalElements: total }) });

test('the stock counts are the totals of two lists of one row each: running low, and out', async () => {
  const counts = fakeApi((path) => (path.includes('lowStock=true') ? PAGE(12) : PAGE(3)));
  assert.deepEqual(await fetchStockCounts(counts.api, 'b-1'), { low: 12, out: 3 });
  assert.equal(counts.calls.length, 2);
  const [low, out] = [counts.calls.find((c) => c.path.includes('lowStock=true')), counts.calls.find((c) => c.path.includes('zeroStock=true'))];
  assert.ok(low && out);
  for (const call of [low, out]) {
    assert.equal(call.method, 'GET');
    assert.match(call.path, /^\/api\/v1\/items\?branchId=b-1&/);
    assert.match(call.path, /size=1&page=0$/);
  }
  assert.doesNotMatch(low.path, /zeroStock/);
  assert.doesNotMatch(out.path, /lowStock/);
});

test('a stock count that cannot be had makes the pair unknown, never zero', async () => {
  assert.equal(await fetchStockCounts(fakeApi((path) => (path.includes('lowStock') ? PAGE(1) : PAGE(undefined))).api, 'b-1'), null);
  assert.equal(await fetchStockCounts(fakeApi((path) => (path.includes('lowStock') ? PAGE(undefined) : PAGE(1))).api, 'b-1'), null);
  assert.equal(await fetchStockCounts(fakeApi(() => ({})).api, 'b-1'), null);
});

test('the lists of items that are out and that are running low are two separate asks, a full page each', async () => {
  const out = fakeApi(() => PAGE(0));
  await fetchStockList(out.api, 'b-1', 'out');
  const low = fakeApi(() => PAGE(0));
  await fetchStockList(low.api, 'b-1', 'low');
  assert.equal(STOCK_LIST_SIZE, 100);
  assert.equal(out.calls[0]?.path, `/api/v1/items?branchId=b-1&zeroStock=true&size=${STOCK_LIST_SIZE}&page=0`);
  assert.equal(low.calls[0]?.path, `/api/v1/items?branchId=b-1&lowStock=true&size=${STOCK_LIST_SIZE}&page=0`);
});

test('a list of items that says there are more than it holds says so', async () => {
  const rows = Array.from({ length: 3 }, (_, i) => ({ id: `i-${i}`, name: `Item ${i}`, stockQty: 0 }));
  const more = await fetchStockList(fakeApi(() => ({ content: rows, totalElements: 250, last: false })).api, 'b-1', 'out');
  assert.equal(more?.items.length, 3);
  assert.equal(more?.more, true);
  assert.equal(more?.total, 250);
  const all = await fetchStockList(fakeApi(() => ({ content: rows, totalElements: 3, last: true })).api, 'b-1', 'low');
  assert.equal(all?.more, false);
  assert.equal(await fetchStockList(fakeApi(() => ({ items: rows })).api, 'b-1', 'out'), null);
});

test('the staff are asked of the users list: active people only, no more than the screen shows, and a failed read is not an empty one', async () => {
  const ok = fakeApi(() => ({ content: [{ id: 'u-1', name: 'Fabian Amino', email: 'fabian@tumaini.example', role: { id: 'r-1', key: 'owner', name: 'Owner', system: true } }] }));
  assert.deepEqual(await fetchStaff(ok.api), [{ id: 'u-1', name: 'Fabian Amino', email: 'fabian@tumaini.example', roleName: 'Owner' }]);
  assert.deepEqual(ok.calls, [{ method: 'GET', path: `/api/v1/users?status=active&size=${STAFF_LIST_SIZE}` }]);
  assert.deepEqual(await fetchStaff(fakeApi(() => ({ content: [] })).api), []);
  assert.equal(await fetchStaff(fakeApi(() => ({ users: [] })).api), null);
  assert.equal(await fetchStaff(fakeApi(() => 'down').api), null);
  await assert.rejects(fetchStaff(fakeApi(() => new Error('offline')).api), /offline/);
});
