import { cleanDisplayText, priceToCents, qtyToUnits, type SpoilReason } from '@kiosk/core';
import { daysBetween, readDate } from './dates';

/**
 * Supply batches: what came in from a supplier in one delivery, and how much of it is left. Read-mostly. The one thing
 * a phone does to a batch is clear what is left of it (a write-off of the lot), which the server does in one step.
 */

export type SupplyStatus = 'active' | 'soldout' | 'clearing' | 'closed' | 'unknown';

/** Where a batch came from. "Stock gain" is a count that found more than the system held — not a delivery. */
export type BatchSource = 'delivery' | 'stock-gain' | 'opening' | 'transfer' | 'other';

export type SupplyBatch = {
  id: string;
  source: BatchSource;
  number: string;
  name: string;
  supplier: string;
  receivedAt: number | null;
  status: SupplyStatus;
  itemCount: number;
  itemNames: string[];
  initialUnits: number | null;
  remainingUnits: number | null;
  soldPercent: number | null;
  costCents: number | null;
};

function idOf(value: unknown): string {
  if (typeof value !== 'string') return '';
  const id = value.trim();
  return id.length > 0 && id.length <= 64 ? id : '';
}

function statusOf(value: unknown): SupplyStatus {
  return value === 'active' || value === 'soldout' || value === 'clearing' || value === 'closed' ? value : 'unknown';
}

/** The server names the source; the screen only needs to know whether a supplier sent it. */
function sourceOf(value: unknown): BatchSource {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (key.includes('grn') || key.includes('path_a') || key.includes('path_b')) return 'delivery';
  if (key.includes('gain')) return 'stock-gain';
  if (key.includes('opening')) return 'opening';
  if (key.includes('transfer')) return 'transfer';
  return 'other';
}

function readBatch(raw: unknown): SupplyBatch | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = idOf(row.id);
  if (!id) return null;
  const received = typeof row.receivedAt === 'string' ? Date.parse(row.receivedAt) : NaN;
  const names = Array.isArray(row.itemNames) ? row.itemNames.map((name) => cleanDisplayText(name, 80)).filter(Boolean).slice(0, 5) : [];
  const percent = typeof row.soldPercentage === 'number' && Number.isFinite(row.soldPercentage) ? Math.min(100, Math.max(0, Math.round(row.soldPercentage))) : null;
  const count = typeof row.itemCount === 'number' && Number.isInteger(row.itemCount) && row.itemCount >= 0 ? row.itemCount : names.length;
  return {
    id,
    source: sourceOf(row.sourceType),
    number: cleanDisplayText(row.batchNumber, 40),
    name: cleanDisplayText(row.batchName, 80),
    supplier: cleanDisplayText(row.supplierName, 80),
    receivedAt: Number.isFinite(received) ? received : null,
    status: statusOf(row.status),
    itemCount: count,
    itemNames: names,
    initialUnits: qtyToUnits(row.totalInitialQuantity),
    remainingUnits: qtyToUnits(row.totalRemainingQuantity),
    soldPercent: percent,
    costCents: priceToCents(row.totalCost),
  };
}

/** The list of batches. Null when the answer is not a list: a failed read, not "no batches". */
export function readSupplyBatches(raw: unknown): SupplyBatch[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SupplyBatch[] = [];
  for (const row of raw) {
    const batch = readBatch(row);
    if (batch) out.push(batch);
  }
  return out;
}

export type SupplyItem = {
  /** The shelf batch (the lot) this line is. */
  id: string;
  itemId: string;
  name: string;
  sku: string | null;
  lot: string;
  initialUnits: number | null;
  remainingUnits: number | null;
  soldUnits: number | null;
  wastedUnits: number | null;
  unitCostCents: number | null;
  /** yyyy-mm-dd, or null when the lot has no expiry date. */
  expiry: string | null;
};

export type SupplyDetail = SupplyBatch & { items: SupplyItem[] };

function readItem(raw: unknown): SupplyItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = idOf(row.inventoryBatchId);
  const name = cleanDisplayText(row.itemName, 120);
  if (!id || !name) return null;
  return {
    id,
    itemId: idOf(row.itemId),
    name,
    sku: cleanDisplayText(row.itemSku, 64) || null,
    lot: cleanDisplayText(row.batchNumber, 40),
    initialUnits: qtyToUnits(row.initialQuantity),
    remainingUnits: qtyToUnits(row.quantityRemaining),
    soldUnits: qtyToUnits(row.quantitySold),
    wastedUnits: qtyToUnits(row.quantityWasted),
    unitCostCents: priceToCents(row.unitCost),
    expiry: readDate(row.expiryDate) || null,
  };
}

