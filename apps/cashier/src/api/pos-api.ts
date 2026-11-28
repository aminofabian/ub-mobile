import { findCustomerByPhone as coreFindCustomerByPhone, generateIdempotencyKey, type ApiClient } from '@kiosk/core';
import type { phase_1 } from '@kiosk/types';
import type { CartItem } from '../lib/cart';
import type { CatalogPage } from '../lib/catalog-copy';
import { matchCustomers, type CustomerMatch } from '../lib/customer-match';
import type { Freshness } from '../lib/holds';
import { itemLabel } from '../lib/item-label';
import { normalizeKenyanPhone } from '../lib/phone';
import { parseItemTypes, type ItemType, type QuickCreateBody } from '../lib/quick-product';
import type { SaleLine } from '../lib/sale-flow';
import { parseShopFlags, type ShopFlags } from '../lib/shop-flags';
import type { CloseBody } from '../lib/shift-cash';
import { parseWebOrders, type WebOrder } from '../lib/web-orders';
import { withTimeout } from '../lib/with-timeout';

type ShiftResponse = phase_1.components['schemas']['ShiftResponse'];
type SaleResponse = phase_1.components['schemas']['SaleResponse'];
type PostSaleRequest = phase_1.components['schemas']['PostSaleRequest'];

/** A sale as it is sent: the generated shape, but with lines that may be services as well as products. */
export type SaleRequest = Omit<PostSaleRequest, 'lines'> & { lines: readonly SaleLine[] };

/** What the till can ring up: the thing a cart line is made from. */
export type PosItem = CartItem;

/** One line of a forwarded grocery invoice: what the clerk put in the basket. */
export interface GroceryInvoiceLine {
  itemName: string;
  quantity: number;
  unitName?: string;
  unitPrice?: number;
  lineTotal?: number;
}

/**
 * A grocery invoice forwarded from the counter to the till. The clerk builds a basket in the Grocery app and sends it
 * here; the cashier takes the payment. `createdByName` is the clerk who sent it; `customerPhone` lets the till push an
 * M-Pesa prompt. Fields are optional because an older server, or a list view, may send a thinner shape.
 */
