import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  emptyBasket,
  itemCount as countItems,
  quantityOf,
  setQuantity as setBasketQuantity,
  viewOf,
  type Basket,
  type ItemFacts,
} from '../lib/basket';
import type { SchedulerState } from '../lib/basket-scheduler';
import { getBasketSession } from '../lib/basket-session';

const NO_BASKET: Basket = emptyBasket(new Date(0));
const QUIET: SchedulerState = { status: 'idle', failures: 0, lastError: null };
const nothing = () => undefined;

/**
 * The shopper's basket for a shop. It lives on the phone first: a tap is shown at once and told to the shop
 * a moment later, so it does not need a signal, and a basket kept from last time is there when the app opens.
 * What the shop says about prices and totals replaces the phone's figures when it answers.
 */
export function useCart(slug: string | undefined) {
  const session = slug ? getBasketSession(slug) : null;

  const basket = useSyncExternalStore(
    useCallback((listener: () => void) => (session ? session.store.subscribe(listener) : nothing), [session]),
    () => (session ? session.store.get() : NO_BASKET),
  );
  const sending = useSyncExternalStore(
    useCallback((listener: () => void) => (session ? session.scheduler.subscribe(listener) : nothing), [session]),
    () => (session ? session.scheduler.state() : QUIET),
  );

  /** Sets a line to an amount. Zero takes it out. */
  const setLineQuantity = useCallback(
    (item: ItemFacts, quantity: number) => {
      session?.store.update((current) => setBasketQuantity(current, item, quantity, new Date()));
    },
    [session],
  );

  /** Adds to a line, or takes from it with a negative amount, from what the basket holds when it runs. */
  const addToBasket = useCallback(
    (item: ItemFacts, by: number) => {
      session?.store.update((current) => setBasketQuantity(current, item, quantityOf(current, item.itemId) + by, new Date()));
    },
    [session],
  );

  /**
   * Sends what the shop has not heard and, when its last word on the prices is old, asks for them again.
   * Stable, so a screen can call it when it opens without calling again on every redraw.
   */
  const retryNow = useCallback(
    () => (session ? session.refresh() : Promise.resolve({ kind: 'idle' as const })),
    [session],
  );

  const view = useMemo(() => viewOf(basket), [basket]);
  const refusedCount = Object.keys(basket.refused).length;

  return {
    basket,
    lines: basket.lines,
    cartId: basket.cartId,
    itemCount: countItems(basket),
    quantityFor: (itemId: string) => quantityOf(basket, itemId),
    setLineQuantity,
    addToBasket,
    view,
    refused: basket.refused,
    refusedCount,
    /** The saved basket has not been read yet. */
    isLoading: session ? !session.store.isLoaded() : false,
    status: sending.status,
    /** The last send got no answer and something is still waiting. */
    offline: sending.status === 'no-signal' && view.waiting,
    retryNow,
    session,
  };
}
