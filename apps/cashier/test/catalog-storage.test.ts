import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ApiClient } from '@kiosk/core';
import { catalogCopyFor, dropCatalogCopies } from '../src/lib/catalog-storage';

function fakeApi(label: string, calls: string[]): ApiClient {
  return {
    get: async (path: string) => {
      calls.push(`${label} ${path}`);
      return { content: [{ id: 'i-1', name: 'Bread', sellingPrice: 60 }], last: true, totalElements: 1 };
    },
    post: async () => undefined,
    put: async () => undefined,
    patch: async () => undefined,
    delete: async () => undefined,
  } as unknown as ApiClient;
}

const offline = () => false;

test('a shop and branch have one copy, however often it is asked for', () => {
  const api = fakeApi('a', []);
  const first = catalogCopyFor({ tenantId: 'shop-1', branchId: 'b-1', api, offline });
  const again = catalogCopyFor({ tenantId: 'shop-1', branchId: 'b-1', api, offline });
  assert.equal(first, again);
  const other = catalogCopyFor({ tenantId: 'shop-2', branchId: 'b-1', api, offline });
  assert.notEqual(first, other, 'another shop has its own');
  assert.equal(catalogCopyFor({ tenantId: 'shop-1', branchId: 'b-1', api, offline }), first, 'and the first is still the first');
});

test('another branch of the same shop is a new copy, and the earlier branch is made again if it comes back', () => {
  const api = fakeApi('a', []);
  const atOne = catalogCopyFor({ tenantId: 'shop-3', branchId: 'b-1', api, offline });
  const atTwo = catalogCopyFor({ tenantId: 'shop-3', branchId: 'b-2', api, offline });
  assert.notEqual(atOne, atTwo);
  assert.notEqual(catalogCopyFor({ tenantId: 'shop-3', branchId: 'b-1', api, offline }), atOne, 'dropped when the shop moved to the other branch');
});

test('a copy sends through the client it was last given, and asks for its own branch', async () => {
  const calls: string[] = [];
  catalogCopyFor({ tenantId: 'shop-4', branchId: 'b-7', api: fakeApi('old', calls), offline });
  const copy = catalogCopyFor({ tenantId: 'shop-4', branchId: 'b-7', api: fakeApi('new', calls), offline });
  await copy.load();
  await copy.make();
  assert.deepEqual(calls, ['new /api/v1/items?branchId=b-7&page=0&size=250']);
  assert.equal(copy.state().open?.items.length, 1);
});

test('whether the line is believed down is asked of the latest answer given', async () => {
  let down = false;
  const calls: string[] = [];
  const copy = catalogCopyFor({ tenantId: 'shop-5', branchId: 'b-1', api: fakeApi('a', calls), offline: () => down });
  await copy.load();
  down = true;
  await copy.makeIfDue();
  assert.deepEqual(calls, [], 'not made while the line is down');
  catalogCopyFor({ tenantId: 'shop-5', branchId: 'b-1', api: fakeApi('a', calls), offline: () => false });
  await copy.makeIfDue();
  assert.equal(calls.length, 1, 'made once the new answer says it is up');
});

test('what is made is kept on the phone, per shop, and a fresh copy object reads it back', async () => {
  const calls: string[] = [];
  const copy = catalogCopyFor({ tenantId: 'shop-6', branchId: 'b-1', api: fakeApi('a', calls), offline });
  await copy.load();
  await copy.make();
  assert.equal(copy.state().saved, true);
  // Another branch drops the memory copy, and asking for this branch again reads what the phone holds.
  catalogCopyFor({ tenantId: 'shop-6', branchId: 'b-2', api: fakeApi('a', calls), offline });
  const back = catalogCopyFor({ tenantId: 'shop-6', branchId: 'b-1', api: fakeApi('a', calls), offline });
  assert.notEqual(back, copy);
  await back.load();
  assert.equal(back.state().found, 'copy');
  assert.equal(back.state().open?.items[0]?.name, 'Bread');
});

test('a shop whose phone is no longer a till there has its copies let go, and no other shop does', () => {
  const api = fakeApi('a', []);
  const here = catalogCopyFor({ tenantId: 'shop-9', branchId: 'b-1', api, offline });
  const there = catalogCopyFor({ tenantId: 'shop-10', branchId: 'b-1', api, offline });
  dropCatalogCopies('shop-9');
  assert.notEqual(catalogCopyFor({ tenantId: 'shop-9', branchId: 'b-1', api, offline }), here, 'made again from the phone, not kept in memory');
  assert.equal(catalogCopyFor({ tenantId: 'shop-10', branchId: 'b-1', api, offline }), there);
  dropCatalogCopies('a shop that was never opened');
});
