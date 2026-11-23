import { createContext, useContext } from 'react';
import type { OpenStoreResult } from '@kiosk/core';

/**
 * Changing shops, for the screens that sit inside a shop. The app owns the state that decides which shop is
 * on screen, so the Home header asks it through this rather than reaching into it.
 */
export interface ShopNavigator {
  /** Changing shops belongs to the generic app. A shop's own white-label app has one shop and no chip. */
  enabled: boolean;
  /** Shows the shop picker over the open shop, with a way back. */
  findAnother: () => void;
  /** Opens a shop this phone already knows, and shows it. `busy` means another shop is being opened, so nothing was started. */
  openRemembered: (tenantId: string) => Promise<OpenStoreResult | { kind: 'busy' }>;
}

const NONE: ShopNavigator = {
  enabled: false,
  findAnother: () => undefined,
  openRemembered: async () => ({ kind: 'not_found' }),
};

const ShopNavigatorContext = createContext<ShopNavigator>(NONE);

export const ShopNavigatorProvider = ShopNavigatorContext.Provider;

export function useShopNavigator(): ShopNavigator {
  return useContext(ShopNavigatorContext);
}
