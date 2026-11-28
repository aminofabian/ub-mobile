import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pinnedTo, type ApiClient } from '../src/create-api-client';

function fakeClient(tenantId?: string, forTenant?: (id: string) => ApiClient): ApiClient {
  const never = () => Promise.reject(new Error('not used'));
  return {
    ...(tenantId === undefined ? {} : { tenantId }),
    ...(forTenant ? { forTenant } : {}),
    get: never,
    post: never,
    put: never,
    patch: never,
    delete: never,
  } as ApiClient;
}

test('a client that follows whichever shop is active is pinned to the shop it is asked for', () => {
  const asked: string[] = [];
  const pinned = fakeClient('shop-a');
  const follower = fakeClient(undefined, (id) => {
    asked.push(id);
    return pinned;
  });
  assert.equal(pinnedTo(follower, 'shop-a'), pinned);
  assert.deepEqual(asked, ['shop-a']);
});

test('a client already pinned to that shop is used as it is, and one pinned to another shop is pinned again', () => {
  const asked: string[] = [];
  const mine = fakeClient('shop-a', (id) => {
    asked.push(id);
    return fakeClient(id);
  });
  assert.equal(pinnedTo(mine, 'shop-a'), mine);
  assert.deepEqual(asked, []);
  const other = pinnedTo(mine, 'shop-b');
  assert.notEqual(other, mine);
  assert.equal(other.tenantId, 'shop-b');
  assert.deepEqual(asked, ['shop-b']);
});

test('a client that cannot be pinned is returned as it is', () => {
  const plain = fakeClient();
  assert.equal(pinnedTo(plain, 'shop-a'), plain);
});
