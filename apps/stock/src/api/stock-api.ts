import type { ApiClient } from '@kiosk/core';

export interface StockItem {
  id: string;
  name: string;
  barcode?: string;
  stockOnHand?: number;
  lowStock?: boolean;
}

export interface SupplyBatch {
  id: string;
  batchNumber?: string;
  expiryDate?: string;
  remainingQty?: number;
  cost?: number;
}

export interface StockTakeSession {
  id: string;
  status?: string;
  branchId?: string;
}

export async function fetchLowStockItems(api: ApiClient): Promise<StockItem[]> {
  const response = await api.get<{ items?: StockItem[] } | StockItem[]>(
    '/api/v1/items?lowStock=true&outOfStock=true'
  );
  return Array.isArray(response) ? response : (response.items ?? []);
}

export async function fetchInventoryValuation(api: ApiClient): Promise<{ totalValue?: number }> {
  return api.get('/api/v1/inventory/valuation');
}

export async function fetchSupplyBatches(api: ApiClient): Promise<SupplyBatch[]> {
  const response = await api.get<{ batches?: SupplyBatch[] } | SupplyBatch[]>(
    '/api/v1/inventory/supply-batches'
  );
  return Array.isArray(response) ? response : (response.batches ?? []);
}

export async function fetchActiveStockTake(api: ApiClient): Promise<StockTakeSession | null> {
  try {
    return await api.get<StockTakeSession>('/api/v1/inventory/stock-take/sessions/active');
  } catch {
    return null;
  }
}

export async function startStockTake(
  api: ApiClient,
  branchId: string
): Promise<StockTakeSession> {
  return api.post<StockTakeSession>(
    '/api/v1/inventory/stock-take/sessions',
    { branchId },
    { idempotent: true }
  );
}

export async function applyCount(
  api: ApiClient,
  sessionId: string,
  lines: { itemId: string; countedQty: number }[]
): Promise<void> {
  await api.patch(`/api/v1/inventory/stock-take/sessions/${sessionId}/lines`, { lines });
}

export async function closeStockTake(api: ApiClient, sessionId: string): Promise<void> {
  await api.post(`/api/v1/inventory/stock-take/sessions/${sessionId}/close`, {}, { idempotent: true });
}

export async function createTransfer(
  api: ApiClient,
  body: {
    sourceBranchId: string;
    destinationBranchId: string;
    lines: { itemId: string; quantity: number }[];
  }
): Promise<unknown> {
  return api.post('/api/v1/inventory/transfers', body, { idempotent: true });
}

export async function searchItems(api: ApiClient, barcode: string): Promise<StockItem[]> {
  const response = await api.get<{ items?: StockItem[] } | StockItem[]>(
    `/api/v1/items?barcode=${encodeURIComponent(barcode)}`
  );
  return Array.isArray(response) ? response : (response.items ?? []);
}
