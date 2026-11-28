/**
 * The Shopper's calls to a shop for the basket and the order, tied to this app's server address, the
 * shopper's sign-in and the phone's storage. What each call sends and how each answer is read is in
 * `lib/shop-api.ts`, which is tested; this file only supplies those four things.
 */
import { generateIdempotencyKey, getAccessToken, loadActiveStore } from '@kiosk/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartApi } from '../lib/basket-sync';
import type { CheckoutApi } from '../lib/checkout-run';
import { API_BASE_URL } from '../lib/config';
import { createShopCartApi, createShopCheckoutApi, type ShopApiDeps } from '../lib/shop-api';
import { guestKeyKey } from '../lib/shop-storage';

function depsFor(slug: string): ShopApiDeps {
  return {
    baseUrl: API_BASE_URL,
    slug,
    getBearer: async () => {
      try {
        // The sign-in is the open shop's. A basket of another shop, being worked on as the shopper moves
        // between shops, is sent as a guest's is: the order does not need an identity.
        const open = await loadActiveStore();
        if (!open || open.slug.toLowerCase() !== slug.toLowerCase()) return null;
        return (await getAccessToken(open.businessId)) ?? null;
      } catch {
        return null;
      }
    },
    readGuestKey: async () => {
      try {
        return await AsyncStorage.getItem(guestKeyKey(slug));
      } catch {
        return null;
      }
    },
    writeGuestKey: (key) => AsyncStorage.setItem(guestKeyKey(slug), key),
    correlationId: generateIdempotencyKey,
  };
}

export function cartApiFor(slug: string): CartApi {
  return createShopCartApi(depsFor(slug));
}

export function checkoutApiFor(slug: string): CheckoutApi {
  return createShopCheckoutApi(depsFor(slug));
}