/** One batch with its lots. Null when the answer is not one. */
export function readSupplyDetail(raw: unknown): SupplyDetail | null {
  const batch = readBatch(raw);
  if (!batch || !raw || typeof raw !== 'object') return null;
  const rows = (raw as Record<string, unknown>).items;
  if (!Array.isArray(rows)) return null;
  const items: SupplyItem[] = [];
  for (const row of rows) {
    const item = readItem(row);
    if (item) items.push(item);
  }
  return { ...batch, items };
}

export type ExpiryState = 'none' | 'expired' | 'soon' | 'ok';

/** The days ahead a lot counts as "expiring soon". */
export const EXPIRES_SOON_DAYS = 7;

/** Where a lot stands against today's date. A lot with nothing left does not worry anyone. */
export function expiryState(item: Pick<SupplyItem, 'expiry' | 'remainingUnits'>, today: string): ExpiryState {
  if (!item.expiry || item.remainingUnits === null || item.remainingUnits <= 0) return 'none';
  const days = daysBetween(today, item.expiry);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  return days <= EXPIRES_SOON_DAYS ? 'soon' : 'ok';
}

export function expiryWords(item: Pick<SupplyItem, 'expiry' | 'remainingUnits'>, today: string): string {
  const state = expiryState(item, today);
  if (state === 'none' || !item.expiry) return '';
  const days = daysBetween(today, item.expiry) ?? 0;
  if (state === 'expired') return days === -1 ? 'Expired yesterday' : `Expired ${-days} days ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `Expires in ${days} days`;
}

export function statusWords(status: SupplyStatus): string {
  switch (status) {
    case 'active':
      return 'In stock';
    case 'soldout':
      return 'Sold out';
    case 'clearing':
      return 'Being cleared';
    case 'closed':
      return 'Closed';
    default:
      return 'Unknown';
  }
}

export function supplyListPath(filters: { branchId?: string; status?: SupplyStatus }): string {
  const parts: string[] = [];
  if (filters.branchId) parts.push(`branchId=${encodeURIComponent(filters.branchId)}`);
  if (filters.status && filters.status !== 'unknown') parts.push(`status=${encodeURIComponent(filters.status)}`);
  return `/api/v1/inventory/supply-batches${parts.length ? `?${parts.join('&')}` : ''}`;
}

export function supplyDetailPath(id: string): string {
  return `/api/v1/inventory/supply-batches/${encodeURIComponent(id)}`;
}

export function clearPath(id: string): string {
  return `${supplyDetailPath(id)}/clear`;
}

/** Only a batch that still has stock in it can be cleared, and only by someone who may write stock. */
export function canClear(batch: Pick<SupplyBatch, 'status' | 'remainingUnits'>, mayWrite: boolean): boolean {
  return mayWrite && batch.status === 'active' && batch.remainingUnits !== null && batch.remainingUnits > 0;
}

/** The body of `POST .../clear`. The reason is one of the server's write-off categories. */
export function clearBody(reason: SpoilReason, note?: string): { reason: SpoilReason; notes?: string } {
  const notes = cleanDisplayText(note, 200);
  return notes ? { reason, notes } : { reason };
}

/** After a clear with no clear answer, whether it happened, read from the batch as it is now. */
export function didClearHappen(now: Pick<SupplyBatch, 'status'> | undefined): 'done' | 'not_done' | 'unclear' {
  if (!now) return 'unclear';
  if (now.status === 'clearing' || now.status === 'closed') return 'done';
  return now.status === 'active' ? 'not_done' : 'unclear';
}

/** What a batch is called on a screen: its own name, else its number, else its supplier. */
/** "Delivery · DEL-123", "Stock gain", "Opening stock" — the row's own name, without a supplier's. */
export function sourceWords(batch: SupplyBatch): string {
  if (batch.source === 'delivery') return batch.supplier ? batch.supplier : 'A supplier';
  if (batch.source === 'stock-gain') return 'Count found more';
  if (batch.source === 'opening') return 'Opening stock';
  if (batch.source === 'transfer') return 'Moved between branches';
  return 'Not from a supplier';
}

export function batchTitle(batch: Pick<SupplyBatch, 'name' | 'number' | 'supplier'>): string {
  return batch.name || (batch.number ? `Batch ${batch.number}` : batch.supplier || 'Delivery');
}
