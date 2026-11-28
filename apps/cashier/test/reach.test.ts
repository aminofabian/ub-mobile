import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, type ApiClient } from '@kiosk/core';
import {
  batchWaitMs,
  FIRST_REACH,
  heard,
  isNoAnswer,
  lost,
  NotAnsweredInTime,
  QUIET,
  RECALL_WAIT_MAX_MS,
  waitFor,
  watchApi,
} from '../src/lib/reach';

const server = (status: number, foreign = false) => new ApiError('x', { status, ...(foreign ? { foreign: true } : {}) });

test('a till that has heard nothing yet is not offline', () => {
  assert.deepEqual(FIRST_REACH, { offline: false, lostAt: null, heardAt: null });
});

test('losing the line records when, and the first loss is the one that counts', () => {
  const first = lost(FIRST_REACH, 1_000);
  assert.deepEqual(first, { offline: true, lostAt: 1_000, heardAt: null });
  const again = lost(first, 9_000);
  assert.equal(again.lostAt, 1_000, 'the line was lost at the first failure, not the latest');
  assert.equal(again.offline, true);
});

test('hearing the server again ends it, and remembers when', () => {
  const down = lost(heard(FIRST_REACH, 500), 1_000);
  assert.equal(down.heardAt, 500, 'losing the line does not forget the last answer');
  const back = heard(down, 2_000);
  assert.deepEqual(back, { offline: false, lostAt: null, heardAt: 2_000 });
  // The next loss starts a new count.
  assert.equal(lost(back, 3_000).lostAt, 3_000);
});

test('what is and is not "no answer"', () => {
  // Nothing came back at all.
  assert.equal(isNoAnswer(new TypeError('Network request failed')), true);
  assert.equal(isNoAnswer(new Error('The server did not answer in time.')), true);
  assert.equal(isNoAnswer(new SyntaxError('JSON Parse error: Unexpected character: <')), true);
  assert.equal(isNoAnswer(null), true);
  assert.equal(isNoAnswer('boom'), true);
  // A gateway with nothing behind it, or a deploy.
  for (const status of [502, 503, 504, 520, 521, 522, 523, 524]) assert.equal(isNoAnswer(server(status)), true, String(status));
  // Something in the way answered instead of the server.
  assert.equal(isNoAnswer(server(403, true)), true);
  assert.equal(isNoAnswer(server(200, true)), true);
  // The server answered, even if the answer was "no" or "broken".
  for (const status of [400, 401, 403, 404, 409, 422, 423, 429, 500, 501, 505, 519, 525, 599]) {
    assert.equal(isNoAnswer(server(status)), false, String(status));
  }
});

function fakeApi(outcomes: Record<string, () => Promise<unknown>>): { api: ApiClient; calls: unknown[][] } {
  const calls: unknown[][] = [];
  const run = (method: string) => (...args: unknown[]) => {
    calls.push([method, ...args]);
    return (outcomes[method] ?? (() => Promise.resolve(undefined)))();
  };
  const api = {
    tenantId: 'shop-1',
    forTenant: (id: string) => ({ ...fakeApi(outcomes).api, tenantId: id }),
    get: run('get'),
    post: run('post'),
    put: run('put'),
    patch: run('patch'),
    delete: run('delete'),
  } as unknown as ApiClient;
  return { api, calls };
}

function sinkOf() {
  const events: string[] = [];
  return { events, sink: { heard: () => events.push('heard'), lost: () => events.push('lost') } };
}

test('a call that is answered is reported as heard, and its answer comes back untouched', async () => {
  const answer = { id: 1 };
  const { api } = fakeApi({ get: () => Promise.resolve(answer) });
  const { sink, events } = sinkOf();
  assert.equal(await watchApi(api, sink).get('/a'), answer);
  assert.deepEqual(events, ['heard']);
});

test('a "no" from the server is reported as heard, and the same error is thrown', async () => {
  const refusal = server(403);
  const { api } = fakeApi({ post: () => Promise.reject(refusal) });
  const { sink, events } = sinkOf();
  await assert.rejects(watchApi(api, sink).post('/a', {}), (error) => error === refusal);
  assert.deepEqual(events, ['heard']);
});

test('a call nobody answered is reported as lost, and the same error is thrown', async () => {
  const dead = new TypeError('Network request failed');
  for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
    const { api } = fakeApi({ [method]: () => Promise.reject(dead) });
    const { sink, events } = sinkOf();
    const watched = watchApi(api, sink);
    const call = method === 'get' ? watched.get('/a') : method === 'delete' ? watched.delete('/a') : watched[method]('/a', {});
    await assert.rejects(call, (error) => error === dead, method);
    assert.deepEqual(events, ['lost'], method);
  }
});

test('a gateway with nothing behind it is lost, and a server that broke is heard', async () => {
  const { sink, events } = sinkOf();
  await assert.rejects(watchApi(fakeApi({ get: () => Promise.reject(server(503)) }).api, sink).get('/a'));
  await assert.rejects(watchApi(fakeApi({ get: () => Promise.reject(server(500)) }).api, sink).get('/a'));
  assert.deepEqual(events, ['lost', 'heard']);
});