export interface GroceryInvoice {
  id: string;
  invoiceNumber?: string;
  barcodeCode?: string;
  status?: string;
  subtotal?: number;
  grandTotal?: number;
  customerName?: string;
  customerPhone?: string;
  createdByName?: string;
  createdAt?: string;
  notes?: string;
  lastStkStatus?: string;
  lines?: GroceryInvoiceLine[];
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
  return api.post<ShiftResponse>(`/api/v1/shifts/${encodeURIComponent(shiftId)}/close`, body, { idempotent: true });
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
  /** HTTPS URL for a list thumbnail (the server's own words); used verbatim on the grid tile. */
  thumbnailUrl?: string | null;
  /** The primary image key — sometimes already a full URL, sometimes a storage key we cannot resolve here. */
  imageKey?: string | null;
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
/** The product photo for the grid, when the server gave a usable one. Only an http(s) URL is used. */
function itemImage(row: ItemRow): string | null {
  const url = (row.thumbnailUrl ?? '').trim();
  if (/^https?:\/\//i.test(url)) return url;
  const key = (row.imageKey ?? '').trim();
  // imageKey is a full URL on some rows and a bare storage key on others; the till can only show the
  // former — a bare key has no host to fetch from here.
  if (/^https?:\/\//i.test(key)) return key;
  return null;
}

function toPosItem(row: ItemRow): PosItem {
  const unit = typeof row.unitType === 'string' ? row.unitType.trim().toLowerCase() : '';
  const image = itemImage(row);
  return {
    id: row.id,
    name: itemLabel(row),
    ...(row.barcode ? { barcode: row.barcode } : {}),
    sellingPrice: typeof row.sellingPrice === 'number' && Number.isFinite(row.sellingPrice) ? row.sellingPrice : 0,
    ...(typeof row.stockQty === 'number' ? { stockOnHand: row.stockQty } : {}),
    ...(image ? { imageUrl: image } : {}),
    ...(row.isWeighed === true ? { weighed: true as const, ...(unit ? { unitType: unit } : {}) } : {}),
    ...(row.packageVariant === true ? { packageVariant: true as const } : {}),
    ...(row.groupLabelOnly === true ? { variantParent: true as const } : {}),
  };
}

/** A family parent that only groups sizes: shown on the grid as "pick a size", not sold on its own. */
function isVariantParent(row: ItemRow): boolean {
  return typeof row.id === 'string' && row.active !== false && row.groupLabelOnly === true;
}

/**
 * The products the browse grid shows: the sellable ones, plus family parents (so a cashier can tap a
 * product and choose its size). Parents carry no price of their own; the tile labels them for the
 * picker. Search and scan still use {@link sellable} only.
 */
function browsable(row: ItemRow): boolean {
  return sellable(row) || isVariantParent(row);
}

/** The sizes/variants under a family parent, fetched when the cashier taps it. */
export async function fetchItemVariants(api: ApiClient, itemId: string): Promise<PosItem[]> {
  const raw = await api.get<unknown>(`/api/v1/items/${encodeURIComponent(itemId)}`);
  const variants =
    raw && typeof raw === 'object' && Array.isArray((raw as { variants?: unknown[] }).variants)
      ? ((raw as { variants: unknown[] }).variants as ItemRow[])
      : [];
  return variants.filter(sellable).map(toPosItem);
}

/**
 * How many products the grid asks for when nothing is being searched: enough to fill the screen and
 * scroll, and the window the best-sellers are chosen from. A shop may have thousands of products; the
 * till shows the ones it sells, not all of them, until the cashier searches.
 */
export const BROWSE_SIZE = 60;

export async function searchItems(
  api: ApiClient,
  options: { search?: string; barcode?: string; branchId?: string; categoryId?: string; size?: number }
): Promise<PosItem[]> {
  const params: string[] = [];
  if (options.search) params.push(`search=${encodeURIComponent(options.search)}`);
  if (options.barcode) params.push(`barcode=${encodeURIComponent(options.barcode)}`);
  if (options.branchId) params.push(`branchId=${encodeURIComponent(options.branchId)}`);
  if (options.categoryId) {
    params.push(`categoryId=${encodeURIComponent(options.categoryId)}`);
    // A category stands for itself and everything filed under it, so a parent shows its children's items too.
    params.push('includeCategoryDescendants=true');
  }
  // Browsing with no search term: ask for a full window so the grid is a scrollable shelf, not the
  // first page by name. Best-sellers are floated to the top on the client. A search or scan takes
  // whatever matches, at the server's own page size.
  const browsing = !options.search && !options.barcode;
  if (browsing) {
    params.push(`size=${options.size ?? BROWSE_SIZE}`);
  }
  const query = params.length ? `?${params.join('&')}` : '';
  const response = await api.get<unknown>(`/api/v1/items${query}`);
  // Browsing shows family parents too (tap to pick a size); a search or scan wants a thing that sells.
  return pageRows<ItemRow>(response).filter(browsing ? browsable : sellable).map(toPosItem);
}

const FRESH_PAGE_SIZE = 50;
/** How many lines of a held basket are checked with the shop at once, and how long each check may take. */
export const FRESH_AT_ONCE = 3;
export const FRESH_WAIT_MS = 8_000;

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

/**
 * Where a page sits in the whole list, as the server says it. A Spring page says `last` and `totalElements` at the top;
 * a newer shape puts the counts under `page`. `last` is null when the server did not say, and the reader then goes by
 * the page being short.
 */
export function readPageInfo(response: unknown, requested: number): { last: boolean | null; total: number | null } {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return { last: null, total: null };
  const top = response as Record<string, unknown>;
  const nested = top.page && typeof top.page === 'object' ? (top.page as Record<string, unknown>) : {};
  const count = (key: string): number | null => {
    for (const source of [top, nested]) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
    }
    return null;
  };
  const totalPages = count('totalPages');
  const number = count('number') ?? requested;
  const last = typeof top.last === 'boolean' ? top.last : totalPages !== null ? number + 1 >= totalPages : null;
  return { last, total: count('totalElements') };
}

/**
 * One page of the branch's whole product list, for the copy kept on the phone: what can be sold, as the till reads it.
 * The server sorts by name, and the same sort carries every page, so a product is not read twice or skipped.
 */
export async function fetchCatalogPage(api: ApiClient, branchId: string, page: number, size: number): Promise<CatalogPage> {
  const response = await api.get<unknown>(
    `/api/v1/items?branchId=${encodeURIComponent(branchId)}&page=${page}&size=${size}`
  );
  const rows = pageRows<ItemRow>(response);
  return { items: rows.filter(sellable).map(toPosItem), seen: rows.length, ...readPageInfo(response, page) };
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

/** What the server says a product is after its weighed flag was set: whether it now sells by weight, and in what unit. */
export interface WeighedState {
  isWeighed: boolean;
  unitType?: string | null;
}

/**
 * Marks a product as sold by weight, in kilograms (or clears it). The server refuses a pack. Returns
 * the product's new state so the till can convert the basket line (units ↔ kg) to match.
 */
export async function markWeighed(api: ApiClient, itemId: string, weighed = true): Promise<WeighedState> {
  const row = await api.put<ItemRow>(`/api/v1/pos/items/${encodeURIComponent(itemId)}/weighed`, { weighed });
  return {
    isWeighed: row?.isWeighed === true,
    unitType: typeof row?.unitType === 'string' ? row.unitType : null,
  };
}

// Pass the same `idempotencyKey` each time one sale is sent (live request, queued copy, replay)
// so the server records it once. Without one, every call gets a fresh key.
/**
 * Void a completed sale (e.g. a mis-ring the cashier spotted right after). The server reverses the
 * stock and the money; it is idempotent, so voiding an already-voided sale is harmless. `notes` says
 * why, for the record. Needs `sales.void.any` or `sales.void.own`.
 */
export async function voidSale(api: ApiClient, saleId: string, notes?: string): Promise<void> {
  const body = notes && notes.trim() ? { notes: notes.trim() } : {};
  await api.post(`/api/v1/sales/${encodeURIComponent(saleId)}/void`, body);
}

/**
 * Write a product's shelf price for the branch — the price every till will read from now on, not
 * just this one line. Used when a cashier changes a line's price and chooses to make it the new
 * shelf price. Needs `pricing.sell_price.set`.
 */
export async function setShelfPrice(
  api: ApiClient,
  itemId: string,
  priceShillings: number,
  branchId?: string
): Promise<void> {
  await api.post('/api/v1/pricing/selling-prices', {
    itemId,
    price: priceShillings,
    effectiveFrom: new Date().toISOString(),
    ...(branchId ? { branchId } : {}),
  });
}

/**
 * Log that the cash drawer was opened by hand (to make change, or correct a till) — not off a sale.
 * The shift keeps the record, so a manager can see every time the drawer was opened. The phone has
 * no attached drawer to pop; this only writes the audit. Needs `sales.sell`.
 */
export async function logDrawerOpen(api: ApiClient, branchId: string, shiftId?: string): Promise<void> {
  await api.post('/api/v1/cash-drawer/opens', {
    clientEventId: generateIdempotencyKey(),
    openedAt: new Date().toISOString(),
    source: 'KEY',
    reason: 'KEY',
    branchId,
    ...(shiftId ? { shiftId } : {}),
  });
}

/**
 * Record a cash pay-out from an open till (a drawout) — paying a supplier in cash, a casual's wage,
 * transport. The shift's cash is reduced by it; a big one may need an owner's approval, which the
 * server decides. Needs an open shift, the shop's drawout setting on, and this cashier allowed.
 */
export async function recordDrawout(
  api: ApiClient,
  shiftId: string,
  body: { amount: number; category: string; description: string; recipientName: string; reference?: string }
): Promise<{ pendingApproval: boolean }> {
  const res = await api.post<Record<string, unknown>>(`/api/v1/shifts/${encodeURIComponent(shiftId)}/drawouts`, {
    amount: body.amount,
    category: body.category,
    description: body.description,
    recipientName: body.recipientName,
    ...(body.reference ? { reference: body.reference } : {}),
  });
  const status = typeof res?.status === 'string' ? res.status : '';
  return { pendingApproval: /pending|await|review/i.test(status) };
}

export async function createSale(
  api: ApiClient,
  request: SaleRequest,
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

/** Pending grocery invoices waiting for payment at the till. Status must match the server (`pending_payment`). */
export async function fetchPendingGroceryInvoices(api: ApiClient): Promise<GroceryInvoice[]> {
  const response = await api.get<{ invoices?: GroceryInvoice[] } | GroceryInvoice[]>(
    '/api/v1/grocery/invoices?status=pending_payment'
  );
  return Array.isArray(response) ? response : (response.invoices ?? []);
}

/** What the server answers when a grocery invoice is paid in full: the sale it made, for the receipt screen. */
export type PayGroceryInvoiceResult = {
  invoiceId?: string;
  saleId?: string;
  status?: string;
  paidAt?: string;
  receipt?: SaleResponse;
};

export async function payGroceryInvoice(
  api: ApiClient,
  invoiceId: string,
  payments: { method: string; amount: number; reference?: string }[]
): Promise<PayGroceryInvoiceResult> {
  return api.post<PayGroceryInvoiceResult>(
    `/api/v1/grocery/invoices/${encodeURIComponent(invoiceId)}/pay`,
    { payments },
    { idempotent: true }
  );
}

/** The full invoice, with its lines, by id. Used when the cashier opens a forwarded invoice to ring it up. */
export async function fetchGroceryInvoice(api: ApiClient, invoiceId: string): Promise<GroceryInvoice> {
  return api.get<GroceryInvoice>(`/api/v1/grocery/invoices/${encodeURIComponent(invoiceId)}`);
}

/** The answer to an M-Pesa prompt the till asks the server to send to a customer's phone. */
export type InvoiceStkResult = { accepted: boolean; status?: string; message?: string; checkoutRequestId?: string };

/**
 * Ask the server to push an M-Pesa prompt to the invoice's customer phone (Daraja STK). The callback arrives later and
 * may be slow, twice, or never — the till watches the invoice's `lastStkStatus` rather than trusting this answer alone.
 */
export async function payGroceryInvoiceStk(api: ApiClient, invoiceId: string, phone?: string): Promise<InvoiceStkResult> {
  const body = phone ? { customerPhone: phone } : {};
  return api.post<InvoiceStkResult>(`/api/v1/grocery/invoices/${encodeURIComponent(invoiceId)}/stk`, body, { idempotent: true });
}

export async function fetchPosDrafts(api: ApiClient): Promise<unknown[]> {
  const response = await api.get<{ drafts?: unknown[] } | unknown[]>('/api/v1/pos-drafts');
  return Array.isArray(response) ? response : (response.drafts ?? []);
}

/** A product category a shop keeps. The till lists them to tag a new product, and can add a new one. */
export interface Category {
  id: string;
  name: string;
}

function readCategory(raw: unknown): Category | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : null;
  const name = typeof o.name === 'string' ? o.name : null;
  if (!id || !name) return null;
  return { id, name };
}

/** The shop's categories, to pick from when adding a product. */
export async function fetchCategories(api: ApiClient): Promise<Category[]> {
  const response = await api.get<unknown>('/api/v1/categories');
  const list = Array.isArray(response)
    ? response
    : response && typeof response === 'object'
      ? ((response as { content?: unknown[]; categories?: unknown[] }).content ?? (response as { categories?: unknown[] }).categories ?? [])
      : [];
  return (list as unknown[]).map(readCategory).filter((c): c is Category => c !== null);
}

/** Add a new category. Returns it so the new product can be tagged with it at once. */
export async function createCategory(api: ApiClient, name: string): Promise<Category> {
  const created = await api.post<unknown>('/api/v1/categories', { name }, { idempotent: true });
  const category = readCategory(created);
  if (!category) throw new Error('The server did not return the new category.');
  return category;
}

/** A supplier the shop buys from. */
export interface Supplier {
  id: string;
  name: string;
  /** The shop's code for the supplier: `SYS-UNASSIGNED` marks the migration bucket, which is not a supplier. */
  code: string | null;
}

function readSupplier(raw: unknown): Supplier | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : null;
  const name = typeof o.name === 'string' ? o.name : null;
  const code = typeof o.code === 'string' ? o.code : null;
  if (!id || !name) return null;
  return { id, name, code };
}

/** The shop's suppliers (first page). An optional `search` matches a supplier's name (server-side). */
export async function fetchSuppliers(api: ApiClient, search?: string): Promise<Supplier[]> {
  const q = search && search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '';
  const response = await api.get<unknown>(`/api/v1/suppliers?size=100${q}`);
  const list = response && typeof response === 'object'
    ? ((response as { content?: unknown[] }).content ?? (Array.isArray(response) ? response : []))
    : [];
  return (list as unknown[]).map(readSupplier).filter((s): s is Supplier => s !== null);
}

/** Add a new supplier. Returns it so it can be linked at once. */
export async function createSupplier(api: ApiClient, name: string): Promise<Supplier> {
  const created = await api.post<unknown>('/api/v1/suppliers', { name }, { idempotent: true });
  const supplier = readSupplier(created);
  if (!supplier) throw new Error('The server did not return the new supplier.');
  return supplier;
}

/** Link a supplier to a product, so the shop knows who it buys this item from. Best-effort: the product is already made. */
export async function linkItemSupplier(api: ApiClient, itemId: string, supplierId: string): Promise<void> {
  await api.post(`/api/v1/items/${encodeURIComponent(itemId)}/supplier-links`, { supplierId }, { idempotent: true });
}

// ---- Supplies (receiving stock from a supplier — the "path-b" quick-supply flow) ---------------------

/** One of a supplier's products, with the costs and pack the shop last used, so a supply line starts pre-filled. */
export interface SupplierProduct {
  itemId: string;
  itemName: string;
  sku: string | null;
  barcode: string | null;
  thumbnailUrl: string | null;
  currentStock: number | null;
  /** What it cost last time / by default, in whole shillings. */
  defaultCost: number | null;
  /** What it sells at on the shelf, in whole shillings. */
  shelfPrice: number | null;
  packSize: number | null;
  packUnit: string | null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The products a supplier is linked to. These are what the cashier picks from when entering a supply. */
export async function fetchSupplierProducts(api: ApiClient, supplierId: string): Promise<SupplierProduct[]> {
  const raw = await api.get<unknown>(`/api/v1/suppliers/${encodeURIComponent(supplierId)}/item-links`);
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? ((raw as { content?: unknown[] }).content ?? []) : [];
  return (list as unknown[])
    .map((row): SupplierProduct | null => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const itemId = str(o.itemId);
      if (!itemId) return null;
      return {
        itemId,
        itemName: str(o.itemName) ?? 'Item',
        sku: str(o.sku),
        barcode: str(o.barcode),
        thumbnailUrl: str(o.thumbnailUrl),
        currentStock: num(o.currentStock),
        defaultCost: num(o.defaultCostPrice) ?? num(o.lastCostPrice) ?? num(o.catalogBuyingPrice),
        shelfPrice: num(o.catalogShelfPrice),
        packSize: num(o.packSize),
        packUnit: str(o.packUnit),
      };
    })
    .filter((p): p is SupplierProduct => p !== null);
}

/** Start a supply session for a supplier at this branch. Returns the session id the lines are added to. */
export async function startSupplySession(api: ApiClient, supplierId: string, branchId: string, notes?: string): Promise<string> {
  const body = { supplierId, branchId, receivedAt: new Date().toISOString(), ...(notes ? { notes } : {}) };
  const res = await api.post<{ id?: unknown }>('/api/v1/purchasing/path-b/sessions', body, { idempotent: true });
  const id = res && typeof res === 'object' ? str((res as { id?: unknown }).id) : null;
  if (!id) throw new Error('The server did not start the supply.');
  return id;
}

/** One product line to add to a supply session, in whole-shilling costs and whole units/packs. */
export interface SupplyLineInput {
  itemId: string;
  description: string;
  /** How many units received. */
  qty: number;
  /** Cost per unit, in shillings. */
  unitCost: number;
  /** New selling price per unit, in shillings. */
  sellPrice: number;
  expiryDate?: string;
  lotNumber?: string;
  /** Pack details, when received in packs rather than loose units. */
  purchaseQty?: number;
  purchaseUnit?: string;
  unitsPerPurchaseUnit?: number;
  packPrice?: number;
  /** How much of the received quantity is wastage (spoiled/short), subtracted from usable stock. */
  wastageQty?: number;
}

/** Add one product line to a supply session. Returns the new line id (needed to post). */
export async function addSupplyLine(api: ApiClient, sessionId: string, line: SupplyLineInput): Promise<string> {
  const body = {
    description: line.description,
    suggestedItemId: line.itemId,
    draftQty: line.qty,
    draftUnitCost: line.unitCost,
    draftSellPrice: line.sellPrice,
    amountMoney: Math.round(line.qty * line.unitCost * 100) / 100,
    ...(line.expiryDate ? { draftExpiryDate: line.expiryDate } : {}),
    ...(line.lotNumber ? { draftLotNumber: line.lotNumber } : {}),
    ...(line.purchaseQty !== undefined ? { purchaseQty: line.purchaseQty } : {}),
    ...(line.purchaseUnit ? { purchaseUnit: line.purchaseUnit } : {}),
    ...(line.unitsPerPurchaseUnit !== undefined ? { unitsPerPurchaseUnit: line.unitsPerPurchaseUnit } : {}),
    ...(line.packPrice !== undefined ? { packPrice: line.packPrice } : {}),
  };
  const res = await api.post<{ id?: unknown }>(
    `/api/v1/purchasing/path-b/sessions/${encodeURIComponent(sessionId)}/lines`,
    body,
    { idempotent: true }
  );
  const id = res && typeof res === 'object' ? str((res as { id?: unknown }).id) : null;
  if (!id) throw new Error('The server did not take the line.');
  return id;
}

/** The outcome of posting a supply: the invoice number and total the server worked out. */
export interface SupplyPosted {
  invoiceNumber: string | null;
  grandTotal: number | null;
  linesPosted: number | null;
}

/** Post (finalise) the supply. `breakdowns` pair each line id with its item, usable and wastage quantities. */
export async function postSupply(
  api: ApiClient,
  sessionId: string,
  breakdowns: { lineId: string; itemId: string; usableQty: number; wastageQty: number; expiryDate?: string; lotNumber?: string; purchaseQty?: number; purchaseUnit?: string; unitsPerPurchaseUnit?: number; packPrice?: number }[]
): Promise<SupplyPosted> {
  const res = await api.post<Record<string, unknown>>(
    `/api/v1/purchasing/path-b/sessions/${encodeURIComponent(sessionId)}/post`,
    { lines: breakdowns },
    { idempotent: true }
  );
  const o = res && typeof res === 'object' ? res : {};
  return {
    invoiceNumber: str(o.invoiceNumber),
    grandTotal: num(o.grandTotal),
    linesPosted: typeof o.linesPosted === 'number' ? o.linesPosted : null,
  };
}

/** Find a supplier by the barcode of a product they supply — for scanning straight into a supply. */
export async function findSupplierProductByBarcode(api: ApiClient, supplierId: string, barcode: string): Promise<SupplierProduct | null> {
  const products = await fetchSupplierProducts(api, supplierId);
  const code = barcode.replace(/[\s\-._]/g, '');
  return products.find((p) => (p.barcode ?? '').replace(/[\s\-._]/g, '') === code) ?? null;
}

/** Who this number belongs to. One implementation, shared with every staff app (see `@kiosk/core`). */
export const findCustomerByPhone = coreFindCustomerByPhone as (
  api: ApiClient,
  raw: string
) => Promise<CustomerMatch<PosCustomerHit> | null>;
