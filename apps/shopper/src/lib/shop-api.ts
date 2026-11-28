/**
 * The calls the basket and the order make to a shop, and how each answer is read.
 *
 * Which headers go where follows the website, call for call:
 * - the basket (`/carts`, `/carts/{id}/lines`): no sign-in and no guest key;
 * - the shop's two checkout steps and its state: the shopper's sign-in when there is one, and the guest key
 *   the shop last gave, which the shop works out itself from the contact details and hands back with the
 *   answer to the contact step; it is kept, never made up here;
 * - the order (`/carts/{id}/checkout`): neither. The website sends none, and the shop uses the headers on this
 *   call only to find a Pickup Mtaani choice saved against the shopper, which the app does not offer.
 *
 * An answer that cannot be read is an error, not an empty success: for the order that means it may have
 * been placed, which the caller treats as in doubt.
 *
 * Imports only other pure files, so node can run this file's test directly.
 */
import type { ServerCart, ServerLine } from './basket';
import type { CartApi } from './basket-sync';
import type { ContactStep, DeliveryStep } from './checkout-form';
import type { OrderRequestSent } from './checkout-outcome';
import type { CheckoutApi, PlacedOrder } from './checkout-run';
import { ShopApiError, shopRequest, type FetchLike } from './shop-http';

