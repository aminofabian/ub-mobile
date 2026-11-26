import type { ApiClient } from '@kiosk/core';

const TILL_PRINTS = '/api/v1/purchasing/till-prints';

export type TillPrintCashier = {
  id: string;
  name: string;
};

export type TillPrintSlipLine = {
  name: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
};

export type TillPrintSlip = {
  reference: string;
  supplierName?: string | null;
  businessName?: string | null;
  branchName?: string | null;
  placedByName?: string | null;
  currency?: string | null;
  lines: TillPrintSlipLine[];
};

export type TillPrintTarget = {
  userId: string;
  name: string;
  online: boolean;
};

export type DispatchTillPrintResult = {
  jobIds: string[];
  tills: TillPrintTarget[];
};

export async function fetchTillCashiers(
  api: ApiClient,
  branchId?: string | null,
): Promise<TillPrintCashier[]> {
  const bid = branchId?.trim();
  const q = bid ? `?branchId=${encodeURIComponent(bid)}` : '';
  const rows = await api.get<TillPrintCashier[]>(`${TILL_PRINTS}/cashiers${q}`);
  return Array.isArray(rows) ? rows : [];
}

export async function dispatchTillPrint(
  api: ApiClient,
  body: {
    kind: 'order' | 'receipt';
    branchId?: string | null;
    targetUserIds: string[];
    slip: TillPrintSlip;
  },
): Promise<DispatchTillPrintResult> {
  const result = await api.post<DispatchTillPrintResult>(TILL_PRINTS, body);
  return {
    jobIds: Array.isArray(result?.jobIds) ? result.jobIds : [],
    tills: Array.isArray(result?.tills) ? result.tills : [],
  };
}

export type TillPrintPendingJob = {
  id: string;
  kind: 'order' | 'receipt' | string;
  reference: string;
  createdAt?: string | null;
  slip: TillPrintSlip;
};

export async function fetchPendingTillPrints(api: ApiClient): Promise<TillPrintPendingJob[]> {
  const rows = await api.get<TillPrintPendingJob[]>(`${TILL_PRINTS}/pending`);
  return Array.isArray(rows) ? rows : [];
}

export async function claimTillPrint(api: ApiClient, jobId: string): Promise<void> {
  const id = jobId.trim();
  if (!id) return;
  await api.post(`${TILL_PRINTS}/${encodeURIComponent(id)}/claim`, {});
}
