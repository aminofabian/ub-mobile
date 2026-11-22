import { getAccessToken } from './auth';
import { refreshAccessToken } from './auth-service';
import {
  generateIdempotencyKey,
  resolveIdempotencyKey,
  type IdempotencyOptions,
} from './idempotency';
import { readApiErrorMessage } from './problem';
import { getActiveTenantId, getTenantHeaders, loadActiveStore, loadStoreById, type TenantContext } from './tenant';
import { getOrCreateTillDeviceId, TILL_DEVICE_HEADER } from './till-device';

export interface ApiClient {
  /** The shop this client is pinned to. Absent when it follows whichever shop is active. */
  readonly tenantId?: string;
  /** The same client, pinned to one shop. What the sync engine sends through, so a shop switch cannot redirect a queued sale. */
  forTenant?(tenantId: string): ApiClient;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown, options?: IdempotencyOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: IdempotencyOptions): Promise<T>;
  delete<T>(path: string, options?: IdempotencyOptions): Promise<T>;
}

export interface CreateApiClientOptions {
  baseURL: string;
  /**
   * Pins the client to one shop. Use it for anything that can outlive a shop switch (the sync
   * engine): its requests keep going to that shop, with that shop's session, whichever is active.
   */
  tenantId?: string;
  getTenant?: () => Promise<TenantContext | null>;
  onAuthFailed?: () => void;
}

export function createApiClient(options: CreateApiClientOptions): ApiClient {
  async function resolveTenant(): Promise<TenantContext | null> {
    if (options.getTenant) {
      return options.getTenant();
    }
    return options.tenantId ? loadStoreById(options.tenantId) : loadActiveStore();
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts: IdempotencyOptions & { retried?: boolean; tenant?: TenantContext | null } = {}
  ): Promise<T> {
    const url = `${options.baseURL}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Correlation-Id': generateIdempotencyKey(),
    };

    // The shop is resolved once per call. Its tokens and till id are read for that shop, and a retry
    // after a refresh goes back to the same one, even if another shop became active in between.
    const tenant = opts.tenant !== undefined ? opts.tenant : await resolveTenant();
    const tenantId = tenant?.businessId ?? null;
    if (tenant) {
      Object.assign(headers, getTenantHeaders(tenant));
    }

    const accessToken = tenantId ? await getAccessToken(tenantId) : null;
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Resolved once per call, so the retry after a token refresh below sends the same key.
    const idempotencyKey = resolveIdempotencyKey(opts);
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const tillId = tenantId ? await getOrCreateTillDeviceId(tenantId) : '';
    if (tillId) {
      headers[TILL_DEVICE_HEADER] = tillId;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401 && !opts.retried && tenant) {
      const result = await refreshAccessToken(options.baseURL, tenant);
      if (result.kind === 'ok') {
        return request<T>(method, path, body, { ...opts, idempotencyKey, retried: true, tenant });
      }
      // A refused session has already been ended for that shop. Only the person who is looking at it
      // needs to be sent to sign in; a request that belonged to another shop fails quietly.
      if (result.kind === 'rejected' && (await getActiveTenantId()) === tenant.businessId) {
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
    tenantId: options.tenantId,
    forTenant: (tenantId: string) => createApiClient({ ...options, getTenant: undefined, tenantId }),
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown, opts?: IdempotencyOptions) =>
      request<T>('POST', path, body, { ...opts }),
    patch: <T>(path: string, body?: unknown, opts?: IdempotencyOptions) =>
      request<T>('PATCH', path, body, { ...opts }),
    delete: <T>(path: string, opts?: IdempotencyOptions) =>
      request<T>('DELETE', path, undefined, { ...opts }),
  };
}
