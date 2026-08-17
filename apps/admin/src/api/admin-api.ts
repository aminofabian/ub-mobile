import type { ApiClient } from '@kiosk/core';

export interface OwnerSummary {
  revenueToday?: number;
  ordersToday?: number;
  profitToday?: number;
  openShifts?: number;
  currency?: string;
}

export interface WebOrder {
  id: string;
  status?: string;
  customerName?: string;
  grandTotal?: number;
}

export interface UserRecord {
  id: string;
  email?: string;
  name?: string;
  roleName?: string;
}

export async function fetchOwnerSummary(api: ApiClient): Promise<OwnerSummary> {
  return api.get<OwnerSummary>('/api/v1/dashboard/owner-summary');
}

export async function fetchWebOrders(api: ApiClient): Promise<WebOrder[]> {
  const response = await api.get<{ orders?: WebOrder[] } | WebOrder[]>('/api/v1/web-orders');
  return Array.isArray(response) ? response : (response.orders ?? []);
}

export async function updateOrderStatus(
  api: ApiClient,
  orderId: string,
  fulfillmentStatus: string
): Promise<void> {
  await api.patch(`/api/v1/web-orders/${orderId}/fulfillment-status`, { fulfillmentStatus });
}

export async function fetchUsers(api: ApiClient): Promise<UserRecord[]> {
  const response = await api.get<{ users?: UserRecord[] } | UserRecord[]>('/api/v1/users');
  return Array.isArray(response) ? response : (response.users ?? []);
}

export async function fetchSalesReport(api: ApiClient): Promise<unknown> {
  return api.get('/api/v1/reports/sales');
}

export async function fetchInventoryReport(api: ApiClient): Promise<unknown> {
  return api.get('/api/v1/reports/inventory');
}

export async function fetchFinancePulse(api: ApiClient): Promise<unknown> {
  return api.get('/api/v1/finance/pulse');
}
