import { tenantKeeper, type Keeper } from '@kiosk/core';
import { decodeBasket, encodeBasket, type Basket } from '../lib/basket';
import { decodeForwards, encodeForwards, NO_FORWARDS, type ForwardState } from '../lib/forward';
import { decodeDrafts, encodeDrafts, type DraftState } from '../lib/drafts';

/**
 * What the Grocery counter keeps on the phone, per shop: the sale being put together (the basket) and the sales that
 * are waiting to be sent to the cashier. The same keeper is handed to every screen that asks, so a count in a banner and
 * the list behind it always agree, and a closed app or a flat battery loses neither.
 */

export function basketKeeperFor(tenantId: string): Keeper<Basket | null> {
  return tenantKeeper<Basket | null>('groceryBasket', tenantId, {
    initial: null,
    parse: (text, now) => decodeBasket(text, now),
    serialize: (basket) => encodeBasket(basket),
  });
}

/** Baskets parked at the counter, beside the one being worked on. */
export function draftsKeeperFor(tenantId: string): Keeper<DraftState | null> {
  return tenantKeeper<DraftState | null>('groceryDrafts', tenantId, {
    initial: null,
    parse: (text, now) => decodeDrafts(text, now),
    serialize: (state) => encodeDrafts(state),
  });
}

export function forwardKeeperFor(tenantId: string): Keeper<ForwardState> {
  return tenantKeeper<ForwardState>('groceryForwards', tenantId, {
    initial: NO_FORWARDS,
    parse: (text, now) => decodeForwards(text, now) ?? NO_FORWARDS,
    serialize: (state) => (state.entries.length === 0 ? null : encodeForwards(state)),
  });
}
