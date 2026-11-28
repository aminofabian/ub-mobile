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
const BASKET_KEY = 'kiosk.shopper.basket';
const ADDRESS_BOOK_KEY = 'kiosk.shopper.addressBook';
const CHECKOUT_DRAFT_KEY = 'kiosk.shopper.checkoutDraft';
const CHECKOUT_FACTS_KEY = 'kiosk.shopper.checkoutFacts';
const CHECKOUT_DOUBT_KEY = 'kiosk.shopper.checkoutDoubt';
const GUEST_KEY_KEY = 'kiosk.shopper.guestKey';

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

/** What the shopper wants in the basket, and what the shop has been told of it. Held on the phone first. */
export function basketKey(slug: string): string {
  return `${BASKET_KEY}.${slug}`;
}

/** The addresses and details of the shopper, as given at checkout. */
export function addressBookKey(slug: string): string {
  return `${ADDRESS_BOOK_KEY}.${slug}`;
}

/** The checkout form as it was left, so a call, a lost signal or the app being closed does not empty it. */
export function checkoutDraftKey(slug: string): string {
  return `${CHECKOUT_DRAFT_KEY}.${slug}`;
}

/** The delivery areas and payment ways the shop last gave, for when it does not answer. */
export function checkoutFactsKey(slug: string): string {
  return `${CHECKOUT_FACTS_KEY}.${slug}`;
}

/** An order that was sent and not heard back about. */
export function checkoutDoubtKey(slug: string): string {
  return `${CHECKOUT_DOUBT_KEY}.${slug}`;
}

/** The shop's note of this shopper as a guest, so details saved with it come back. */
export function guestKeyKey(slug: string): string {
  return `${GUEST_KEY_KEY}.${slug}`;
}

export function shopKeys(slug: string): string[] {
  return [
    cartIdKey(slug),
    ordersKey(slug),
    deliveryAreasKey(slug),
    basketKey(slug),
    addressBookKey(slug),
    checkoutDraftKey(slug),
    checkoutFactsKey(slug),
    checkoutDoubtKey(slug),
    guestKeyKey(slug),
  ];
}

export interface ForgetDeps {
  /** Takes the shop, and the sign-in held for it, off this phone. */
  forgetStore(businessId: string): Promise<unknown>;
  removeKeys(keys: string[]): Promise<unknown>;
  /** Lets go of what is held in memory for the shop, so the basket does not write itself back to disk. */
  resetMemory?(slug: string): void;
}

/**
 * Takes a shop off this phone: the saved shop and its sign-in, and what the app kept for it. Each part is
 * tried whatever happens to the other, and a part that fails is left for the next time rather than
 * reported: the person asked for the shop to go, and the list is reloaded either way.
 */
export async function forgetShopWith(store: { businessId: string; slug: string }, deps: ForgetDeps): Promise<void> {
  try {
    // First, so nothing in memory is written back over the keys that are about to be removed.
    deps.resetMemory?.(store.slug);
  } catch {
    // Not being able to let go of memory does not stop the rest.
  }
  await Promise.allSettled([deps.forgetStore(store.businessId), deps.removeKeys(shopKeys(store.slug))]);
}
