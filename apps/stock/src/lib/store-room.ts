import { isApiError, readFailureWords } from '@kiosk/core';

/**
 * The store room as the phone shows it. Counts and permissions are decided here so a screen only renders the answer.
 * The server stays the authority: a button this hides would be refused, and a write whose answer was lost is never
 * sent again until a person says so.
 */

export type StoreMode = 'standalone' | 'connected' | null;

export type StoreDirection = 'in' | 'out';

export type StoreReasonId =
  | 'restock_to_shelf'
  | 'kitchen_prep'
  | 'counter_transfer'
  | 'spoilage'
  | 'expired'
  | 'breakage'
  | 'customer_return'
  | 'theft'
  | 'staff_use'
  | 'count_correction'
  | 'other'
  | 'received_into_room';

export type StoreReason = {
  id: StoreReasonId;
  direction: StoreDirection;
  label: string;
  hint: string;
  /** True when this reason changes the count the till sells from. */
  changesStock: boolean;
};

/** The reasons a person can record by hand. Inherit (`from_purchase_order`) is not one of them. */
export const STORE_REASONS: readonly StoreReason[] = [
  { id: 'restock_to_shelf', direction: 'out', label: 'Restocked the shelf', hint: 'Still yours — it just moved to the front.', changesStock: false },
  { id: 'kitchen_prep', direction: 'out', label: 'Kitchen / prep', hint: 'Used to make something you will sell.', changesStock: false },
  { id: 'counter_transfer', direction: 'out', label: 'Moved to another counter', hint: 'Still yours — just not in the back room now.', changesStock: false },
  { id: 'spoilage', direction: 'out', label: 'Spoilage', hint: 'Written off, oldest stock first.', changesStock: true },
  { id: 'expired', direction: 'out', label: 'Expired', hint: 'Written off, oldest stock first.', changesStock: true },
  { id: 'breakage', direction: 'out', label: 'Breakage / damage', hint: 'Written off, oldest stock first.', changesStock: true },
  { id: 'customer_return', direction: 'out', label: 'Customer return', hint: 'Came back and is not fit to sell.', changesStock: true },
  { id: 'theft', direction: 'out', label: 'Theft', hint: 'Removed from stock.', changesStock: true },
  { id: 'staff_use', direction: 'out', label: 'Staff use', hint: 'Removed from stock.', changesStock: true },
  { id: 'count_correction', direction: 'out', label: 'Count correction', hint: 'Stock turned out to be less than the count said.', changesStock: true },
  { id: 'other', direction: 'out', label: 'Something else', hint: 'Add a note so it still makes sense next month.', changesStock: true },
  { id: 'received_into_room', direction: 'in', label: 'Back into the store room', hint: 'Adds to on-hand for this product.', changesStock: true },
];

export type StoreRow = {
  id: string;
  name: string;
  barcode: string | null;
  itemId: string | null;
  quantity: number;
  /** Live on-hand. Null when the row is not linked, or the server did not say. Never treated as zero. */
  inventoryQuantity: number | null;
  inventoryItemName: string | null;
  expiryDate: string | null;
  buyingPrice: number | null;
};

export type StoreSettings = {
  mode: StoreMode;
  requireSeparateApprover: boolean;
};

export type StoreMovement = {
  id: string;
  storeItemId: string | null;
  storeItemName: string | null;
  direction: StoreDirection;
  reason: string;
  stockEffect: 'none' | 'decrease' | 'increase';
  status: 'applied' | 'pending' | 'rejected';
  quantity: number;
  note: string | null;
  createdAt: number;
  createdBy: string | null;
  createdByName: string | null;
};

export function reasonsFor(direction: StoreDirection): StoreReason[] {
  return STORE_REASONS.filter((reason) => reason.direction === direction);
}

export function reasonById(id: string): StoreReason | null {
  return STORE_REASONS.find((reason) => reason.id === id) ?? null;
}

/** What the button says before a movement is sent, so a loss is not mistaken for a move to the shelf. */
export function effectWords(reason: StoreReason): string {
  if (!reason.changesStock) return 'The till does not change';
  return reason.direction === 'in' ? 'Adds to on-hand' : 'Writes this off';
}

export function reasonLabel(id: string): string {
  return reasonById(id)?.label ?? id.replace(/_/g, ' ');
}

/**
 * The number the list shows. A connected, linked row follows the till, and a missing live count stays unknown.
 * Anything else shows the register's own count.
 */
