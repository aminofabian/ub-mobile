import { cleanDisplayText } from './display-text';
import type { ApiClient } from './create-api-client';
import { qtyToUnits } from './stock-qty';

/**
 * An item as the Stock and Grocery apps need it: a name to find it by, how much is on the shelf at one branch, and
 * what it costs and sells for. Read defensively from `GET /api/v1/items`: a row that is not an item is left out, and a
 * number that is missing is "unknown", never zero. An unknown on-hand must never be turned into "0", because the next
 * thing the app does with it is work out how much to add.
 */
export type StockItem = {
  id: string;
  name: string;
  variantName: string | null;
  sku: string | null;
  barcode: string | null;
  /** On hand at the branch that was asked for, in ten-thousandths. Null when the server did not say (no branch was given). */
  onHandUnits: number | null;
  weighed: boolean;
  unitType: string | null;
  /** A pack of another item. Its stock is held on the parent item and cannot be changed here. */
  packageVariant: boolean;
  active: boolean;
  sellable: boolean;
  /** The department (item type) this product is filed under, when the shop files them. */
  itemTypeId: string | null;
  buyingCents: number | null;
  sellingCents: number | null;
  /** An https thumbnail, when the catalogue has one. A storage key with no host is left out. */
  imageUrl: string | null;
};

const MAX_ID_LENGTH = 64;
const PRICE_TEXT = /^\d{1,9}(?:\.\d{1,8})?$/;
/** A price above this many cents is bad data (ten million shillings). */
const MAX_PRICE_CENTS = 1_000_000_000;

/**
 * A price as the server sent it (a number, or a number in text) in whole cents, rounding half up. Null when it is not
 * a price: missing, negative, not a number, or absurdly large. Read from the decimal digits, not by multiplying a
 * floating-point number, so 1.005 is 101 cents and not 100.
 */
export function priceToCents(value: unknown): number | null {
  let text: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value > 9_999_999) return null;
    text = value.toFixed(6);
  } else if (typeof value === 'string') {
    text = value.trim();
  } else {
    return null;
  }
  if (!PRICE_TEXT.test(text)) return null;
  const [whole = '0', fraction = ''] = text.split('.');
  const digits = fraction.padEnd(3, '0');
  let cents = Number(whole) * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) cents += 1;
  return cents <= MAX_PRICE_CENTS ? cents : null;
}

function text(raw: unknown, max: number): string | null {
  const cleaned = cleanDisplayText(raw, max);
  return cleaned ? cleaned : null;
}

function webAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/**
 * A catalogue photo the phone can fetch. Only an http(s) address counts; a bare storage key has no host.
 * The list thumbnail wins, then a URL stored as the image key, then the first gallery photo.
 */
function imageUrlOf(row: Record<string, unknown>): string | null {
  const thumb = webAddress(row.thumbnailUrl);
  if (thumb) return thumb;
  const key = webAddress(row.imageKey);
  if (key) return key;
  if (!Array.isArray(row.images)) return null;
  for (const image of row.images) {
    if (!image || typeof image !== 'object') continue;
    const photo = image as Record<string, unknown>;
    const url = webAddress(photo.secureUrl) ?? webAddress(photo.url) ?? webAddress(photo.s3Key);
    if (url) return url;
  }
  return null;
}

/** One row of `GET /api/v1/items`. Null for anything that is not an item with an id and a name, and for a heading that only groups others. */
export function readStockItem(raw: unknown): StockItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row.groupLabelOnly === true) return null;
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  const name = text(row.name, 120);
  if (!id || id.length > MAX_ID_LENGTH || !name) return null;
  return {
    id,
    name,
    variantName: text(row.variantName, 80),
    sku: text(row.sku, 64),
    barcode: text(row.barcode, 64),
    onHandUnits: row.stockQty === undefined || row.stockQty === null ? null : qtyToUnits(row.stockQty),
    weighed: row.isWeighed === true,
    unitType: text(row.unitType, 24),
    packageVariant: row.packageVariant === true,
    itemTypeId: typeof row.itemTypeId === 'string' && row.itemTypeId.trim() ? row.itemTypeId.trim() : null,
    active: row.active !== false,
    sellable: row.isSellable !== false,
    buyingCents: priceToCents(row.buyingPrice),
    sellingCents: priceToCents(row.sellingPrice),
    imageUrl: imageUrlOf(row),
  };
}

/** "Milk" or "Milk (1 litre)": what to call the item on a screen. */
export function itemLabel(item: { name: string; variantName: string | null }): string {
  return item.variantName ? `${item.name} (${item.variantName})` : item.name;
}

export type ItemsPage = {
  items: StockItem[];
  /** Rows the server sent, before any were left out. Page by this, not by `items.length`. */
  seen: number;
  total: number | null;
  more: boolean;
};

function whole(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * A page of items. The server's page is a Spring page: `content` and the counts either beside it or inside a `page`
 * object, depending on the version. Null when the answer is not a page, which is a failed read, not an empty list.
 */
export function readItemsPage(raw: unknown, asked: { page: number; size: number }): ItemsPage | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.content)) return null;
  const nested = body.page && typeof body.page === 'object' ? (body.page as Record<string, unknown>) : {};
  const total = whole(body.totalElements) ?? whole(nested.totalElements);
  const rows = body.content as unknown[];
  const items: StockItem[] = [];
  for (const row of rows) {
    const item = readStockItem(row);
    if (item) items.push(item);
  }
  let more: boolean;
  if (typeof body.last === 'boolean') {
    more = !body.last;
  } else if (total !== null) {
    more = (asked.page + 1) * asked.size < total;
  } else {
    more = rows.length >= asked.size && rows.length > 0;
  }
  return { items, seen: rows.length, total, more };
}

