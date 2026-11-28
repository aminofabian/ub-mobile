import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '@kiosk/core';
import { boundApi } from '../src/lib/bound-api';
import { watchApi } from '../src/lib/reach';

test('the Idempotency-Key a sale is queued under reaches the network, through the wait, the watch and the shop-pinned client', async () => {
  const seen: Array<{ key: string | undefined; method: string }> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: { method: string; headers: Record<string, string> }) => {
    seen.push({ key: init.headers['Idempotency-Key'], method: init.method });
    return new Response(JSON.stringify({ id: 's1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as never;
  try {
    const sink = { heard: () => undefined, lost: () => undefined };
    const api = boundApi(watchApi(createApiClient({ baseURL: 'http://x' }), sink), 5_000, sink);
    await api.post('/api/v1/sales', { n: 1 }, { idempotent: true, idempotencyKey: 'KEY-1' });
    const pinned = api.forTenant!('tenant-1');
    await pinned.post('/api/v1/sales', { n: 1 }, { idempotent: true, idempotencyKey: 'KEY-2' });
    await pinned.post('/api/v1/sales', { n: 1 }, { idempotencyKey: 'KEY-3' });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(seen.map((call) => call.key), ['KEY-1', 'KEY-2', 'KEY-3'], 'the same sale is always recognised by the server');
});
