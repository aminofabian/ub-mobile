import { generateIdempotencyKey, type TenantContext } from '@kiosk/core';
import { API_BASE_URL } from '../lib/config';
import { toKenyanLocal07 } from '../lib/phone';

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const payload = (await res.json()) as { detail?: string; message?: string; title?: string };
    return payload.detail || payload.message || payload.title || fallback;
  } catch {
    return fallback;
  }
}

async function post<T>(tenant: TenantContext, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Correlation-Id': generateIdempotencyKey(),
      'X-Tenant-Host': tenant.host,
      'X-Tenant-Id': tenant.businessId,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readError(res, `Request failed (${res.status})`));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function sendShopperCode(tenant: TenantContext, phone: string) {
  const local = toKenyanLocal07(phone) || phone.trim();
  return post<{ maskedHint?: string; channel?: string }>(tenant, '/api/v1/public/shopper/auth/send-code', {
    phone: local,
  });
}

export async function verifyShopperCode(tenant: TenantContext, phone: string, code: string) {
  const local = toKenyanLocal07(phone) || phone.trim();
  return post<{ phoneVerificationToken: string }>(tenant, '/api/v1/public/shopper/auth/verify-code', {
    phone: local,
    code: code.trim(),
  });
}
