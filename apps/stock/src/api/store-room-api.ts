import type { ApiClient } from '@kiosk/core';
import {
  readActivity,
  readMovement,
  readRows,
  readSettings,
  type StoreDirection,
  type StoreMovement,
  type StoreReasonId,
  type StoreRow,
  type StoreSettings,
} from '../lib/store-room';

function branchQuery(branchId: string): string {
  const id = branchId.trim();
  return id ? `?branchId=${encodeURIComponent(id)}` : '';
}

export async function fetchStoreSettings(api: ApiClient): Promise<StoreSettings | null> {
  return readSettings(await api.get<unknown>('/api/v1/store-items/settings'));
}

export async function fetchStoreRows(api: ApiClient, branchId: string): Promise<StoreRow[] | null> {
  return readRows(await api.get<unknown>(`/api/v1/store-items${branchQuery(branchId)}`));
}

export async function createStoreRow(
  api: ApiClient,
  branchId: string,
  body: { name: string; barcode: string | null; itemId: string }
): Promise<StoreRow | null> {
  const created = await api.post<unknown>(`/api/v1/store-items${branchQuery(branchId)}`, {
    name: body.name,
    barcode: body.barcode,
    quantity: 0,
    itemId: body.itemId,
  });
  const rows = readRows([created]);
  return rows?.[0] ?? null;
}

/** Writes the catalogue id onto a hand-made row. Create and patch both need catalogue write. */
export async function linkStoreRow(api: ApiClient, branchId: string, storeItemId: string, itemId: string): Promise<StoreRow | null> {
  const updated = await api.patch<unknown>(`/api/v1/store-items/${encodeURIComponent(storeItemId)}${branchQuery(branchId)}`, {
    itemId,
  });
  const rows = readRows([updated]);
  return rows?.[0] ?? null;
}

export async function postStoreMovement(
  api: ApiClient,
  body: {
    storeItemId: string;
    direction: StoreDirection;
    reason: StoreReasonId;
    quantity: number;
    note: string | null;
    branchId: string;
  }
): Promise<StoreMovement | null> {
  return readMovement(
    await api.post<unknown>('/api/v1/store-room/movements', {
      storeItemId: body.storeItemId,
      direction: body.direction,
      reason: body.reason,
      quantity: body.quantity,
      note: body.note,
      branchId: body.branchId,
    })
  );
}

export async function fetchStoreActivity(
  api: ApiClient,
  query: { from: string; to: string; direction?: StoreDirection; status?: 'pending' }
): Promise<StoreMovement[] | null> {
  const parts = [`from=${encodeURIComponent(query.from)}`, `to=${encodeURIComponent(query.to)}`, 'limit=200'];
  if (query.direction) parts.push(`direction=${encodeURIComponent(query.direction)}`);
  if (query.status) parts.push(`status=${encodeURIComponent(query.status)}`);
  return readActivity(await api.get<unknown>(`/api/v1/store-room/movements?${parts.join('&')}`));
}

export async function decideStoreMovement(api: ApiClient, id: string, approve: boolean): Promise<StoreMovement | null> {
  const path = `/api/v1/store-room/movements/${encodeURIComponent(id)}/${approve ? 'approve' : 'reject'}`;
  return readMovement(await api.post<unknown>(path, {}));
}
