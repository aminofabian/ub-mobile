import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartIdKey, deliveryAreasKey, forgetShopWith, ordersKey, shopKeys } from '../src/lib/shop-storage';

test('what the app keeps for a shop is kept under that shop, and one shop never reaches another', () => {
  const acme = shopKeys('acme');
  const bobs = shopKeys('bobs');
  assert.equal(acme.length, 3);
  assert.deepEqual(acme, [cartIdKey('acme'), ordersKey('acme'), deliveryAreasKey('acme')]);
  assert.equal(new Set([...acme, ...bobs]).size, 6, 'six different keys');
  for (const key of acme) {
    assert.match(key, /^kiosk\.shopper\..+\.acme$/);
  }
});

test('the keys are the ones the app has always used, so nothing already on a phone is lost', () => {
  assert.equal(cartIdKey('acme'), 'kiosk.shopper.cartId.acme');
  assert.equal(ordersKey('acme'), 'kiosk.shopper.orders.acme');
  assert.equal(deliveryAreasKey('acme'), 'kiosk.shopper.seenDeliveryAreas.acme');
});

test('forgetting a shop takes the shop and everything the app kept for it', async () => {
  const forgotten: string[] = [];
  const removed: string[][] = [];
  await forgetShopWith(
    { businessId: 'biz-1', slug: 'acme' },
    {
      forgetStore: async (id) => void forgotten.push(id),
      removeKeys: async (keys) => void removed.push(keys),
    },
  );
  assert.deepEqual(forgotten, ['biz-1']);
  assert.deepEqual(removed, [shopKeys('acme')]);
});

test('if one part cannot be done the other still is, and nothing is thrown at the screen', async () => {
  const done: string[] = [];
  await forgetShopWith(
    { businessId: 'biz-1', slug: 'acme' },
    {
      forgetStore: async () => {
        throw new Error('storage is full');
      },
      removeKeys: async () => void done.push('keys'),
    },
  );
  assert.deepEqual(done, ['keys']);

  await forgetShopWith(
    { businessId: 'biz-1', slug: 'acme' },
    {
      forgetStore: async () => void done.push('shop'),
      removeKeys: async () => {
        throw new Error('no such key');
      },
    },
  );
  assert.deepEqual(done, ['keys', 'shop']);
});