export interface ShopApiDeps {
  baseUrl: string;
  slug: string;
  /** The signed-in shopper's access token, or null. Never throws. */
  getBearer(): Promise<string | null>;
  readGuestKey(): Promise<string | null>;
  writeGuestKey(key: string): Promise<void>;
  correlationId(): string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

function numberOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

/** An order's code is a few characters. Anything longer is not one, and is not put on a receipt. */
export const MAX_ORDER_CODE_LENGTH = 40;

/** The order code in the shop's answer, or nothing where there is none that can be shown. */
export function orderCodeOf(value: unknown): string | undefined {
  const text = textOf(value)?.trim();
  return text && text.length <= MAX_ORDER_CODE_LENGTH ? text : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The shop keeps a cart to a few dozen lines. An answer with far more is broken, and is not written to the phone. */
export const MAX_CART_LINES = 200;
/** A guest key is a hash or an id of a few dozen characters. */
export const MAX_GUEST_KEY_LENGTH = 200;

/** The shop's cart, as the basket reads it. A line with no item or no quantity is not a line. */
export function toServerCart(dto: unknown): ServerCart {
  if (!isRecord(dto)) throw new ShopApiError('unreadable', 200, '');
  const lines: ServerLine[] = [];
  if (Array.isArray(dto.lines)) {
    if (dto.lines.length > MAX_CART_LINES) throw new ShopApiError('unreadable', 200, '');
    for (const entry of dto.lines) {
      if (!isRecord(entry)) continue;
      const itemId = textOf(entry.itemId);
      const quantity = numberOf(entry.quantity);
      if (!itemId || quantity === null) continue;
      lines.push({
        itemId,
        name: textOf(entry.name) ?? undefined,
        variantName: textOf(entry.variantName),
        imageUrl: textOf(entry.imageUrl),
        quantity,
        unitPrice: numberOf(entry.unitPrice),
        lineTotal: numberOf(entry.lineTotal),
      });
    }
  }
  return {
    id: textOf(dto.id) ?? undefined,
    currency: textOf(dto.currency) ?? undefined,
    expiresAt: textOf(dto.expiresAt) ?? undefined,
    subtotal: numberOf(dto.subtotal),
    lines,
  };
}

/** The shop's answer to the order. Without an order id it is not an answer. */
export function toPlacedOrder(dto: unknown): PlacedOrder {
  if (!isRecord(dto)) throw new ShopApiError('unreadable', 201, '');
  const orderId = textOf(dto.orderId);
  const grandTotal = numberOf(dto.grandTotal);
  if (!orderId || grandTotal === null) throw new ShopApiError('unreadable', 201, '');
  return {
    orderId,
    orderCode: orderCodeOf(dto.orderCode),
    status: textOf(dto.status) ?? undefined,
    grandTotal,
    currency: textOf(dto.currency) ?? 'KES',
    createdAt: textOf(dto.createdAt) ?? undefined,
    receiptToken: textOf(dto.receiptToken) ?? undefined,
  };
}

export function createShopCartApi(deps: ShopApiDeps): CartApi {
  const call = (method: 'GET' | 'POST', path: string, body?: unknown) =>
    shopRequest<unknown>({
      baseUrl: deps.baseUrl,
      slug: deps.slug,
      method,
      path,
      body,
      correlationId: deps.correlationId(),
      fetchImpl: deps.fetchImpl,
      timeoutMs: deps.timeoutMs,
    });
  return {
    createCart: async () => toServerCart(await call('POST', '/carts')),
    setLine: async (cartId, change) =>
      toServerCart(await call('POST', `/carts/${encodeURIComponent(cartId)}/lines`, { itemId: change.itemId, quantity: change.quantity })),
    getCart: async (cartId) => toServerCart(await call('GET', `/carts/${encodeURIComponent(cartId)}`)),
  };
}

export function createShopCheckoutApi(deps: ShopApiDeps): CheckoutApi {
  async function keep(state: unknown): Promise<void> {
    const key = isRecord(state) ? textOf(state.guestKey)?.trim() : null;
    if (!key || key.length > MAX_GUEST_KEY_LENGTH) return;
    try {
      await deps.writeGuestKey(key);
    } catch {
      // A key that could not be kept costs the shopper nothing but a repeat of their details next time.
    }
  }

  async function step(cartId: string, which: 'contact' | 'delivery', body: ContactStep | DeliveryStep): Promise<unknown> {
    const [bearer, guestKey] = await Promise.all([deps.getBearer().catch(() => null), deps.readGuestKey().catch(() => null)]);
    const ask = (token: string | null) =>
      shopRequest<unknown>({
        baseUrl: deps.baseUrl,
        slug: deps.slug,
        method: 'PATCH',
        path: `/carts/${encodeURIComponent(cartId)}/checkout-state/${which}`,
        body,
        bearer: token,
        guestKey,
        correlationId: deps.correlationId(),
        fetchImpl: deps.fetchImpl,
        timeoutMs: deps.timeoutMs,
      });
    let state: unknown;
    try {
      state = await ask(bearer);
    } catch (thrown) {
      // The server answers an access token that has run out with 401 even on a public route, and the step
      // is the same without it (a guest makes it). So it is made again without, once, and an order the shop
      // would take is not stopped because the shopper's sign-in is an hour old.
      if (bearer && thrown instanceof ShopApiError && thrown.answered && thrown.status === 401) state = await ask(null);
      else throw thrown;
    }
    await keep(state);
    return state;
  }

  return {
    saveContact: (cartId, body) => step(cartId, 'contact', body),
    saveDelivery: (cartId, body) => step(cartId, 'delivery', body),
    submit: async (cartId: string, request: OrderRequestSent) => {
      const body: OrderRequestSent = {
        customerName: request.customerName,
        customerPhone: request.customerPhone,
        ...(request.customerEmail ? { customerEmail: request.customerEmail } : {}),
        ...(request.notes ? { notes: request.notes } : {}),
      };
      const answer = await shopRequest<unknown>({
        baseUrl: deps.baseUrl,
        slug: deps.slug,
        method: 'POST',
        path: `/carts/${encodeURIComponent(cartId)}/checkout`,
        body,
        correlationId: deps.correlationId(),
        fetchImpl: deps.fetchImpl,
        // The order is the one call worth waiting longer for: giving up on it only makes it uncertain.
        timeoutMs: deps.timeoutMs ?? 30_000,
      });
      return toPlacedOrder(answer);
    },
  };
}