test('what the call carried goes through unchanged, idempotency options included', async () => {
  const { api, calls } = fakeApi({});
  const watched = watchApi(api, sinkOf().sink);
  await watched.get('/g');
  await watched.post('/p', { a: 1 }, { idempotencyKey: 'k-1' });
  await watched.put('/u', { b: 2 }, { idempotent: true });
  await watched.patch('/c', { c: 3 }, { idempotencyKey: 'k-2' });
  await watched.delete('/d', { idempotencyKey: 'k-3' });
  assert.deepEqual(calls, [
    ['get', '/g'],
    ['post', '/p', { a: 1 }, { idempotencyKey: 'k-1' }],
    ['put', '/u', { b: 2 }, { idempotent: true }],
    ['patch', '/c', { c: 3 }, { idempotencyKey: 'k-2' }],
    ['delete', '/d', { idempotencyKey: 'k-3' }],
  ]);
});

test('the shop the client is pinned to still reads through, and a client pinned to another shop is watched as well', async () => {
  const { api } = fakeApi({ get: () => Promise.reject(new TypeError('Network request failed')) });
  const { sink, events } = sinkOf();
  const watched = watchApi(api, sink);
  assert.equal(watched.tenantId, 'shop-1');
  const pinned = watched.forTenant?.('shop-2');
  assert.ok(pinned, 'a pinned client is still offered');
  assert.equal(pinned.tenantId, 'shop-2');
  await assert.rejects(pinned.get('/a'));
  assert.deepEqual(events, ['lost'], 'what the sync engine sends is reported too');
});

test('a client with nothing to pin is left without it', () => {
  const bare = { get: async () => 1, post: async () => 1, put: async () => 1, patch: async () => 1, delete: async () => 1 } as unknown as ApiClient;
  assert.equal(watchApi(bare, sinkOf().sink).forTenant, undefined);
});

function tell() {
  const told: string[] = [];
  return { told, sink: { lost: () => told.push('lost') } };
}

test('a call that is answered in time is answered, and nothing is said about the line', async () => {
  const { told, sink } = tell();
  assert.equal(await waitFor(async () => 7, 1_000, sink), 7);
  assert.deepEqual(told, []);
});

test('a call that is not answered in time ends the wait, and the till is told the line may be down', async () => {
  const { told, sink } = tell();
  await assert.rejects(waitFor(() => new Promise<never>(() => undefined), 5, sink), NotAnsweredInTime);
  assert.deepEqual(told, ['lost']);
  assert.equal(isNoAnswer(new NotAnsweredInTime()), true, 'and it counts as no answer wherever it is read');
});

test('a call that fails by itself fails the same way, and is not told again', async () => {
  const { told, sink } = tell();
  const refusal = server(403);
  await assert.rejects(waitFor(() => Promise.reject(refusal), 1_000, sink), (error) => error === refusal);
  const down = new TypeError('Network request failed');
  await assert.rejects(waitFor(() => Promise.reject(down), 1_000, sink), (error) => error === down);
  assert.deepEqual(told, [], 'the watched client has already said what it heard');
});

test('a call that answers after the wait is over is ignored, and is never reported as unhandled', async () => {
  const { told, sink } = tell();
  let finish: (value: number) => void = () => undefined;
  const slow = new Promise<number>((resolve) => (finish = resolve));
  await assert.rejects(waitFor(() => slow, 5, sink), NotAnsweredInTime);
  finish(1);
  await slow;
  assert.deepEqual(told, ['lost']);
});

test('a wait for calls that are each watched runs out like any other, and says nothing about the line', async () => {
  const never = () => new Promise<never>(() => undefined);
  await assert.rejects(waitFor(never, 5, QUIET), NotAnsweredInTime);
  assert.equal(QUIET.lost(), undefined);
  // The same wait on a sink that listens does say so.
  let said = 0;
  await assert.rejects(waitFor(never, 5, { lost: () => (said += 1) }), NotAnsweredInTime);
  assert.equal(said, 1);
});

test('a wait for a batch of calls is as long as the calls may take, with a little over, and no more than the cap', () => {
  assert.equal(batchWaitMs(0, 8_000, 3, 40_000), 10_000, 'an empty batch still waits for one turn');
  assert.equal(batchWaitMs(1, 8_000, 3, 40_000), 10_000);
  assert.equal(batchWaitMs(3, 8_000, 3, 40_000), 10_000, 'three at once take one turn');
  assert.equal(batchWaitMs(4, 8_000, 3, 40_000), 18_000, 'a fourth needs a second turn');
  assert.equal(batchWaitMs(9, 8_000, 3, 40_000), 26_000);
  assert.equal(batchWaitMs(100, 8_000, 3, 40_000), 40_000, 'never more than the cap');
  assert.equal(batchWaitMs(-5, 8_000, 3, 40_000), 10_000);
  assert.equal(batchWaitMs(1, 8_000, 0, 40_000), 10_000, 'a batch size that is not a size is one at a time');
  assert.equal(batchWaitMs(2, 8_000, 0, 40_000), 18_000);
  assert.ok(RECALL_WAIT_MAX_MS >= 20_000 && RECALL_WAIT_MAX_MS <= 60_000);
});
