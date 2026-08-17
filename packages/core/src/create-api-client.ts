import { getAccessToken, clearTokens } from './auth';
import { refreshAccessToken } from './auth-service';
import { generateIdempotencyKey } from './idempotency';
import { readApiErrorMessage } from './problem';
import { getTenantHeaders, loadTenant, type TenantContext } from './tenant';
import { getOrCreateTillDeviceId, TILL_DEVICE_HEADER } from './till-device';

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown, options?: { idempotent?: boolean }): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: { idempotent?: boolean }): Promise<T>;
  delete<T>(path: string, options?: { idempotent?: boolean }): Promise<T>;
}

export interface CreateApiClientOptions {
  baseURL: string;
  getTenant?: () => Promise<TenantContext | null>;
  onAuthFailed?: () => void;
}

export function createApiClient(options: CreateApiClientOptions): ApiClient {
  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts: { idempotent?: boolean; retried?: boolean } = {}
  ): Promise<T> {
    const url = `${options.baseURL}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Correlation-Id': generateIdempotencyKey(),
    };

    const tenant = options.getTenant ? await options.getTenant() : await loadTenant();
    if (tenant) {
      Object.assign(headers, getTenantHeaders(tenant));
    }

    const accessToken = await getAccessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    if (opts.idempotent) {
      headers['Idempotency-Key'] = generateIdempotencyKey();
    }

    const tillId = await getOrCreateTillDeviceId();
    if (tillId) {
      headers[TILL_DEVICE_HEADER] = tillId;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401 && !opts.retried) {
      const result = await refreshAccessToken(options.baseURL);
      if (result.kind === 'ok') {
        return request<T>(method, path, body, { ...opts, retried: true });
      }
      if (result.kind === 'rejected') {
        await clearTokens();
        options.onAuthFailed?.();
      }
    }

    if (!response.ok) {
      throw new Error(await readApiErrorMessage(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown, opts?: { idempotent?: boolean }) =>
      request<T>('POST', path, body, { idempotent: opts?.idempotent }),
    patch: <T>(path: string, body?: unknown, opts?: { idempotent?: boolean }) =>
      request<T>('PATCH', path, body, { idempotent: opts?.idempotent }),
    delete: <T>(path: string, opts?: { idempotent?: boolean }) =>
      request<T>('DELETE', path, undefined, { idempotent: opts?.idempotent }),
  };
}
