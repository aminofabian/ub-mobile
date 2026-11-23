/**
 * What the Shopper keeps on this phone for one shop, apart from what the shared core keeps (the saved shop
 * and its sign-in). The names live here, in one place, so forgetting a shop clears everything the app wrote
 * for it and cannot miss a key that was added later.
 *
 * No imports, so node can run this file's test directly.
 */
const CART_ID_KEY = 'kiosk.shopper.cartId';
const ORDERS_KEY = 'kiosk.shopper.orders';
const DELIVERY_AREAS_KEY = 'kiosk.shopper.seenDeliveryAreas';

/** The basket this phone started at the shop. */
export function cartIdKey(slug: string): string {
  return `${CART_ID_KEY}.${slug}`;
}

/** The orders placed from this phone at the shop. They carry the customer's phone number. */
export function ordersKey(slug: string): string {
  return `${ORDERS_KEY}.${slug}`;
}

/** That the delivery-area note has been shown for the shop. */
export function deliveryAreasKey(slug: string): string {
  return `${DELIVERY_AREAS_KEY}.${slug}`;
}

export function shopKeys(slug: string): string[] {
  return [cartIdKey(slug), ordersKey(slug), deliveryAreasKey(slug)];
}

export interface ForgetDeps {
  /** Takes the shop, and the sign-in held for it, off this phone. */
  forgetStore(businessId: string): Promise<unknown>;
  removeKeys(keys: string[]): Promise<unknown>;
}

/**
 * Takes a shop off this phone: the saved shop and its sign-in, and what the app kept for it. Each part is
 * tried whatever happens to the other, and a part that fails is left for the next time rather than
 * reported: the person asked for the shop to go, and the list is reloaded either way.
 */
export async function forgetShopWith(store: { businessId: string; slug: string }, deps: ForgetDeps): Promise<void> {
  await Promise.allSettled([deps.forgetStore(store.businessId), deps.removeKeys(shopKeys(store.slug))]);
}