export type ItemsQuery = {
  branchId: string;
  search?: string;
  barcode?: string;
  /** Only items in this category. The server does the narrowing. */
  categoryId?: string;
  /** Only items of this department (an item type). The server does the narrowing. */
  itemTypeId?: string;
  lowStock?: boolean;
  zeroStock?: boolean;
  page?: number;
  size?: number;
};

export const ITEM_PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 80;

/** What was typed in a search box: a barcode (only digits, six to fourteen of them) or words to search names and codes for. */
export function searchTerms(typed: string): { barcode: string } | { search: string } | null {
  const cleaned = cleanDisplayText(typed, MAX_SEARCH_LENGTH);
  if (!cleaned) return null;
  return /^\d{6,14}$/.test(cleaned) ? { barcode: cleaned } : { search: cleaned };
}

/** The path to read one page of items for a branch. Only what is set goes in, and every value is encoded. */
export function itemsPath(query: ItemsQuery): string {
  const parts: string[] = [`branchId=${encodeURIComponent(query.branchId)}`];
  const search = query.search ? cleanDisplayText(query.search, MAX_SEARCH_LENGTH) : '';
  if (search) parts.push(`search=${encodeURIComponent(search)}`);
  const barcode = query.barcode ? cleanDisplayText(query.barcode, 64) : '';
  if (barcode) parts.push(`barcode=${encodeURIComponent(barcode)}`);
  if (query.categoryId) parts.push(`categoryId=${encodeURIComponent(query.categoryId)}`);
  if (query.itemTypeId) parts.push(`itemTypeId=${encodeURIComponent(query.itemTypeId)}`);
  if (query.lowStock) parts.push('lowStock=true');
  if (query.zeroStock) parts.push('zeroStock=true');
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.size ?? ITEM_PAGE_SIZE)));
  const page = Math.max(0, Math.floor(query.page ?? 0));
  parts.push(`size=${size}`, `page=${page}`);
  return `/api/v1/items?${parts.join('&')}`;
}


/**
 * The shop's departments, as the till calls them: the categories its products are filed under.
 *
 * Read once and kept by the screen that shows the rail. A shop with none gets an empty list, and a failure says so by
 * throwing, so a rail can be absent rather than wrong.
 */
export type CategoryOption = { id: string; name: string };

export function readCategories(raw: unknown): CategoryOption[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { content?: unknown[] }).content)
      ? ((raw as { content: unknown[] }).content)
      : [];
  const seen = new Set<string>();
  const out: CategoryOption[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: name.slice(0, 60) });
  }
  return out;
}

export async function fetchCategories(api: ApiClient): Promise<CategoryOption[]> {
  return readCategories(await api.get<unknown>('/api/v1/categories'));
}


/**
 * A department: an item type, as the web counter calls them. Its colour and icon are the shop's own, so a department
 * looks the same on the counter as it does on the till and in the portal.
 */
export type DepartmentOption = { id: string; label: string; color: string | null; sortOrder: number };

export function readDepartments(raw: unknown): DepartmentOption[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: DepartmentOption[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    const label = typeof row.label === 'string' ? row.label.trim() : typeof row.name === 'string' ? row.name.trim() : '';
    if (!id || !label || row.active === false) continue;
    const color = typeof row.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(row.color.trim()) ? row.color.trim() : null;
    const sortOrder = typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder) ? row.sortOrder : 0;
    out.push({ id, label: label.slice(0, 60), color, sortOrder });
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function fetchDepartments(api: ApiClient): Promise<DepartmentOption[]> {
  return readDepartments(await api.get<unknown>('/api/v1/item-types'));
}


/**
 * Marks a product as sold by weight, or stops treating it that way.
 *
 * The counter's worry is always the same: a kilo-priced product was scanned like a packet, or a packet was weighed like
 * a kilo. Fixing it here saves a trip to the back office, and the server answers with the flag it now holds, so the
 * screen can believe what it shows.
 */
export type WeighToggle = { ok: true } | { ok: false; words: string };

export async function setItemWeighed(api: ApiClient, itemId: string, weighed: boolean): Promise<WeighToggle> {
  const id = itemId.trim();
  if (!id) return { ok: false, words: 'That item has no id, so the server cannot be asked.' };
  try {
    const answer = await api.put<unknown>(`/api/v1/pos/items/${encodeURIComponent(id)}/weighed`, { weighed });
    // The server answers with the item it now holds. Trust it when it says, and accept a 2xx that does not carry the
    // flag rather than calling a change that happened a failure.
    const held = answer && typeof answer === 'object' ? (answer as { isWeighed?: unknown }).isWeighed : undefined;
    if (held === undefined) return { ok: true };
    return held === weighed ? { ok: true } : { ok: false, words: 'The server kept the old setting.' };
  } catch (error) {
    // What the server said is more useful than "it failed": a refused role, a switched-off flag, a missing item.
    const words = error instanceof Error && error.message ? error.message : 'Could not reach the server.';
    return { ok: false, words };
  }
}
