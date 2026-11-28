import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addressBookKey,
  basketKey,
  cartIdKey,
  checkoutDoubtKey,
  checkoutDraftKey,
  checkoutFactsKey,
  deliveryAreasKey,
  forgetShopWith,
  guestKeyKey,
  ordersKey,
  shopKeys,
} from '../src/lib/shop-storage';

test('what the app keeps for a shop is kept under that shop, and one shop never reaches another', () => {
  const acme = shopKeys('acme');
  const bobs = shopKeys('bobs');
  assert.equal(acme.length, 9);
  assert.deepEqual(acme, [
    cartIdKey('acme'),
    ordersKey('acme'),
    deliveryAreasKey('acme'),
    basketKey('acme'),
    addressBookKey('acme'),
    checkoutDraftKey('acme'),
    checkoutFactsKey('acme'),
    checkoutDoubtKey('acme'),
    guestKeyKey('acme'),
  ]);
  assert.equal(new Set([...acme, ...bobs]).size, 18, 'eighteen different keys');
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

test('what is held in memory for the shop is let go before its saved keys are removed, and a failure there stops nothing', async () => {
  const order: string[] = [];
  await forgetShopWith(
    { businessId: 'biz-1', slug: 'acme' },
    {
      forgetStore: async () => void order.push('shop'),
      removeKeys: async () => void order.push('keys'),
      resetMemory: (slug) => void order.push(`memory:${slug}`),
    },
  );
  assert.equal(order[0], 'memory:acme');
  assert.deepEqual([...order].sort(), ['keys', 'memory:acme', 'shop']);

  const after: string[] = [];
  await forgetShopWith(
    { businessId: 'biz-1', slug: 'acme' },
    {
      forgetStore: async () => void after.push('shop'),
      removeKeys: async () => void after.push('keys'),
      resetMemory: () => {
        throw new Error('already gone');
      },
    },
  );
  assert.deepEqual([...after].sort(), ['keys', 'shop']);
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
