/**
 * Telling the shop what is in the basket, whenever it can be told.
 *
 * `pushPending` sends what the shop has not heard, one line at a time (the shop sets a line to the quantity
 * it is given, and zero removes it, so a line sent twice is the same as once), and stops at the first call
 * that gets no answer, leaving the rest for the next try. Three things the shop can answer are not "try
 * later":
 * - its cart is gone (expired, or ordered): a new one is made and the lines are told to it;
 * - it will not take a line (no stock, below the minimum, not sold online): the line keeps the shop's
 *   words and is not sent again until the shopper changes it;
 * - anything else that is an error but not an answer (no signal, a timeout, a server fault) is not held
 *   against the line.
 *
 * Imports only other pure files, so node can run this file's test directly.
 */
import {
  acceptAnswer,
  changedSince,
  forgetCart,
  pendingChanges,
  quantityOf,
  refuse,
  type Basket,
  type Change,
  type ServerCart,
} from './basket';
import type { BasketStore } from './basket-store';
import { ShopApiError } from './shop-http';

export interface CartApi {
  createCart(): Promise<ServerCart>;
  setLine(cartId: string, change: Change): Promise<ServerCart>;
  /** The shop's cart as it is now. */
  getCart(cartId: string): Promise<ServerCart>;
}

export type SyncResult =
  | { kind: 'idle' }
  | { kind: 'synced' }
  | { kind: 'offline'; error: ShopApiError };

/** A shop's cart that was dropped and made again this many times in one try is not going to be told. */
const MAX_NEW_CARTS = 2;
/** A line the shop answers three times and still has not taken is not going to be: the sending stops, to try again later. */
export const MAX_UNMOVED_ANSWERS = 3;
const MAX_STEPS = 500;

function asShopError(error: unknown): ShopApiError {
  return error instanceof ShopApiError ? error : new ShopApiError('network', null, '');
}

/**
 * The words shown beside a line the shop would not take. The shop's own sentence is kept, except where it
 * is an instruction to the shop's staff ("Set a shelf price in Products ..."), which a shopper cannot act on.
 */
export function refusalText(error: ShopApiError): string {
  const text = error.detail;
  if (/shelf price|in products/i.test(text)) return 'The shop has not put a price on this online yet. Take it out, or ask the shop.';
  return text || 'The shop could not take this. Change the amount, or take it out.';
}

/** A refusal of one line, as opposed to a cart that is gone or a call that did not get an answer. */
function refusesTheLine(error: ShopApiError): boolean {
  const status = error.status;
  return error.answered && status !== null && status >= 400 && status < 500 && ![404, 408, 429].includes(status);
}

export async function pushPending(store: BasketStore, api: CartApi, now: () => Date): Promise<SyncResult> {
  let newCarts = 0;
  let didSomething = false;
  let unmoved = 0;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    // A shop that was taken off the phone is not told anything more, and nothing is written back.
    if (store.isClosed()) return { kind: didSomething ? 'synced' : 'idle' };
    const basket = store.get();
    const changes = pendingChanges(basket);
    if (changes.length === 0) return { kind: didSomething ? 'synced' : 'idle' };
    const change = changes[0];
    try {
      if (basket.cartId === null) {
        const cart = await api.createCart();
        store.update((current) => acceptAnswer(current, cart, now()));
        didSomething = true;
        continue;
      }
      const cart = await api.setLine(basket.cartId, change);
      store.update((current) => acceptAnswer(current, cart, now(), changedSince(current, change)));
      didSomething = true;
      // An answer that leaves the very same line waiting is the shop not taking it. Sent again it would
      // answer the same, up to hundreds of times; so after a few the sending stops and is tried later.
      const waiting = pendingChanges(store.get()).some((c) => c.itemId === change.itemId && c.quantity === change.quantity);
      unmoved = waiting ? unmoved + 1 : 0;
      if (unmoved >= MAX_UNMOVED_ANSWERS) return { kind: 'offline', error: new ShopApiError('unreadable', null, 'The shop did not take the change.') };
    } catch (thrown) {
      const error = asShopError(thrown);
      if (basket.cartId !== null && error.answered && error.status === 404) {
        newCarts += 1;
        if (newCarts > MAX_NEW_CARTS) return { kind: 'offline', error };
        store.update((current) => forgetCart(current, now()));
        didSomething = true;
        continue;
      }
      if (basket.cartId !== null && refusesTheLine(error)) {
        // Not if the shopper has changed the line since: the shop said no to an amount they no longer want.
        store.update((current) =>
          quantityOf(current, change.itemId) === change.quantity ? refuse(current, change.itemId, refusalText(error), now()) : current,
        );
        didSomething = true;
        continue;
      }
      return { kind: 'offline', error };
    }
  }
  return { kind: 'offline', error: new ShopApiError('network', null, '') };
}

/** How old the shop's last answer may be before a screen asks it for its prices again. */
export const READ_AFTER_MS = 2 * 60_000;

/** Whether the shop's last word on this basket is old enough to ask again. An empty basket has nothing to ask about. */
export function isStale(basket: Basket, now: Date): boolean {
  if (basket.cartId === null || basket.lines.length === 0) return false;
  if (basket.answeredAt === null) return true;
  const age = now.getTime() - Date.parse(basket.answeredAt);
  return !(age < READ_AFTER_MS);
}

/**
 * Asks the shop for its cart as it is now and takes the answer: its prices, its total and when the cart
 * ends, never what the shopper has changed since it was last told. A cart the shop no longer has is
 * forgotten, so the next send puts the lines in a new one. No answer leaves everything as it was.
 *
 * The answer is a picture of the cart at the moment the shop looked, which a slow connection can deliver
 * after a later send has been answered. So it is taken only if the basket is exactly as it was when the
 * question went out; if anything changed in between, the send that follows the change brings the prices.
 */
export async function readFromShop(store: BasketStore, api: CartApi, now: () => Date): Promise<SyncResult> {
  const asked = store.get();
  const cartId = asked.cartId;
  if (cartId === null) return { kind: 'idle' };
  try {
    const cart = await api.getCart(cartId);
    store.update((current) => (current === asked ? acceptAnswer(current, cart, now()) : current));
    return { kind: 'synced' };
  } catch (thrown) {
    const error = asShopError(thrown);
    if (error.answered && error.status === 404) {
      store.update((current) => (current === asked ? forgetCart(current, now()) : current));
      return { kind: 'synced' };
    }
    return { kind: 'offline', error };
  }
}

export interface SyncRunner {
  /** Sends what is waiting. Calls made while one is running are folded into it. */
  run(): Promise<SyncResult>;
  isRunning(): boolean;
}

export function createSyncRunner(store: BasketStore, api: CartApi, now: () => Date): SyncRunner {
  let running: Promise<SyncResult> | null = null;
  let again = false;
  return {
    isRunning: () => running !== null,
    run() {
      if (running) {
        again = true;
        return running;
      }
      const current = (async () => {
        let result: SyncResult;
        do {
          again = false;
          result = await pushPending(store, api, now);
        } while (again && result.kind !== 'offline');
        return result;
      })().finally(() => {
        running = null;
      });
      running = current;
      return current;
    },
  };
}
