import { generateIdempotencyKey, type TenantContext } from '@kiosk/core';
import { API_BASE_URL } from '../lib/config';
import type { AirtimeConfig } from './storefront';

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { detail?: string; message?: string; title?: string };
    return payload.detail || payload.message || payload.title || fallback;
  } catch {
    return fallback;
  }
}

async function tenantFetch<T>(
  tenant: TenantContext,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Correlation-Id': generateIdempotencyKey(),
    'X-Tenant-Host': tenant.host,
  };
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res, `Request failed (${res.status})`));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type AirtimeOrder = {
  orderId: string;
  phoneNumber: string;
  network: string | null;
  amount: number;
  currency: string;
  status: string;
  delivered: boolean;
  failed: boolean;
  awaitingPayment: boolean;
  checkoutRequestId: string | null;
  receipt: string | null;
  message: string | null;
};

export async function createAirtimeOrder(
  slug: string,
  body: { phoneNumber: string; amount: number; payerPhone?: string }
): Promise<AirtimeOrder> {
  const res = await fetch(`${API_BASE_URL}/api/v1/public/businesses/${encodeURIComponent(slug)}/airtime/orders`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Correlation-Id': generateIdempotencyKey(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Could not start the airtime purchase.'));
  }
  return (await res.json()) as AirtimeOrder;
}

export async function fetchAirtimeOrder(slug: string, orderId: string): Promise<AirtimeOrder | null> {
  const id = orderId.trim();
  if (!id) return null;
  const res = await fetch(
    `${API_BASE_URL}/api/v1/public/businesses/${encodeURIComponent(slug)}/airtime/orders/${encodeURIComponent(id)}`,
    { headers: { Accept: 'application/json' } }
  );
  if (!res.ok) return null;
  return (await res.json()) as AirtimeOrder;
}

export type KplcMeter = { meterNumber: string; lastUsedAt: string | null };

export type KplcConfig = {
  purchaseAvailable: boolean;
  purchaseMessage: string;
  meters: KplcMeter[];
};

export type KplcConcept = {
  code: string;
  label: string;
  kind: string;
  amount: number | string | null;
};

export type KplcToken = {
  purchasedAt: string | null;
  amount: number | string | null;
  units: number | string | null;
  tokenNo: string;
  receiptNo: string | null;
  paymentMethod: string | null;
  concepts: KplcConcept[];
};

export type KplcDepletion = {
  estimatedEmptyAt: string | null;
  remainingUnits: number | string | null;
  lastPurchaseUnits: number | string | null;
  dailyUseUnits: number | string | null;
  sampleIntervals: number;
  alreadyEmpty: boolean;
  alertsEnabled: boolean;
};

export type KplcMonthSpend = {
  yearMonth: string;
  label: string;
  amount: number | string;
  units: number | string;
  tokenCount: number;
};

export type KplcStats = {
  thisMonthAmount: number | string;
  thisMonthUnits: number | string;
  thisMonthCount: number;
  allTimeAmount: number | string;
  allTimeCount: number;
  months: KplcMonthSpend[];
};

export type KplcHistory = {
  meterNumber: string;
  purchaseAvailable: boolean;
  purchaseMessage: string;
  tokens: KplcToken[];
  stats?: KplcStats | null;
  depletion?: KplcDepletion | null;
};

export async function fetchKplcConfig(tenant: TenantContext, phone: string): Promise<KplcConfig> {
  return tenantFetch<KplcConfig>(
    tenant,
    'GET',
    `/api/v1/public/credits/tabs/${encodeURIComponent(phone.trim())}/kplc`
  );
}

export async function saveKplcMeter(
  tenant: TenantContext,
  phone: string,
  meterNumber: string
): Promise<KplcConfig> {
  return tenantFetch<KplcConfig>(
    tenant,
    'PUT',
    `/api/v1/public/credits/tabs/${encodeURIComponent(phone.trim())}/kplc/meters`,
    { meterNumber }
  );
}

export async function fetchKplcTokens(
  tenant: TenantContext,
  phone: string,
  meterNumber: string
): Promise<KplcHistory> {
  const params = new URLSearchParams({ meter: meterNumber.trim() });
  return tenantFetch<KplcHistory>(
    tenant,
    'GET',
    `/api/v1/public/credits/tabs/${encodeURIComponent(phone.trim())}/kplc/tokens?${params}`
  );
}

export async function setKplcDepletionAlerts(
  tenant: TenantContext,
  phone: string,
  meterNumber: string,
  enabled: boolean
): Promise<KplcDepletion> {
  return tenantFetch<KplcDepletion>(
    tenant,
    'PUT',
    `/api/v1/public/credits/tabs/${encodeURIComponent(phone.trim())}/kplc/meters/${encodeURIComponent(meterNumber.trim())}/depletion-alerts`,
    { enabled }
  );
}

export type { AirtimeConfig };