export function shownCount(row: StoreRow, mode: StoreMode): { text: string; followsShelf: boolean } {
  const followsShelf = mode === 'connected' && row.itemId != null;
  if (followsShelf) {
    return { text: row.inventoryQuantity == null ? '—' : formatCount(row.inventoryQuantity), followsShelf: true };
  }
  return { text: formatCount(row.quantity), followsShelf: false };
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10000) / 10000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/** A back-room-only row is whole units. A linked row may be a fraction, because the ledger is. */
export function wholeUnitsOnly(row: StoreRow): boolean {
  return row.itemId == null;
}

/** The quantity a person typed, or null when it is empty, zero, negative, or not a number. */
export function parseMoveQty(raw: string, wholeOnly: boolean): number | null {
  const text = raw.trim().replace(/,/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (wholeOnly && !Number.isInteger(value)) return null;
  return value;
}

export function canWriteMovement(input: {
  mode: StoreMode;
  linked: boolean;
  changesStock: boolean;
  inventory: boolean;
  catalog: boolean;
}): boolean {
  if (input.mode == null) return false;
  if (input.changesStock && input.linked) return input.inventory;
  return input.inventory || input.catalog;
}

/** Approving moves stock. Rejecting your own is allowed: it moves nothing. */
export function mayDecide(input: {
  approve: boolean;
  inventory: boolean;
  separate: boolean;
  createdBy: string | null;
  userId: string;
}): boolean {
  if (!input.inventory) return false;
  if (input.approve && input.separate && input.createdBy != null && input.createdBy === input.userId) return false;
  return true;
}

export type PackFact = { unit: string; each: number };

/**
 * How a linked package is counted. The list's number and a typed quantity are both in this unit; the server multiplies
 * by `each` before the ledger. Null when the product is not a pack, or the answer did not say.
 */
export function readPack(body: unknown): PackFact | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (record.packageVariant !== true) return null;
  const each = readNumber(record.packagingUnitQty);
  if (each == null || each <= 1) return null;
  const named = typeof record.packagingUnitName === 'string' ? record.packagingUnitName.trim() : '';
  return { unit: named || 'packs', each };
}

/** What a typed count becomes on the shelf, so a pack is not mistaken for a single piece. */
export function packWords(pack: PackFact, typed: number | null): string {
  const one = `One ${pack.unit} is ${formatCount(pack.each)} on the shelf.`;
  if (typed == null) return `Counted in ${pack.unit}. ${one}`;
  return `${formatCount(typed)} ${pack.unit} counts as ${formatCount(typed * pack.each)} on the shelf.`;
}

export function matchesQuery(row: StoreRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [row.name, row.barcode ?? '', row.inventoryItemName ?? ''].join(' ').toLowerCase().includes(needle);
}

export function rowByBarcode(rows: readonly StoreRow[], barcode: string): StoreRow | null {
  const needle = barcode.trim().toLowerCase();
  if (!needle) return null;
  return rows.find((row) => (row.barcode ?? '').trim().toLowerCase() === needle) ?? null;
}

/** A catalogue product already on the register, by its id or by the barcode it would be filed under. */
export function rowForProduct(rows: readonly StoreRow[], product: { id: string; barcode: string | null }): StoreRow | null {
  const byId = rows.find((row) => row.itemId === product.id);
  if (byId) return byId;
  if (!product.barcode) return null;
  return rowByBarcode(rows, product.barcode);
}

/** Midnight on this phone through `now`, as instants the activity route accepts. */
export function todayWindow(now: number): { from: string; to: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { from: start.toISOString(), to: new Date(now).toISOString() };
}

const ECHO_SKEW_MS = 5_000;
const ECHO_WINDOW_MS = 120_000;

/**
 * A movement that looks like the one whose answer never came back. Same row, reason, quantity and person, in the two
 * minutes after it was sent. The first such row. This is a judgement: an equal movement by the same person in that
 * window is taken for this one.
 */
export function findEcho(
  movements: readonly StoreMovement[],
  sought: { storeItemId: string; reason: string; quantity: number; actorId: string; sentAt: number }
): StoreMovement | null {
  const hits = movements.filter(
    (row) =>
      row.storeItemId === sought.storeItemId &&
      row.reason === sought.reason &&
      sameQty(row.quantity, sought.quantity) &&
      row.createdBy === sought.actorId &&
      row.createdAt >= sought.sentAt - ECHO_SKEW_MS &&
      row.createdAt <= sought.sentAt + ECHO_WINDOW_MS
  );
  hits.sort((a, b) => a.createdAt - b.createdAt);
  return hits[0] ?? null;
}

