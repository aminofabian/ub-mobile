/**
 * The basket of one shop while the app is open: its store, the sender, and the order runner, made once
 * and shared by every screen. The parts are tested on their own (`basket*.ts`, `checkout-run.ts`); this
 * file only joins them to the phone's storage, the shop's API, the clock and the app coming to the front.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { getAccessToken, loadActiveStore } from '@kiosk/core';
import { fetchShopperHub } from '../api/account';
import { cartApiFor, checkoutApiFor } from '../api/checkout';
import { createBasketScheduler, type BasketScheduler } from './basket-scheduler';
import { createBasketStore, type BasketStore } from './basket-store';
import { createSyncRunner, isStale, readFromShop, type SyncResult } from './basket-sync';
import { parseDoubt, serializeDoubt, type KnownOrder } from './checkout-outcome';
import { createCheckoutRunner, type CheckoutRunner, type DoubtStorage } from './checkout-run';
import { getOrders } from './orderHistory';
import { orderCodeOf } from './shop-api';
import { basketKey, checkoutDoubtKey } from './shop-storage';

export interface BasketSession {
  slug: string;
  store: BasketStore;
  scheduler: BasketScheduler;
  checkout: CheckoutRunner;
  /** Sends what the shop has not heard and, when its last word is old, asks it for its prices again. */
  refresh(): Promise<SyncResult>;
  dispose(): void;
}

const sessions = new Map<string, BasketSession>();
const now = () => new Date();

/**
 * The shopper's orders at this shop, for recognising one whose answer was lost. Empty for a guest, and for a
 * shop that is not the one open, whose orders the hub would not list.
 */
async function listShopperOrders(slug: string): Promise<KnownOrder[]> {
  const open = await loadActiveStore().catch(() => null);
  if (!open || open.slug.toLowerCase() !== slug.toLowerCase()) return [];
  const token = await getAccessToken(open.businessId).catch(() => null);
  if (!token) return [];
  const hub = await fetchShopperHub(0, 20);
  return (hub.pickupOrders ?? []).map((order) => ({
    id: order.id,
    orderCode: orderCodeOf(order.orderCode),
    grandTotal: order.grandTotal ?? null,
    createdAt: order.createdAt,
  }));
}

function create(slug: string): BasketSession {
  const store = createBasketStore(
    {
      read: () => AsyncStorage.getItem(basketKey(slug)),
      write: (raw) => AsyncStorage.setItem(basketKey(slug), raw),
    },
    now,
  );
  const cartApi = cartApiFor(slug);
  const runner = createSyncRunner(store, cartApi, now);
  const scheduler = createBasketScheduler({
    store,
    runner,
    timers: {
      set: (callback, ms) => setTimeout(callback, ms),
      clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      now: () => Date.now(),
    },
  });
  const doubt: DoubtStorage = {
    read: async () => parseDoubt(await AsyncStorage.getItem(checkoutDoubtKey(slug))),
    write: async (record) => {
      if (record) await AsyncStorage.setItem(checkoutDoubtKey(slug), serializeDoubt(record));
      else await AsyncStorage.removeItem(checkoutDoubtKey(slug));
    },
  };
  const checkout = createCheckoutRunner({
    basket: store,
    syncNow: () => scheduler.syncNow(),
    readShop: () => readFromShop(store, cartApi, now),
    api: checkoutApiFor(slug),
    doubt,
    now,
    listOrders: () => listShopperOrders(slug),
    // An order this phone placed and heard back about is not the one whose answer was lost.
    knownOrderIds: async () => new Set((await getOrders(slug)).map((order) => order.orderId)),
  });

  async function refresh(): Promise<SyncResult> {
    const sent = await scheduler.syncNow();
    if (sent.kind !== 'offline' && isStale(store.get(), now())) await readFromShop(store, cartApi, now);
    return sent;
  }

  // Coming back to the app is the likeliest moment for the signal to have returned.
  const onAppState = (state: AppStateStatus) => {
    if (state === 'active') void refresh();
  };
  const subscription = AppState.addEventListener('change', onAppState);
  // A basket kept from last time that the shop has not heard is sent as soon as it has been read.
  void store.settled().then(() => scheduler.poke());

  return {
    slug,
    store,
    scheduler,
    checkout,
    refresh,
    dispose() {
      subscription.remove();
      scheduler.dispose();
      store.close();
    },
  };
}

export function getBasketSession(slug: string): BasketSession {
  const existing = sessions.get(slug);
  if (existing) return existing;
  const made = create(slug);
  sessions.set(slug, made);
  return made;
}

/** The shop was taken off this phone: its basket in memory goes with what was kept on disk. */
export function resetBasketSession(slug: string): void {
  const existing = sessions.get(slug);
  if (!existing) return;
  existing.dispose();
  sessions.delete(slug);
}
