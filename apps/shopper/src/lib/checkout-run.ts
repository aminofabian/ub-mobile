/**
 * Placing the order: the steps, in order, and what each outcome leaves behind.
 *
 * 1. The basket is told to the shop and priced (the order is placed from the shop's cart, not the phone's).
 * 2. The shop's two checkout steps, as the website makes them, when they can be made: the first to save the
 *    contact, the second to check the delivery area and keep the address for next time. A refusal from the
 *    shop stops the order, with its words (the area is not served, the email is not an email); no answer does
 *    not, because they are not what places the order.
 * 3. A note of what is about to be sent is written to the phone, then the order is sent. Once. Never again
 *    by itself: see `checkout-outcome.ts` for why, and for what the shopper can do if no answer comes back.
 *
 * Everything the screen needs to do next is in the result; this file does not know about screens.
 *
 * Imports only other pure files, so node can run this file's test directly.
 */
import {
  clearBasket,
  forgetCart,
  readyToOrder,
  type Basket,
  type NotReady,
} from './basket';
import type { BasketStore } from './basket-store';
import type { SyncResult } from './basket-sync';
import {
  canTryAgain,
  classifyOrderFailure,
  describeRefusal,
  itemIsGone,
  matchPlacedOrder,
  withoutKnown,
  type DoubtRecord,
  type KnownOrder,
  type OrderRequestSent,
} from './checkout-outcome';
import type { ContactStep, DeliveryStep, OrderPlan } from './checkout-form';
import { ShopApiError } from './shop-http';

export interface PlacedOrder {
  orderId: string;
  orderCode?: string;
  status?: string;
  grandTotal: number;
  currency: string;
  createdAt?: string;
  receiptToken?: string;
}

export interface CheckoutApi {
  saveContact(cartId: string, step: ContactStep): Promise<unknown>;
  saveDelivery(cartId: string, step: DeliveryStep): Promise<unknown>;
  submit(cartId: string, request: OrderRequestSent): Promise<PlacedOrder>;
}

export interface DoubtStorage {
  read(): Promise<DoubtRecord | null>;
  write(record: DoubtRecord | null): Promise<void>;
}

export interface RunDeps {
  basket: BasketStore;
  /** Tells the shop what is in the basket; resolves when it has done what it can. */
  syncNow(): Promise<SyncResult>;
  /** Asks the shop for its cart as it is now: its prices, its total and when the cart ends. */
  readShop(): Promise<SyncResult>;
  api: CheckoutApi;
  doubt: DoubtStorage;
  now(): Date;
  /** The shopper's orders at the shop, for a signed-in shopper. Absent for a guest. */
  listOrders?: () => Promise<KnownOrder[]>;
  /**
   * The ids of the orders this phone placed and was told about. They are never "the one whose answer was
   * lost", however alike their totals, so a second basket of the same amount is not mistaken for the first.
   */
  knownOrderIds?: () => Promise<ReadonlySet<string>>;
}

/** Why an order was not sent: what is wrong with the basket, or that the shop could not be asked about it. */
export type NotOrderable = NotReady | 'unreachable';

export type PlaceResult =
  | { kind: 'placed'; order: PlacedOrder }
  /** The basket is not in a state to order from, or the shop could not be asked; `why` says which. Nothing was sent. */
  | { kind: 'needs-basket'; why: NotOrderable }
  /** The shop's total is not what the shopper was shown. Nothing was sent. */
  | { kind: 'total-changed'; was: number; now: number }
  /** The shop said no. Nothing was placed. */
  | { kind: 'refused'; step: 'contact' | 'delivery' | 'order'; message: string }
  /** The shop's cart was gone when the order was sent, so nothing was placed. The lines are kept. */
  | { kind: 'basket-lapsed' }
  /** The order may or may not have been placed. */
  | { kind: 'in-doubt'; record: DoubtRecord }
  /** An order is already going out. This call did nothing; the other one will answer. */
  | { kind: 'busy' };

export interface PlaceOptions {
  /** The total the shopper was looking at when they tapped. */
  confirmedTotal?: number | null;
}

/**
 * The shop refused a checkout step. Not a 401, 403 or 407, which are about who is asking and not about the
 * details (a sign-in that has run out is refused so even on a public route), nor 404, 408 or 429.
 */
