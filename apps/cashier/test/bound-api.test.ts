import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, type ApiClient } from '@kiosk/core';
import { classifyReplayFailure, isBeingSent } from '@kiosk/offline';
import { boundApi } from '../src/lib/bound-api';
import { isNoAnswer, NotAnsweredInTime } from '../src/lib/reach';

/** What a hung request looks like: it never answers, until the test lets it. */
function hung<T>() {
  let settle!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, settle, fail };
}

const soon = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function clientWith(post: ApiClient['post'], extra: Partial<ApiClient> = {}): ApiClient {
  const refuse = (() => Promise.reject(new Error('not used'))) as never;
  return { get: refuse, put: refuse, patch: refuse, delete: refuse, post, ...extra } as ApiClient;
}

const KEY = 'key-bound-1';
const send = (api: ApiClient) => api.post('/api/v1/sales', { n: 1 }, { idempotent: true, idempotencyKey: KEY });

test('a call that is answered comes back as it is, and the line is not reported lost', async () => {
  let lostCount = 0;
  const api = boundApi(clientWith((async () => ({ id: 's-1' })) as never), 1_000, { lost: () => (lostCount += 1) });
  assert.deepEqual(await send(api), { id: 's-1' });
  assert.equal(lostCount, 0);
  assert.equal(isBeingSent(KEY), false, 'nothing is left marked as being sent');
});

test('a call the server answers with a no is that no, not a time-out, and it too lets the sale go', async () => {
  let lostCount = 0;
  const refusal = new ApiError('Not allowed', { status: 403 });
  const api = boundApi(clientWith((async () => Promise.reject(refusal)) as never), 1_000, { lost: () => (lostCount += 1) });
  await assert.rejects(send(api), (error) => error === refusal);
  assert.equal(lostCount, 0, 'the server was reached');
  assert.equal(isBeingSent(KEY), false);
});

test('a call that is not answered in time ends as "no answer": no attempt used, and the till is told', async () => {
  let lostCount = 0;
  const stuck = hung<unknown>();
  const api = boundApi(clientWith((() => stuck.promise) as never), 20, { lost: () => (lostCount += 1) });
  const error = await send(api).then(
    () => null,
    (failure: unknown) => failure
  );
  assert.ok(error instanceof NotAnsweredInTime);
  assert.equal(isNoAnswer(error), true);
  assert.equal(classifyReplayFailure(error), 'wait', 'the sync engine waits and does not count an attempt');
  assert.equal(lostCount, 1);
  stuck.settle(null);
  await soon();
});

test('the sale stays marked as being sent while its request may still be on its way, and is let go when it ends', async () => {
  const stuck = hung<unknown>();
  const api = boundApi(clientWith((() => stuck.promise) as never), 20, { lost: () => undefined });
  await send(api).catch(() => undefined);
  assert.equal(isBeingSent(KEY), true, 'a pass that starts now must not send it again beside the first request');
  stuck.settle({ id: 'late' });
  await soon();
  assert.equal(isBeingSent(KEY), false, 'the first request has ended, so the sale can go');
});

test('a late failure of the first request is not left unhandled, and lets the sale go too', async () => {
  const stuck = hung<unknown>();
  const api = boundApi(clientWith((() => stuck.promise) as never), 20, { lost: () => undefined });
  await send(api).catch(() => undefined);
  stuck.fail(new TypeError('Network request failed'));
  await soon();
  assert.equal(isBeingSent(KEY), false);
});

test('a call without a key marks nothing, and a lookup is bounded as well', async () => {
  const stuck = hung<unknown>();
  const client = clientWith((() => stuck.promise) as never, { get: (() => stuck.promise) as never });
  let lostCount = 0;
  const api = boundApi(client, 20, { lost: () => (lostCount += 1) });
  await assert.rejects(api.get('/api/v1/anything'), NotAnsweredInTime);
  await assert.rejects(api.post('/api/v1/anything', {}), NotAnsweredInTime);
  assert.equal(lostCount, 2);
  stuck.settle(null);
  await soon();
});

test('a client pinned to a shop is bounded too, and it reports which shop it is for', async () => {
  const stuck = hung<unknown>();
  const pinned = clientWith((() => stuck.promise) as never, { tenantId: 'shop-1' });
  const asked: string[] = [];
  const free = clientWith((async () => ({})) as never, {
    forTenant: (shop: string) => {
      asked.push(shop);
      return pinned;
    },
  });
  const api = boundApi(free, 20, { lost: () => undefined });
  assert.equal(api.tenantId, undefined);
  const bound = api.forTenant?.('shop-1');
  assert.ok(bound, 'a client that can be pinned still can');
  assert.deepEqual(asked, ['shop-1']);
  assert.equal(bound.tenantId, 'shop-1');
  await assert.rejects(send(bound), NotAnsweredInTime);
  stuck.settle(null);
  await soon();
});

test('a client that cannot be pinned is not given a way to be', () => {
  const api = boundApi(clientWith((async () => ({})) as never), 20, { lost: () => undefined });
  assert.equal(api.forTenant, undefined);
});

test('a call that throws before it starts fails as it is and leaves nothing marked', async () => {
  const boom = new Error('bad request body');
  const api = boundApi(
    clientWith((() => {
      throw boom;
    }) as never),
    1_000,
    { lost: () => undefined }
  );
  await assert.rejects(send(api), (error) => error === boom);
  assert.equal(isBeingSent(KEY), false);
});
