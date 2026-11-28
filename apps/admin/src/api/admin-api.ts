import type { ApiClient } from '@kiosk/core';

/** The owner pulse for one business date — the real shape of `pulseToday` from owner-summary. */
export interface FinancePulse {
  date?: string;
  branchId?: string | null;
  salesCount?: number;
  revenue?: number;
  cogs?: number;
  grossProfit?: number;
  grossMarginPct?: number;
  expensesTotal?: number;
  netOperating?: number;
  openShifts?: number;
}

export interface TopSku {
  itemId: string;
  itemName?: string;
  revenueLast30Days?: number;
}

/** The composite owner dashboard response (`/api/v1/dashboard/owner-summary`). */
export interface OwnerSummary {
  pulseToday?: FinancePulse;
  topSkusLast30Days?: TopSku[];
}

/** One day in the sales register (`/api/v1/reports/sales/register`). */
export interface SalesRegisterDay {
  day: string;
  branchId?: string;
  qty?: number;
  revenue?: number;
  cost?: number;
  profit?: number;
}

export interface SalesRegister {
  from?: string;
  to?: string;
  days?: SalesRegisterDay[];
  totalRevenue?: number;
  totalProfit?: number;
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

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** The last `days` calendar days of sales, oldest first — the source for the revenue sparkline. */
export async function fetchSalesRegister(api: ApiClient, days = 10): Promise<SalesRegister> {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return api.get<SalesRegister>(
    `/api/v1/reports/sales/register?from=${isoDate(from)}&to=${isoDate(to)}`
  );
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