function refusedStatus(error: ShopApiError): boolean {
  const status = error.status;
  return error.answered && status !== null && status >= 400 && status < 500 && ![401, 403, 404, 407, 408, 429].includes(status);
}

function asShopError(error: unknown): ShopApiError {
  return error instanceof ShopApiError ? error : new ShopApiError('network', null, '');
}

async function safeWrite(doubt: DoubtStorage, record: DoubtRecord | null): Promise<void> {
  try {
    await doubt.write(record);
  } catch {
    // A note that could not be written must not stop an order the shopper asked for.
  }
}

export interface CheckoutRunner {
  place(plan: OrderPlan, options?: PlaceOptions): Promise<PlaceResult>;
  /** What is waiting to be settled, if anything. */
  pending(): Promise<DoubtRecord | null>;
  /** Sends the order in doubt again, to the same cart, unchanged. */
  checkAgain(): Promise<
    | PlaceResult
    | { kind: 'too-soon'; waitMs: number }
    | { kind: 'nothing-pending' }
    /** The shop has no such basket: usually because the order was placed. The shopper settles it. */
    | { kind: 'probably-placed'; record: DoubtRecord }
  >;
  /** The shopper says what happened. "Placed" empties the basket; "not placed" puts it back together. */
  settle(outcome: 'placed' | 'not-placed'): Promise<void>;
  isBusy(): boolean;
}

