// Run from mobile/ with Node 22.18+, which runs .ts files directly (on 22.6-22.17 add
// --experimental-strip-types):
//   node --test packages/offline/test/replay.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ApiClient, IdempotencyOptions } from '@kiosk/core';
import type { OutboxItem } from '../src/outbox.ts';
import { replayItem } from '../src/replay.ts';

type Call = { method: string; path: string; body?: unknown; options?: IdempotencyOptions };

/**
 * A stand-in for the API client and the server behind it. Like the real server, it records an
 * operation once per Idempotency-Key and gives back that first result for any later request
 * with the same key. It can also lose a response: the operation is recorded, but the caller
 * sees a network error. That is the situation that puts a sale into the offline queue.
 */
function createFakeServer() {
  const calls: Call[] = [];
  const recorded = new Map<string, number>(); // Idempotency-Key -> sale number
  let mintedKeys = 0;
  let loseNextResponse = false;

  async function handle(method: string, path: string, body?: unknown, options?: IdempotencyOptions) {
    calls.push({ method, path, body, options });
    // The real client mints a key for an idempotent call that was not given one.
    const key =
      options?.idempotencyKey ?? (options?.idempotent ? `minted-${++mintedKeys}` : undefined);
    assert.ok(key, 'the server needs an Idempotency-Key');
    if (!recorded.has(key)) recorded.set(key, recorded.size + 1);
    if (loseNextResponse) {
      loseNextResponse = false;
      throw new TypeError('Network request failed');
    }
    return { saleNumber: recorded.get(key) };
  }

  // Cast: the real ApiClient methods are generic over the response type.
  const api = {
    get: async () => {
      throw new Error('not used');
    },
    post: (path: string, body?: unknown, options?: IdempotencyOptions) =>
      handle('POST', path, body, options),
    patch: (path: string, body?: unknown, options?: IdempotencyOptions) =>
      handle('PATCH', path, body, options),
    delete: (path: string, options?: IdempotencyOptions) =>
      handle('DELETE', path, undefined, options),
  } as unknown as ApiClient;

  return {
    api,
    calls,
    salesRecorded: () => recorded.size,
    loseNextResponse: () => {
      loseNextResponse = true;
    },
  };
}

function queued(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 'key-1',
    method: 'POST',
    path: '/api/v1/sales',
    body: { branchId: 'b1', lines: [] },
    idempotencyKey: 'key-1',
    retries: 0,
    createdAt: '2026-11-22T10:00:00.000Z',
    ...overrides,
  };
}

test('the fake server treats a different key as a different sale', async () => {
  const server = createFakeServer();
  await server.api.post('/api/v1/sales', {}, { idempotencyKey: 'a' });
  await server.api.post('/api/v1/sales', {}, { idempotencyKey: 'b' });
  assert.equal(server.salesRecorded(), 2);
});

test('replays a queued request with the key it was queued under', async () => {
  const server = createFakeServer();
  const item = queued({ idempotencyKey: 'sale-key-42' });

  await replayItem(server.api, item);

  assert.deepEqual(server.calls, [
    {
      method: 'POST',
      path: '/api/v1/sales',
      body: item.body,
      options: { idempotent: true, idempotencyKey: 'sale-key-42' },
    },
  ]);
});

test('a sale whose response was lost is recorded once when the queue replays it', async () => {
  const server = createFakeServer();
  const item = queued({ idempotencyKey: 'sale-key-42' });

  // The till sends the sale. The server records it, but the response never arrives.
  server.loseNextResponse();
  await assert.rejects(
    server.api.post(item.path, item.body, {
      idempotent: true,
      idempotencyKey: item.idempotencyKey,
    }),
    TypeError
  );
  assert.equal(server.salesRecorded(), 1);

  // The queued copy goes out later and the server recognises the key.
  await replayItem(server.api, item);
  assert.equal(server.salesRecorded(), 1);
  assert.equal(server.calls.length, 2);
});

test('PATCH and DELETE are replayed with their own method and stored key', async () => {
  const server = createFakeServer();

  await replayItem(
    server.api,
    queued({ method: 'PATCH', path: '/api/v1/things/1', idempotencyKey: 'k-patch' })
  );
  await replayItem(
    server.api,
    queued({ method: 'DELETE', path: '/api/v1/things/1', idempotencyKey: 'k-delete' })
  );

  assert.deepEqual(
    server.calls.map((c) => [c.method, c.path, c.options?.idempotencyKey]),
    [
      ['PATCH', '/api/v1/things/1', 'k-patch'],
      ['DELETE', '/api/v1/things/1', 'k-delete'],
    ]
  );
});

test('an item with no stored key is still sent as an idempotent request', async () => {
  const server = createFakeServer();

  await replayItem(server.api, queued({ idempotencyKey: '' }));

  assert.deepEqual(server.calls[0].options, { idempotent: true, idempotencyKey: undefined });
});

test('an unsupported method fails instead of being treated as sent', async () => {
  const server = createFakeServer();

  await assert.rejects(replayItem(server.api, queued({ method: 'PUT' })), /Cannot replay/);
  assert.equal(server.calls.length, 0);
});
