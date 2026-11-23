import type { ApiClient } from '@kiosk/core';
import type { phase_1 } from '@kiosk/types';
import type { CartItem } from '../lib/cart';
import { matchCustomers, type CustomerMatch } from '../lib/customer-match';
import type { Freshness } from '../lib/holds';
import { itemLabel } from '../lib/item-label';
import { normalizeKenyanPhone } from '../lib/phone';
import { parseItemTypes, type ItemType, type QuickCreateBody } from '../lib/quick-product';
import { parseShopFlags, type ShopFlags } from '../lib/shop-flags';
import type { CloseBody } from '../lib/shift-cash';
import { parseWebOrders, type WebOrder } from '../lib/web-orders';
import { withTimeout } from '../lib/with-timeout';

type ShiftResponse = phase_1.components['schemas']['ShiftResponse'];
type SaleResponse = phase_1.components['schemas']['SaleResponse'];
type PostSaleRequest = phase_1.components['schemas']['PostSaleRequest'];

/** What the till can ring up: the thing a cart line is made from. */
export type PosItem = CartItem;

export interface GroceryInvoice {
  id: string;
  invoiceNumber?: string;
  status?: string;
  grandTotal?: number;
  customerName?: string;
}

export async function fetchCurrentShift(api: ApiClient, branchId: string): Promise<ShiftResponse> {
  return api.get<ShiftResponse>(`/api/v1/shifts/current?branchId=${encodeURIComponent(branchId)}`);
}

export async function openShift(
  api: ApiClient,
  branchId: string,
  openingCash: number,
  notes?: string
): Promise<ShiftResponse> {
  return api.post<ShiftResponse>(
    '/api/v1/shifts/open',
    { branchId, openingCash, notes },
    { idempotent: true }
  );
}

/** What the last shift on this till counted at close: the float the next one can start from. Empty when there was none. */
export async function fetchLastClosed(
  api: ApiClient,
  branchId: string
): Promise<{ countedClosingCash?: number | null; closedAt?: string | null }> {
  return api.get(`/api/v1/shifts/last-closed?branchId=${encodeURIComponent(branchId)}`);
}

/** Closes a shift on what the cashier counted. `varianceReason` is the cashier's words for a count that does not match. */
export async function closeShift(api: ApiClient, shiftId: string, body: CloseBody): Promise<ShiftResponse> {
  return api.post<ShiftResponse>(`/api/v1/shifts/${shiftId}/close`, body, { idempotent: true });
}

/** The rows of a list the server sent: a Spring page (`content`), an older `items` wrapper, or a bare array. */
export function pageRows<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (response && typeof response === 'object') {
    const record = response as { content?: unknown; items?: unknown };
    if (Array.isArray(record.content)) return record.content as T[];
    if (Array.isArray(record.items)) return record.items as T[];
  }
  return [];
}

/** One row of the server's item list. Only what the till reads. */
interface ItemRow {
  id: string;
  name?: string;
  barcode?: string | null;
  sellingPrice?: number | null;
  stockQty?: number | null;
  active?: boolean;
  isSellable?: boolean;
  groupLabelOnly?: boolean;
  /** Sold by weight. */
  isWeighed?: boolean;
  /** What it is counted in: each, kg, g, lb. */
  unitType?: string | null;
  /** Sold as a pack whose stock is held on another item. */
  packageVariant?: boolean;
  variantName?: string | null;
  parentName?: string | null;
  variantOfItemId?: string | null;
  brand?: string | null;
  size?: string | null;
}

/** A row the shop offers for sale: active, sellable on its own, and not just a heading over its sizes. */
function offered(row: ItemRow): boolean {
  return typeof row.id === 'string' && row.active !== false && row.isSellable !== false && row.groupLabelOnly !== true;
}

/** What the till can ring up: a row that is offered, and has a price. */
function sellable(row: ItemRow): boolean {
  return offered(row) && typeof row.sellingPrice === 'number' && Number.isFinite(row.sellingPrice);
}

/** One row of the server's list as the till reads it. What a plain, counted product does not need is left out. */
function toPosItem(row: ItemRow): PosItem {
  const unit = typeof row.unitType === 'string' ? row.unitType.trim().toLowerCase() : '';
  return {
    id: row.id,
    name: itemLabel(row),
    ...(row.barcode ? { barcode: row.barcode } : {}),
    sellingPrice: typeof row.sellingPrice === 'number' && Number.isFinite(row.sellingPrice) ? row.sellingPrice : 0,
    ...(typeof row.stockQty === 'number' ? { stockOnHand: row.stockQty } : {}),
    ...(row.isWeighed === true ? { weighed: true as const, ...(unit ? { unitType: unit } : {}) } : {}),
    ...(row.packageVariant === true ? { packageVariant: true as const } : {}),
  };
}

