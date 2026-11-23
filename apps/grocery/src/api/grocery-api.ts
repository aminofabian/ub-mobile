import type { ApiClient } from '@kiosk/core';

export interface GroceryItem {
  id: string;
  name: string;
  barcode?: string;
  sellingPrice: number;
}

export interface GroceryInvoice {
  id: string;
  invoiceNumber?: string;
  status?: string;
  grandTotal?: number;
}

export interface InvoiceLine {
  itemId: string;
  quantity: number;
  unitPrice: number;
}

export async function searchItems(
  api: ApiClient,
  options: { search?: string; barcode?: string; itemTypeId?: string }
): Promise<GroceryItem[]> {
  const params: string[] = [];
  if (options.search) params.push(`search=${encodeURIComponent(options.search)}`);
  if (options.barcode) params.push(`barcode=${encodeURIComponent(options.barcode)}`);
  if (options.itemTypeId) params.push(`itemTypeId=${encodeURIComponent(options.itemTypeId)}`);
  const query = params.length ? `?${params.join('&')}` : '';
  // The server answers with a Spring page: the rows are in `content`.
  const response = await api.get<{ content?: GroceryItem[]; items?: GroceryItem[] } | GroceryItem[]>(
    `/api/v1/items${query}`
  );
  return Array.isArray(response) ? response : (response.content ?? response.items ?? []);
}

export async function createInvoice(
  api: ApiClient,
  body: { branchId: string; lines: InvoiceLine[]; notes?: string }
): Promise<GroceryInvoice> {
  return api.post<GroceryInvoice>('/api/v1/grocery/invoices', body, { idempotent: true });
}

export async function listInvoices(api: ApiClient): Promise<GroceryInvoice[]> {
  const response = await api.get<{ invoices?: GroceryInvoice[] } | GroceryInvoice[]>(
    '/api/v1/grocery/invoices'
  );
  return Array.isArray(response) ? response : (response.invoices ?? []);
}

export async function lockInvoice(api: ApiClient, invoiceId: string): Promise<void> {
  await api.post(`/api/v1/grocery/invoices/${invoiceId}/lock`, {}, { idempotent: true });
}

export async function cancelInvoice(api: ApiClient, invoiceId: string): Promise<void> {
  await api.post(`/api/v1/grocery/invoices/${invoiceId}/cancel`, {}, { idempotent: true });
}

export async function fetchTopProducts(api: ApiClient): Promise<GroceryItem[]> {
  const response = await api.get<{ items?: GroceryItem[] } | GroceryItem[]>('/api/v1/grocery/top-products');
  return Array.isArray(response) ? response : (response.items ?? []);
}
