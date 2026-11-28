import {
  allocationPreviewPath,
  READ_TIMEOUT_MS,
  readItemHistory,
  readStockItem,
  WRITE_TIMEOUT_MS,
  withTimeout,
  type ApiClient,
  type DecreaseCall,
  type ItemHistory,
  type StockItem,
} from '@kiosk/core';

/**
 * The server calls that read an item and change its stock, each with a limit on how long the app waits. A change is
 * sent once. Its answer may be lost, and the screens then look at the item before doing anything else: the server does
 * not read an Idempotency-Key on these routes, so a repeat would be applied twice.
 */

/** One item as it is now at this branch. Null when the answer is not an item. Throws when the server cannot be reached. */
export async function fetchFreshItem(api: ApiClient, branchId: string, itemId: string): Promise<StockItem | null> {
  const raw = await withTimeout(api.get<unknown>(`/api/v1/items/${encodeURIComponent(itemId)}?branchId=${encodeURIComponent(branchId)}`), READ_TIMEOUT_MS);
  return readStockItem(raw);
}

/** The most entries the server's item history gives (it cuts any larger ask down to this). */
export const HISTORY_LIMIT = 100;

/** An item's recent stock history, and how far back it reaches. Null when the answer is not a history. Throws when the server cannot be reached. */
export async function fetchHistory(api: ApiClient, itemId: string, limit = HISTORY_LIMIT): Promise<ItemHistory | null> {
  const raw = await withTimeout(api.get<unknown>(`/api/v1/items/${encodeURIComponent(itemId)}/timeline?limit=${limit}`), READ_TIMEOUT_MS);
  return readItemHistory(raw, limit);
}

export function postStockIncrease(api: ApiClient, body: unknown): Promise<unknown> {
  return withTimeout(api.post<unknown>('/api/v1/inventory/stock-increase', body), WRITE_TIMEOUT_MS);
}

export function fetchAllocation(api: ApiClient, itemId: string, branchId: string, units: number): Promise<unknown> {
  return withTimeout(api.get<unknown>(allocationPreviewPath(itemId, branchId, units)), READ_TIMEOUT_MS);
}

export function postBatchDecrease(api: ApiClient, body: unknown): Promise<unknown> {
  return withTimeout(api.post<unknown>('/api/v1/inventory/batch-decrease', body), WRITE_TIMEOUT_MS);
}

export function postWastage(api: ApiClient, body: unknown): Promise<unknown> {
  return withTimeout(api.post<unknown>('/api/v1/inventory/wastage', body), WRITE_TIMEOUT_MS);
}

export type { DecreaseCall };