export async function searchItems(
  api: ApiClient,
  options: { search?: string; barcode?: string; branchId?: string }
): Promise<PosItem[]> {
  const params: string[] = [];
  if (options.search) params.push(`search=${encodeURIComponent(options.search)}`);
  if (options.barcode) params.push(`barcode=${encodeURIComponent(options.barcode)}`);
  if (options.branchId) params.push(`branchId=${encodeURIComponent(options.branchId)}`);
  const query = params.length ? `?${params.join('&')}` : '';
  const response = await api.get<unknown>(`/api/v1/items${query}`);
  return pageRows<ItemRow>(response).filter(sellable).map(toPosItem);
}

const FRESH_PAGE_SIZE = 50;
const FRESH_AT_ONCE = 3;
const FRESH_WAIT_MS = 8_000;

/**
 * What the shop says about the items in a held basket now. The server cannot be asked for several items by id, so each
 * is looked for by its name (with the separators the till put in it taken out) and picked out of the answer by id.
 *
 * An item that is found and offered is as the server shows it. One that is found but no longer offered is `null`: gone.
 * One that is not in the answer at all, or whose lookup failed or ran late, is left out, and a basket treats that as
 * "could not check", never as gone: the server may simply have ranked it below the first page.
 */
export async function fetchFreshItems(
  api: ApiClient,
  lines: readonly { itemId: string; name: string }[],
  branchId: string,
  options: { atOnce?: number; waitMs?: number } = {}
): Promise<Freshness> {
  const fresh: Freshness = {};
  const waitMs = options.waitMs ?? FRESH_WAIT_MS;
  const queue = lines.filter((line, index) => lines.findIndex((other) => other.itemId === line.itemId) === index);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < queue.length) {
      const line = queue[next];
      next += 1;
      if (!line) continue;
      try {
        const term = line.name.replace(/[·•]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!term) continue;
        const path =
          `/api/v1/items?search=${encodeURIComponent(term)}&branchId=${encodeURIComponent(branchId)}` +
          `&includeInactive=true&size=${FRESH_PAGE_SIZE}`;
        const response = await withTimeout(() => api.get<unknown>(path), waitMs, () => new Error('The lookup took too long'));
        const row = pageRows<ItemRow>(response).find((candidate) => candidate.id === line.itemId);
        if (row) fresh[line.itemId] = offered(row) ? toPosItem(row) : null;
      } catch {
        // Left out: the basket keeps this line as it was held.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.atOnce ?? FRESH_AT_ONCE, queue.length) }, () => worker()));
  return fresh;
}

/** What this shop lets a till do (`GET /api/v1/businesses/me`). Any signed-in person may read it. */
export async function fetchShopFlags(api: ApiClient): Promise<ShopFlags> {
  return parseShopFlags(await api.get<unknown>('/api/v1/businesses/me'));
}

/** The shop's web orders, the newest first (the server's order), as many as one page. Needs the storefront permission. */
export async function fetchWebOrders(api: ApiClient): Promise<WebOrder[]> {
  return parseWebOrders(pageRows<unknown>(await api.get<unknown>('/api/v1/web-orders?size=50')));
}

/**
 * Moves a paid web order one step along. The server allows one step at a time and answers 409 to a step already taken,
 * which is what keeps a second tap, or a second till, from doing it twice. Open to anyone who can sell.
 */
export async function advanceWebOrder(api: ApiClient, orderId: string, to: 'confirmed' | 'dispatched' | 'completed'): Promise<void> {
  await api.patch(`/api/v1/web-orders/${encodeURIComponent(orderId)}/fulfillment`, { fulfillmentStatus: to });
}

/** The kinds of product the shop has: what a new product must be filed under. */
export async function fetchItemTypes(api: ApiClient): Promise<ItemType[]> {
  return parseItemTypes(await api.get<unknown>('/api/v1/item-types'));
}

/**
 * Adds a product at this till's branch, with its price and opening stock, and gives it back as something to ring up.
 * Sent with a key, but the server counts the opening stock again on a repeat, so a request that got no answer is never
 * sent again by the till: the cashier is sent to look for the product first.
 */
export async function quickCreateItem(api: ApiClient, body: QuickCreateBody): Promise<PosItem> {
  const created = await api.post<{ id?: unknown } | null>('/api/v1/pos/quick-items', body, { idempotent: true });
  const id = typeof created?.id === 'string' ? created.id.trim() : '';
  if (!id) throw new Error('The server did not say which product it made');
  return {
    id,
    name: itemLabel({ name: body.name }),
    ...(body.barcode ? { barcode: body.barcode } : {}),
    sellingPrice: body.unitPrice,
    ...(body.initialStockQty !== undefined ? { stockOnHand: body.initialStockQty } : {}),
  };
}

/** Marks a product as sold by weight, in kilograms (or clears it). The server refuses a pack. */
export async function markWeighed(api: ApiClient, itemId: string, weighed = true): Promise<void> {
  await api.put(`/api/v1/pos/items/${encodeURIComponent(itemId)}/weighed`, { weighed });
}

// Pass the same `idempotencyKey` each time one sale is sent (live request, queued copy, replay)
// so the server records it once. Without one, every call gets a fresh key.
export async function createSale(
  api: ApiClient,
  request: PostSaleRequest,
  idempotencyKey?: string
): Promise<SaleResponse> {
  return api.post<SaleResponse>('/api/v1/sales', request, { idempotent: true, idempotencyKey });
}

export type PosCustomerHit = {
  id: string;
  name: string;
};

/** Every customer the server says has exactly this number (it matches whole numbers, digits only, not part of one). */
async function customersWithPhone(api: ApiClient, phone: string): Promise<PosCustomerHit[]> {
  const q = phone.trim();
  if (!q) return [];
  const params = new URLSearchParams({ page: '0', size: '5', phone: q });
  const response = await api.get<{ content?: PosCustomerHit[] } | PosCustomerHit[]>(
    `/api/v1/customers?${params}`
  );
  return Array.isArray(response) ? response : (response.content ?? []);
}

export async function lookupCustomerByPhone(
  api: ApiClient,
  phone: string
): Promise<PosCustomerHit | null> {
  return (await customersWithPhone(api, phone))[0] ?? null;
}

/**
 * The customer who is already on file under this number. Never creates one. The server keeps a number the way it
 * was typed ("0712..." and "254712..." are two numbers to it), so both are looked up, and a number that more than one
 * customer has is reported as such rather than guessed at.
 */
export async function findCustomerByPhone(
  api: ApiClient,
  raw: string
): Promise<CustomerMatch<PosCustomerHit> | null> {
  const phone = normalizeKenyanPhone(raw);
  if (!phone) return null;
  const rows: PosCustomerHit[] = [];
  for (const variant of [phone, `0${phone.slice(3)}`]) {
    rows.push(...(await customersWithPhone(api, variant)));
  }
  return matchCustomers(rows);
}

/**
 * The customer behind an M-Pesa number: the one on file, or a new one made from the number alone (named by the number,
 * because the server wants a name and the till has none). A number that more than one customer has is never guessed at:
 * the sale is simply not linked to anyone.
 */
export async function ensureCustomerByPhone(
  api: ApiClient,
  raw: string
): Promise<PosCustomerHit | null> {
  const phone = normalizeKenyanPhone(raw);
  if (!phone) return null;
  const found = await findCustomerByPhone(api, phone);
  if (found?.kind === 'one') return found.customer;
  if (found?.kind === 'several') return null;
  try {
    return await api.post<PosCustomerHit>(
      '/api/v1/customers',
      { name: phone, phones: [{ phone, primary: true }] },
      { idempotent: true }
    );
  } catch {
    // Another till may have made them a moment ago: look again, and still never choose between several.
    const again = await findCustomerByPhone(api, phone).catch(() => null);
    return again?.kind === 'one' ? again.customer : null;
  }
}

export async function fetchPendingGroceryInvoices(api: ApiClient): Promise<GroceryInvoice[]> {
  const response = await api.get<{ invoices?: GroceryInvoice[] } | GroceryInvoice[]>(
    '/api/v1/grocery/invoices?status=PENDING'
  );
  return Array.isArray(response) ? response : (response.invoices ?? []);
}

export async function payGroceryInvoice(
  api: ApiClient,
  invoiceId: string,
  payments: { method: string; amount: number; reference?: string }[]
): Promise<unknown> {
  return api.post(`/api/v1/grocery/invoices/${invoiceId}/pay`, { payments }, { idempotent: true });
}

export async function fetchPosDrafts(api: ApiClient): Promise<unknown[]> {
  const response = await api.get<{ drafts?: unknown[] } | unknown[]>('/api/v1/pos-drafts');
  return Array.isArray(response) ? response : (response.drafts ?? []);
}
