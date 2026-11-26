import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestTillAccess, type ApiClient } from '../src/index.ts';

test('requestTillAccess posts branch and device key', async () => {
  const calls: { path: string; body: unknown }[] = [];
  const api = {
    tenantId: 'biz-1',
    post: async (path: string, body?: unknown) => {
      calls.push({ path, body });
      return undefined;
    },
  } as unknown as ApiClient;

  assert.equal(await requestTillAccess(api, { branchId: 'b-1', deviceKey: 'device-key-0001' }), true);
  assert.deepEqual(calls, [
    {
      path: '/api/v1/till-access-requests',
      body: { branchId: 'b-1', deviceKey: 'device-key-0001' },
    },
  ]);
});

test('requestTillAccess returns false when the ask cannot be sent', async () => {
  assert.equal(
    await requestTillAccess({ post: async () => undefined } as unknown as ApiClient, {
      branchId: 'b-1',
      deviceKey: '',
    }),
    false
  );

  const api = {
    post: async () => {
      throw new Error('offline');
    },
  } as unknown as ApiClient;
  assert.equal(await requestTillAccess(api, { branchId: 'b-1', deviceKey: 'device-key-0001' }), false);
});
