/**
 * What it means when placing an order fails, and what is safe to do about it.
 *
 * Placing an order is the one call that cannot be repeated blindly. The shop does not take an idempotency
 * key, so a call that may have been carried out cannot be told apart, afterwards, from one that was not.
 * What the shop does is create the order and delete the cart in one step (`submitCheckout`), so the same cart
 * can never be ordered twice by calls that follow one another. That gives three kinds of failure:
 *
 * - the shop answered with a refusal: nothing was placed, and the shopper can fix it and try again;
 * - the shop answered that the cart is not there: this call placed nothing;
 * - no answer, an unreadable one, or a server fault: the order may exist.
 *
 * The third is kept, with exactly what was sent, until the shopper settles it: the same call may be sent
 * again to the same cart (never to a rebuilt one), and "cart not found" to that is read as "probably placed",
 * which the shopper confirms.
 *
 * Imports only the error type, so node can run this file's test directly.
 */
import type { OrderRequest } from './checkout-form';
import type { ShopApiError } from './shop-http';

export type OrderFailure =
  | { kind: 'refused'; message: string }
  | { kind: 'cart-gone' }
  | { kind: 'in-doubt'; reason: 'no-answer' | 'shop-fault' };

/** The shop itself said no to what it was sent, in its own Problem+JSON: a validation, a conflict, an unprocessable one. */
export function isShopsRefusal(error: ShopApiError): boolean {
  const status = error.status ?? 0;
  return error.answered && error.fromShop && (status === 400 || status === 409 || status === 422);
}

/** The shop says an item in the cart is not there to be sold. */
export function itemIsGone(detail: string): boolean {
  return /^item (no longer available|not found|not available)/i.test(detail.trim());
}

/**
 * `resend` is true when an earlier call of the same order may have been carried out. The shop looks the cart
 * up before it checks anything, so a cart that was ordered answers "not found", never a refusal: only the
 * shop's own refusal proves that the earlier call did not go through. An answer from something in between,
 * such as a proxy that limits calls or a portal, proves nothing, and the order stays in doubt.
 */
export function classifyOrderFailure(error: ShopApiError, resend = false): OrderFailure {
  if (!error.answered) return { kind: 'in-doubt', reason: 'no-answer' };
  const status = error.status ?? 0;
  if (status === 404) return { kind: 'cart-gone' };
  if (status === 408) return { kind: 'in-doubt', reason: 'no-answer' };
  if (status >= 500) return { kind: 'in-doubt', reason: 'shop-fault' };
  if (resend && !isShopsRefusal(error)) return { kind: 'in-doubt', reason: 'no-answer' };
  return { kind: 'refused', message: describeRefusal(error) };
}

/** A sentence from a reason that has words in it: the callers do not pass one that is empty or only spaces. */
function sentence(text: string): string {
  const clean = text.trim();
  const upper = clean.charAt(0).toUpperCase() + clean.slice(1);
  return /[.!?]$/.test(upper) ? upper : `${upper}.`;
}

/** The server's reason, in words for a shopper. The shop's own sentence is kept when it is already one. */
export function describeRefusal(error: ShopApiError): string {
  const text = error.detail.trim();
  if (error.status === 429) return 'Too many tries. Wait a minute, then place the order again.';
  if (/^cart is empty/i.test(text)) return 'Your basket is empty. Add something, then place the order.';
  if (itemIsGone(text)) {
    return 'Something in your basket is no longer sold. Place the order again: each item is checked with the shop, and the one to take out is marked.';
  }
  if (/^insufficient stock/i.test(text)) {
    const detail = /\(([^)]*)\)/.exec(text)?.[1]?.trim();
    return `Something in your basket is no longer in stock in that amount.${detail ? ` ${sentence(detail)}` : ''}`;
  }
  if (/^pricing unavailable/i.test(text)) {
    return 'The shop has not priced something in your basket. Take it out, then place the order again.';
  }
  if (/^contact details required/i.test(text)) return 'Add your name and phone.';
  if (/^invalid email/i.test(text)) return 'That email does not look right. Fix it, or leave it empty.';
  if (text) return sentence(text);
  return 'The shop could not take the order. Try again, or call the shop.';
}

