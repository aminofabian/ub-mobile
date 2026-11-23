import type { ApiClient } from '@kiosk/core';
import type { phase_1 } from '@kiosk/types';
import { matchCustomers, type CustomerMatch } from '../lib/customer-match';
import { normalizeKenyanPhone } from '../lib/phone';
import type { CloseBody } from '../lib/shift-cash';

type ShiftResponse = phase_1.components['schemas']['ShiftResponse'];
type SaleResponse = phase_1.components['schemas']['SaleResponse'];
type PostSaleRequest = phase_1.components['schemas']['PostSaleRequest'];

export interface PosItem {
  id: string;
  name: string;
  barcode?: string;
  sellingPrice: number;
  stockOnHand?: number;
}

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

export async function searchItems(
  api: ApiClient,
  options: { search?: string; barcode?: string; branchId?: string }
): Promise<PosItem[]> {
  const params: string[] = [];
  if (options.search) params.push(`search=${encodeURIComponent(options.search)}`);
  if (options.barcode) params.push(`barcode=${encodeURIComponent(options.barcode)}`);
  if (options.branchId) params.push(`branchId=${encodeURIComponent(options.branchId)}`);
  const query = params.length ? `?${params.join('&')}` : '';
  const response = await api.get<{ items?: PosItem[] } | PosItem[]>(
    `/api/v1/items${query}`
  );
  return Array.isArray(response) ? response : (response.items ?? []);
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

/** Find or create a customer from MSISDN only (name stored as the number). */
export async function ensureCustomerByPhone(
  api: ApiClient,
  phone: string
): Promise<PosCustomerHit | null> {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const variants = new Set<string>([digits]);
  if (digits.startsWith('254') && digits.length > 3) {
    variants.add(`0${digits.slice(3)}`);
  } else if (digits.startsWith('0') && digits.length > 1) {
    variants.add(`254${digits.slice(1)}`);
  }
  for (const variant of variants) {
    const hit = await lookupCustomerByPhone(api, variant);
    if (hit) return hit;
  }
  try {
    const created = await api.post<PosCustomerHit>(
      '/api/v1/customers',
      {
        name: digits.startsWith('254') ? digits : `254${digits.replace(/^0/, '')}`,
        phones: [{ phone: digits.startsWith('254') ? digits : `254${digits.replace(/^0/, '')}`, primary: true }],
      },
      { idempotent: true }
    );
    return created;
  } catch {
    for (const variant of variants) {
      const hit = await lookupCustomerByPhone(api, variant);
      if (hit) return hit;
    }
    return null;
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
