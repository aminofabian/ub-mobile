import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@kiosk/core';
import type { CartItem } from '../src/lib/cart';
import { openCatalog } from '../src/lib/catalog';
import { NoPriceList, SearchTimedOut, findItems, reloadAfterReconnect } from '../src/lib/find-items';

const LIVE: CartItem[] = [{ id: 'live-1', name: 'Milk 500ml (live)', sellingPrice: 70 }];
const MILK: CartItem = { id: 'i-1', name: 'Milk 500ml', barcode: '6001', sellingPrice: 65 };
const BREAD: CartItem = { id: 'i-2', name: 'Bread', barcode: '6002', sellingPrice: 60 };
const COPY = openCatalog({ branchId: 'b-1', at: 1_700_000_000_000, cut: false, dropped: 0, items: [MILK, BREAD] });
const CUT_COPY = openCatalog({ branchId: 'b-1', at: 1_700_000_000_000, cut: true, dropped: 0, items: [MILK, BREAD] });
const server = (status: number) => new ApiError('x', { status });

function run(over: Partial<Parameters<typeof findItems>[0]> = {}) {
  const calls = { asked: 0, lost: 0 };
  const promise = findItems({
    want: { search: 'milk' },
    ask: async () => {
      calls.asked += 1;
      return LIVE;
    },
    copy: COPY,
    offline: false,
    waitMs: 50,
    lost: () => {
      calls.lost += 1;
    },
    ...over,
  });
  return { promise, calls };
}

test('the shop answers, and its answer is the answer, copy or no copy', async () => {
  const { promise, calls } = run();
  assert.deepEqual(await promise, { from: 'shop', items: LIVE });
  assert.equal(calls.lost, 0);
  const none = run({ copy: null });
  assert.deepEqual(await none.promise, { from: 'shop', items: LIVE });
});

test('the shop answering "nothing" is an answer: the copy does not fill the gap', async () => {
  const { promise } = run({ ask: async () => [] });
  assert.deepEqual(await promise, { from: 'shop', items: [] });
});

test('with the line down, the phone answers at once and the shop is not asked', async () => {
  const { promise, calls } = run({ offline: true });
  const found = await promise;
  assert.equal(found.from, 'phone');
  assert.deepEqual(found.items, [MILK]);
  assert.equal(calls.asked, 0);
  assert.equal(calls.lost, 0);
});

test('with the line down and no list on the phone, it says so', async () => {
  const { promise, calls } = run({ offline: true, copy: null });
  await assert.rejects(promise, NoPriceList);
  assert.equal(calls.asked, 0);
});

test('a search nobody answers falls back to the phone and says the line is lost', async () => {
  const { promise, calls } = run({ ask: async () => { throw new TypeError('Network request failed'); } });
  const found = await promise;
  assert.equal(found.from, 'phone');
  assert.deepEqual(found.items, [MILK]);
  assert.equal(calls.lost, 1);
});

test('a search that runs out of time falls back too, and a late answer changes nothing', async () => {
  let resolveLate: (items: CartItem[]) => void = () => undefined;
  const late = new Promise<CartItem[]>((resolve) => { resolveLate = resolve; });
  const { promise, calls } = run({ ask: () => late, waitMs: 5 });
  const found = await promise;
  assert.equal(found.from, 'phone');
  assert.equal(calls.lost, 1);
  resolveLate(LIVE);
  await late;
});

test('a search that times out and has no copy to fall back on fails with the timeout', async () => {
  const { promise, calls } = run({ ask: () => new Promise<CartItem[]>(() => undefined), waitMs: 5, copy: null });
  await assert.rejects(promise, SearchTimedOut);
  assert.equal(calls.lost, 1);
});

test('what the copy answers carries when it was made and whether it is whole', async () => {
  const whole = await run({ offline: true }).promise;
  assert.deepEqual(whole, { from: 'phone', items: [MILK], asOf: 1_700_000_000_000, cut: false });
  const part = await run({ offline: true, copy: CUT_COPY }).promise;
  assert.equal(part.from === 'phone' && part.cut, true);
});

test('a barcode is looked up exactly in the copy; a search is looked up by words', async () => {
  const scan = await run({ offline: true, want: { barcode: '6002' } }).promise;
  assert.deepEqual(scan.items, [BREAD]);
  const miss = await run({ offline: true, want: { barcode: '600' } }).promise;
  assert.deepEqual(miss.items, [], 'a part of a barcode is not a scan');
  const typed = await run({ offline: true, want: { search: 'bre' } }).promise;
  assert.deepEqual(typed.items, [BREAD]);
  const all = await run({ offline: true, want: {} }).promise;
  assert.deepEqual(all.items, [MILK, BREAD]);
});

test('a "no" from the server is not hidden by the copy, and the line is not called lost', async () => {
  for (const status of [400, 403, 404, 409, 422]) {
    const { promise, calls } = run({ ask: async () => { throw server(status); } });
    await assert.rejects(promise, (e) => (e as ApiError).status === status, String(status));
    assert.equal(calls.lost, 0, String(status));
  }
});

test('a server that broke falls back to the copy, but the line was not lost', async () => {
  const { promise, calls } = run({ ask: async () => { throw server(500); } });
  assert.equal((await promise).from, 'phone');
  assert.equal(calls.lost, 0, 'the server answered');
});

test('a gateway with nothing behind it falls back, and is a lost line', async () => {
  for (const status of [502, 503, 504, 522]) {
    const { promise, calls } = run({ ask: async () => { throw server(status); } });
    assert.equal((await promise).from, 'phone', String(status));
    assert.equal(calls.lost, 1, String(status));
  }
});

test('a session that ended (401) lets the phone\'s list answer, and is not counted as a lost line', async () => {
  const { promise, calls } = run({ ask: async () => { throw server(401); } });
  assert.equal((await promise).from, 'phone');
  assert.equal(calls.lost, 0);
});

test('when the shop fails and there is no copy, the shop\'s own failure is what comes back', async () => {
  const dead = new TypeError('Network request failed');
  const { promise } = run({ ask: async () => { throw dead; }, copy: null });
  await assert.rejects(promise, (e) => e === dead);
});

test('the list on screen is read again from the shop when the line comes back, if it was the phone\'s own or could not be read', () => {
  const back = { wasOffline: true, offline: false };
  assert.equal(reloadAfterReconnect({ ...back, fromPhone: true, failed: false }), true);
  assert.equal(reloadAfterReconnect({ ...back, fromPhone: false, failed: true }), true);
  assert.equal(reloadAfterReconnect({ ...back, fromPhone: true, failed: true }), true);
  assert.equal(reloadAfterReconnect({ ...back, fromPhone: false, failed: false }), false, 'the shop\'s own list is already the shop\'s');
  assert.equal(reloadAfterReconnect({ wasOffline: false, offline: false, fromPhone: true, failed: false }), false, 'a line that never went down has not come back');
  assert.equal(reloadAfterReconnect({ wasOffline: true, offline: true, fromPhone: true, failed: false }), false, 'the line is still down');
  assert.equal(reloadAfterReconnect({ wasOffline: false, offline: true, fromPhone: true, failed: true }), false, 'the line has just gone down');
});