/** The shortest wait before the same order is sent again after no answer: the first call may still be running. */
export const IN_DOUBT_MIN_GAP_MS = 20_000;

/** What was sent to the shop: the website's checkout body. */
export type OrderRequestSent = OrderRequest;

/** An order that was sent and not heard back about. */
export interface DoubtRecord {
  cartId: string;
  startedAt: string;
  lastTriedAt: string;
  attempts: number;
  /** What the basket came to, so a placed order can be recognised. Null when it was not known. */
  total: number | null;
  currency: string;
  /** Exactly what was sent. It is sent again unchanged, whatever the form says by then. */
  request: OrderRequestSent;
}

export function canTryAgain(record: DoubtRecord, now: Date): { ok: true } | { ok: false; waitMs: number } {
  const waited = now.getTime() - Date.parse(record.lastTriedAt);
  if (waited >= IN_DOUBT_MIN_GAP_MS || waited < 0) return { ok: true };
  return { ok: false, waitMs: IN_DOUBT_MIN_GAP_MS - waited };
}

export interface KnownOrder {
  id: string;
  /** The short code the shop quotes for the order, where its list gives one. */
  orderCode?: string;
  grandTotal?: number | string | null;
  createdAt?: string;
}

/** Clock difference allowed between the phone and the shop when recognising an order. */
export const MATCH_SLACK_MS = 5 * 60_000;

/**
 * Whether one of the shopper's orders at the shop is the one in doubt: made since it was sent, for the same
 * amount. Only an order a signed-in shopper can list can be found this way; it is a help, not a proof.
 */
export function matchPlacedOrder(record: DoubtRecord, orders: readonly KnownOrder[]): KnownOrder | null {
  if (record.total === null) return null;
  const since = Date.parse(record.startedAt) - MATCH_SLACK_MS;
  return (
    orders.find((order) => {
      const total = Number(order.grandTotal);
      const made = order.createdAt ? Date.parse(order.createdAt) : Number.NaN;
      return Number.isFinite(total) && Math.abs(total - record.total!) < 0.005 && Number.isFinite(made) && made >= since;
    }) ?? null
  );
}

/**
 * The orders this phone did not already know about. An order it placed and heard back about is not the one in
 * doubt, whatever it came to, so a second basket of the same amount is not mistaken for the first.
 */
export function withoutKnown(orders: readonly KnownOrder[], known: ReadonlySet<string>): KnownOrder[] {
  return orders.filter((order) => !known.has(order.id));
}

export function serializeDoubt(record: DoubtRecord): string {
  return JSON.stringify(record);
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export function parseDoubt(raw: string | null | undefined): DoubtRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DoubtRecord> & { request?: Partial<OrderRequestSent> };
    const cartId = text(parsed.cartId, 64);
    const startedAt = text(parsed.startedAt, 40);
    const request = parsed.request;
    if (!cartId || Number.isNaN(Date.parse(startedAt)) || !request) return null;
    const customerName = text(request.customerName, 255);
    const customerPhone = text(request.customerPhone, 64);
    if (!customerName || !customerPhone) return null;
    const lastTriedAt = text(parsed.lastTriedAt, 40);
    return {
      cartId,
      startedAt,
      lastTriedAt: Number.isNaN(Date.parse(lastTriedAt)) ? startedAt : lastTriedAt,
      attempts: typeof parsed.attempts === 'number' && parsed.attempts >= 1 ? Math.floor(parsed.attempts) : 1,
      total: typeof parsed.total === 'number' && Number.isFinite(parsed.total) ? parsed.total : null,
      currency: text(parsed.currency, 8) || 'KES',
      request: {
        customerName,
        customerPhone,
        customerEmail: request.customerEmail ? text(request.customerEmail, 255) : undefined,
        notes: request.notes ? text(request.notes, 2000) : undefined,
      },
    };
  } catch {
    return null;
  }
}