export function createCheckoutRunner(deps: RunDeps): CheckoutRunner {
  let busy: Promise<unknown> | null = null;

  /**
   * An order that is known to be placed. The basket is emptied and written first, and the note is cleared
   * after: a phone that dies between the two then shows an order in doubt that is not, which the shopper
   * can say is placed, and not a full basket with no note, which would order the same things again.
   */
  async function orderDone(): Promise<void> {
    deps.basket.update(() => clearBasket(deps.now()));
    await deps.basket.settled();
    await safeWrite(deps.doubt, null);
  }

  async function readyBasket(): Promise<{ ok: true; basket: Basket } | { ok: false; why: NotOrderable }> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await deps.syncNow();
      if (attempt === 0) {
        // The shop's word on the cart as it is now, not as it was when it last answered: its prices may have
        // changed, and the cart may be gone. With no answer nothing is sent, so there is nothing to be unsure of.
        const read = await deps.readShop();
        if (read.kind === 'offline') return { ok: false, why: 'unreachable' };
        // The shop answered that it no longer has the cart, so the read let it go: the lines go to a new one.
        const after = deps.basket.get();
        if (read.kind === 'synced' && after.cartId === null && after.lines.length > 0) continue;
      }
      const basket = deps.basket.get();
      const state = readyToOrder(basket, deps.now());
      if (state.ready) return { ok: true, basket };
      if ((state.why === 'lapsed' || state.why === 'no-cart') && attempt === 0) {
        // The shop's cart is not there for this order: put the same lines in a new one.
        if (state.why === 'lapsed') deps.basket.update((current) => forgetCart(current, deps.now()));
        continue;
      }
      return { ok: false, why: state.why };
    }
    return { ok: false, why: 'waiting' };
  }

  /** The shop's steps. Returns a refusal to stop on, or null to go on. */
  async function shopSteps(cartId: string, plan: OrderPlan): Promise<PlaceResult | null> {
    if (!plan.contactStep) return null;
    try {
      await deps.api.saveContact(cartId, plan.contactStep);
    } catch (thrown) {
      const error = asShopError(thrown);
      if (refusedStatus(error)) return { kind: 'refused', step: 'contact', message: describeRefusal(error) };
      return null; // no answer, a fault or a vanished cart: not what places the order
    }
    if (!plan.deliveryStep) return null;
    try {
      await deps.api.saveDelivery(cartId, plan.deliveryStep);
    } catch (thrown) {
      const error = asShopError(thrown);
      if (refusedStatus(error)) return { kind: 'refused', step: 'delivery', message: describeRefusal(error) };
      return null;
    }
    return null;
  }

  async function send(record: DoubtRecord): Promise<PlaceResult | { kind: 'probably-placed'; record: DoubtRecord }> {
    let order: PlacedOrder;
    try {
      order = await deps.api.submit(record.cartId, record.request);
    } catch (thrown) {
      const error = asShopError(thrown);
      const failure = classifyOrderFailure(error, record.attempts > 1);
      if (failure.kind === 'refused') {
        await safeWrite(deps.doubt, null);
        // The shop's cart can hold a row for an item it no longer sells that its own answer leaves out, which
        // the shopper cannot see or take out. A new cart holds only what the shopper can see, and tells the
        // shop each line again, so the one it will not take is marked.
        if (itemIsGone(error.detail)) deps.basket.update((current) => forgetCart(current, deps.now()));
        return { kind: 'refused', step: 'order', message: failure.message };
      }
      if (failure.kind === 'cart-gone') {
        if (record.attempts <= 1) {
          // The first call got an answer, and the answer was that there is no cart: nothing was placed.
          await safeWrite(deps.doubt, null);
          deps.basket.update((current) => forgetCart(current, deps.now()));
          return { kind: 'basket-lapsed' };
        }
        return { kind: 'probably-placed', record };
      }
      const kept: DoubtRecord = { ...record, lastTriedAt: deps.now().toISOString() };
      await safeWrite(deps.doubt, kept);
      return { kind: 'in-doubt', record: kept };
    }
    await orderDone();
    return { kind: 'placed', order };
  }

  async function place(plan: OrderPlan, options: PlaceOptions = {}): Promise<PlaceResult> {
    const waiting = await deps.doubt.read().catch(() => null);
    if (waiting) return { kind: 'in-doubt', record: waiting };

    const ready = await readyBasket();
    if (!ready.ok) return { kind: 'needs-basket', why: ready.why };
    const { basket } = ready;

    const total = basket.subtotal;
    if (options.confirmedTotal != null && total !== null && Math.abs(options.confirmedTotal - total) >= 0.005) {
      return { kind: 'total-changed', was: options.confirmedTotal, now: total };
    }

    const cartId = basket.cartId as string;
    const stopped = await shopSteps(cartId, plan);
    if (stopped) return stopped;

    const started = deps.now().toISOString();
    const record: DoubtRecord = {
      cartId,
      startedAt: started,
      lastTriedAt: started,
      attempts: 1,
      total,
      currency: basket.currency,
      request: plan.request,
    };
    await safeWrite(deps.doubt, record);
    const result = await send(record);
    // "Probably placed" is only reached from a second try, which `place` never makes.
    return result.kind === 'probably-placed' ? { kind: 'in-doubt', record: result.record } : result;
  }

  async function checkAgain() {
    const record = await deps.doubt.read().catch(() => null);
    if (!record) return { kind: 'nothing-pending' as const };

    if (deps.listOrders) {
      try {
        const listed = await deps.listOrders();
        // Not being able to say which orders are known leaves them all in: the match then rests on the total and the time.
        const known = deps.knownOrderIds ? await deps.knownOrderIds().catch(() => new Set<string>()) : new Set<string>();
        const found = matchPlacedOrder(record, withoutKnown(listed, known));
        if (found) {
          await orderDone();
          return {
            kind: 'placed' as const,
            order: {
              orderId: found.id,
              ...(found.orderCode ? { orderCode: found.orderCode } : {}),
              grandTotal: Number(found.grandTotal),
              currency: record.currency,
              createdAt: found.createdAt,
            },
          };
        }
      } catch {
        // Not being able to look is not an answer.
      }
    }

    const wait = canTryAgain(record, deps.now());
    if (!wait.ok) return { kind: 'too-soon' as const, waitMs: wait.waitMs };

    const next: DoubtRecord = { ...record, attempts: record.attempts + 1, lastTriedAt: deps.now().toISOString() };
    await safeWrite(deps.doubt, next);
    return send(next);
  }

  async function settle(outcome: 'placed' | 'not-placed'): Promise<void> {
    if (outcome === 'placed') {
      await orderDone();
      return;
    }
    await safeWrite(deps.doubt, null);
    deps.basket.update((current) => forgetCart(current, deps.now()));
  }

  /** One at a time. A second tap while an order is going out is told so, and does nothing. */
  function once<T>(run: () => Promise<T>): Promise<T | { kind: 'busy' }> {
    if (busy) return Promise.resolve({ kind: 'busy' as const });
    const current = run().finally(() => {
      busy = null;
    });
    busy = current;
    return current;
  }

  return {
    place: (plan, options) => once(() => place(plan, options)),
    checkAgain: () => once(checkAgain),
    settle,
    pending: () => deps.doubt.read().catch(() => null),
    isBusy: () => busy !== null,
  };
}
