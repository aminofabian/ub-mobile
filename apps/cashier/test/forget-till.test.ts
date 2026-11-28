import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTenantValue, writeTenantValue } from '@kiosk/core';
import { asyncStore } from '../../../packages/core/test/support/world.mjs';
import { catalogCopyFor } from '../src/lib/catalog-storage';
import { forgetTillData } from '../src/lib/forget-till';
import { emptyBook } from '../src/lib/holds';
import { holdKeeperFor } from '../src/lib/hold-storage';
import { appendToLog, readLog } from '../src/lib/till-log';
import { usePosStore } from '../src/store/pos-store';

const NOON = Date.parse('2026-11-23T12:00:00.000Z');
const api = {} as never;

async function keepEverything(shop: string) {
  await writeTenantValue('catalog', '{"price":"list"}', shop);
  await writeTenantValue('shopFlags', '{"flags":true}', shop);
  await writeTenantValue('heldBaskets', '{"baskets":true}', shop);
  await appendToLog(shop, { id: 'discarded:a', kind: 'discarded', at: NOON, text: 'a sale was discarded' }, NOON);
}

test('a phone the shop took off as a till lets go of the price list, the settings and the held baskets, and keeps what a manager still needs', async () => {
  await keepEverything('shop-ft1');
  await keepEverything('shop-ft2');
  const copy = catalogCopyFor({ tenantId: 'shop-ft1', branchId: 'b-1', api, offline: () => false });
  const keeper = holdKeeperFor('shop-ft1');
  usePosStore.getState().loadHolds(emptyBook(), 'shop-ft1');

  await forgetTillData('shop-ft1');

  for (const field of ['catalog', 'shopFlags', 'heldBaskets'] as const) {
    assert.equal(await readTenantValue(field, 'shop-ft1'), null, field);
    assert.notEqual(await readTenantValue(field, 'shop-ft2'), null, `${field} of another shop`);
  }
  assert.equal((await readLog('shop-ft1', NOON)).length, 1, 'the till\'s log stays: it is about sales that were never sent');
  assert.notEqual(catalogCopyFor({ tenantId: 'shop-ft1', branchId: 'b-1', api, offline: () => false }), copy, 'no copy is kept in memory');
  assert.notEqual(holdKeeperFor('shop-ft1'), keeper, 'no keeper is kept in memory');
  assert.equal(usePosStore.getState().holdsFor, null, 'baskets in memory are not read as the shop\'s any more');
  assert.deepEqual(usePosStore.getState().holds, emptyBook());
});

test('a phone whose storage fails is not an error: what could not be removed ages out by itself', async () => {
  await keepEverything('shop-ft3');
  asyncStore.__setFault(() => {
    throw new Error('storage is full');
  });
  try {
    await assert.doesNotReject(forgetTillData('shop-ft3'));
  } finally {
    asyncStore.__setFault(null);
  }
  assert.notEqual(await readTenantValue('catalog', 'shop-ft3'), null, 'nothing was removed, and nothing broke');
  await assert.doesNotReject(forgetTillData('a shop this phone never knew'));
});
