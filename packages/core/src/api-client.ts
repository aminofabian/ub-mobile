import { generateIdempotencyKey } from './idempotency';
import { getAccessToken } from './auth';
import { getTenantHeaders, loadTenant, type TenantContext } from './tenant';
import { getOrCreateTillDeviceId, TILL_DEVICE_HEADER } from './till-device';

export interface ApiClientConfig {
  baseURL: string;
  getTenant?: () => Promise<TenantContext | null>;
}

export async function apiRequest<T>(
  config: ApiClientConfig,
  method: string,
  path: string,
  options: {
    body?: unknown;
    idempotent?: boolean;
    public?: boolean;
  } = {}
): Promise<T> {
  const url = `${config.baseURL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Correlation-Id': generateIdempotencyKey(),
  };

  if (!options.public) {
    const tenant = config.getTenant ? await config.getTenant() : await loadTenant();
    if (tenant) {
      Object.assign(headers, getTenantHeaders(tenant));
    }

    const accessToken = await getAccessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const tillId = await getOrCreateTillDeviceId();
    if (tillId) {
      headers[TILL_DEVICE_HEADER] = tillId;
    }
  }

  if (options.idempotent) {
    headers['Idempotency-Key'] = generateIdempotencyKey();
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function publicApiRequest<T>(
  baseURL: string,
  method: string,
  path: string,
  options: {
    body?: unknown;
  } = {}
): Promise<T> {
  const url = `${baseURL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Correlation-Id': generateIdempotencyKey(),
  };

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
