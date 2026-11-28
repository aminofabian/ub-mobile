import AsyncStorage from '@react-native-async-storage/async-storage';
import { forgetStore, type StoreSnapshot } from '@kiosk/core';
import { resetBasketSession } from './basket-session';
import { forgetShopWith } from './shop-storage';

/** "Remove from this phone": the shop, its sign-in, its basket, its order list and its delivery note. */
export function forgetShop(store: StoreSnapshot): Promise<void> {
  return forgetShopWith(store, {
    forgetStore,
    removeKeys: (keys) => AsyncStorage.multiRemove(keys),
    resetMemory: resetBasketSession,
  });
}