function sameQty(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.00005;
}

export type WriteOutcome =
  | { kind: 'lost' }
  | { kind: 'refused'; words: string };

/**
 * A movement write that failed. No answer, a foreign page, or a 5xx means the phone cannot know whether it landed,
 * so it must not be sent again by itself. A refusal the server explained is shown in the server's words.
 */
export function writeOutcome(error: unknown): WriteOutcome {
  if (!isApiError(error) || error.foreign || error.status === 408 || error.status === 429 || error.status >= 500) {
    return { kind: 'lost' };
  }
  if (error.status === 401 || error.status === 403) {
    return { kind: 'refused', words: readFailureWords(error) };
  }
  const words = error.message.trim().slice(0, 200);
  return { kind: 'refused', words: words || 'The server turned this down.' };
}

export function readSettings(body: unknown): StoreSettings | null {
  if (!body || typeof body !== 'object') return null;
  const mode = (body as { mode?: unknown }).mode;
  const separate = (body as { requireSeparateApprover?: unknown }).requireSeparateApprover;
  return {
    mode: mode === 'standalone' || mode === 'connected' ? mode : null,
    requireSeparateApprover: separate === true,
  };
}

export function readRows(body: unknown): StoreRow[] | null {
  if (!Array.isArray(body)) return null;
  const rows: StoreRow[] = [];
  for (const entry of body) {
    const row = readRow(entry);
    if (row) rows.push(row);
  }
  return rows;
}

export function readRow(body: unknown): StoreRow | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record.id !== 'string' || !record.id.trim()) return null;
  if (typeof record.name !== 'string' || !record.name.trim()) return null;
  const quantity = readNumber(record.quantity);
  if (quantity == null) return null;
  return {
    id: record.id,
    name: record.name.trim(),
    barcode: typeof record.barcode === 'string' && record.barcode.trim() ? record.barcode.trim() : null,
    itemId: typeof record.itemId === 'string' && record.itemId.trim() ? record.itemId : null,
    quantity,
    inventoryQuantity: record.inventoryQuantity == null ? null : readNumber(record.inventoryQuantity),
    inventoryItemName: typeof record.inventoryItemName === 'string' && record.inventoryItemName.trim() ? record.inventoryItemName.trim() : null,
    expiryDate: typeof record.expiryDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(record.expiryDate) ? record.expiryDate.slice(0, 10) : null,
    buyingPrice: record.buyingPrice == null ? null : readNumber(record.buyingPrice),
  };
}

export function readActivity(body: unknown): StoreMovement[] | null {
  if (!body || typeof body !== 'object') return null;
  const movements = (body as { movements?: unknown }).movements;
  if (!Array.isArray(movements)) return null;
  const rows: StoreMovement[] = [];
  for (const entry of movements) {
    const row = readMovement(entry);
    if (row) rows.push(row);
  }
  return rows;
}

export function readMovement(body: unknown): StoreMovement | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record.id !== 'string' || !record.id) return null;
  if (record.direction !== 'in' && record.direction !== 'out') return null;
  if (record.stockEffect !== 'none' && record.stockEffect !== 'decrease' && record.stockEffect !== 'increase') return null;
  if (record.status !== 'applied' && record.status !== 'pending' && record.status !== 'rejected') return null;
  const quantity = readNumber(record.quantity);
  const createdAt = typeof record.createdAt === 'string' ? Date.parse(record.createdAt) : NaN;
  if (quantity == null || !Number.isFinite(createdAt)) return null;
  return {
    id: record.id,
    storeItemId: typeof record.storeItemId === 'string' ? record.storeItemId : null,
    storeItemName: typeof record.storeItemName === 'string' ? record.storeItemName : null,
    direction: record.direction,
    reason: typeof record.reason === 'string' ? record.reason : '',
    stockEffect: record.stockEffect,
    status: record.status,
    quantity,
    note: typeof record.note === 'string' && record.note.trim() ? record.note.trim() : null,
    createdAt,
    createdBy: typeof record.createdBy === 'string' ? record.createdBy : null,
    createdByName: typeof record.createdByName === 'string' && record.createdByName.trim() ? record.createdByName.trim() : null,
  };
}

function readNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
