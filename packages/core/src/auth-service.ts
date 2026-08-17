import { storeTokens, clearTokens, getRefreshToken, getAccessToken } from './auth';
import {
  NATIVE_KIOSK_CLIENT_HEADER,
  NATIVE_KIOSK_CLIENT_VALUE,
  pinLoginBranchId,
  readAuthTokens,
  type AuthTokenPayload,
} from './auth-tokens';
import { getTenantHeaders, loadTenant } from './tenant';
import { generateIdempotencyKey } from './idempotency';
import { readApiErrorMessage } from './problem';
import { getOrCreateTillDeviceId, TILL_DEVICE_HEADER } from './till-device';

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
}

export interface BranchOption {
  id: string;
  name: string;
  code?: string;
}

export interface RegisterResponse {
  userId: string;
  email: string;
  status: string;
  verificationUrl?: string | null;
}

export type RefreshOutcome = { kind: 'ok' } | { kind: 'rejected' } | { kind: 'network' };

let inFlightRefresh: Promise<RefreshOutcome> | null = null;

async function authFetch(
  baseURL: string,
  path: string,
  options: { method?: string; body?: unknown; includeAccessToken?: boolean } = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Correlation-Id': generateIdempotencyKey(),
    [NATIVE_KIOSK_CLIENT_HEADER]: NATIVE_KIOSK_CLIENT_VALUE,
  };

  const tenant = await loadTenant();
  if (tenant) {
    Object.assign(headers, getTenantHeaders(tenant));
  }

  const tillId = await getOrCreateTillDeviceId();
  if (tillId) {
    headers[TILL_DEVICE_HEADER] = tillId;
  }

  if (options.includeAccessToken !== false) {
    const accessToken = await getAccessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
  }

  return fetch(`${baseURL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

async function readSessionTokens(
  response: Response
): Promise<{ accessToken: string; refreshToken: string }> {
  let payload: AuthTokenPayload = {};
  try {
    payload = (await response.json()) as AuthTokenPayload;
  } catch {
    payload = {};
  }
  return readAuthTokens(payload, response.headers);
}

export async function loginWithPassword(
  baseURL: string,
  email: string,
  password: string
): Promise<void> {
  const tenant = await loadTenant();
  if (!tenant) {
    throw new Error('Select a store first before signing in.');
  }

  const response = await authFetch(baseURL, '/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
    includeAccessToken: false,
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  const tokens = await readSessionTokens(response);
  if (!tokens.accessToken) {
    throw new Error('Login failed: no access token');
  }
  await storeTokens(tokens);
}

export async function loginWithPin(
  baseURL: string,
  email: string,
  pin: string,
  branchId: string
): Promise<void> {
  const tenant = await loadTenant();
  if (!tenant) {
    throw new Error('Select a store first before signing in.');
  }

  const body: { email: string; pin: string; branchId?: string } = { email, pin };
  const resolvedBranch = pinLoginBranchId(branchId);
  if (resolvedBranch) {
    body.branchId = resolvedBranch;
  }

  const response = await authFetch(baseURL, '/api/v1/auth/login-pin', {
    method: 'POST',
    body,
    includeAccessToken: false,
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  const tokens = await readSessionTokens(response);
  if (!tokens.accessToken) {
    throw new Error('PIN login failed: no access token');
  }
  await storeTokens(tokens);
}

export async function refreshAccessToken(baseURL: string): Promise<RefreshOutcome> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }
  inFlightRefresh = performRefreshOnce(baseURL).finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function performRefreshOnce(baseURL: string): Promise<RefreshOutcome> {
  const refreshToken = await getRefreshToken();
  let response: Response;
  try {
    response = await authFetch(baseURL, '/api/v1/auth/refresh', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : {},
      includeAccessToken: false,
    });
  } catch {
    return { kind: 'network' };
  }

  if (response.status >= 500 || response.status === 408 || response.status === 429) {
    return { kind: 'network' };
  }

  if (!response.ok) {
    return { kind: 'rejected' };
  }

  let tokens: { accessToken: string; refreshToken: string };
  try {
    tokens = await readSessionTokens(response);
  } catch {
    return { kind: 'network' };
  }

  if (!tokens.accessToken) {
    return { kind: 'rejected' };
  }

  await storeTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken || refreshToken || '',
  });
  return { kind: 'ok' };
}

export async function registerAccount(
  baseURL: string,
  name: string,
  email: string,
  password: string,
  opts?: { staffInviteToken?: string }
): Promise<RegisterResponse> {
  const tenant = await loadTenant();
  if (!tenant) {
    throw new Error('Select a store first before creating an account.');
  }

  const body: Record<string, unknown> = { name, email, password };
  const token = opts?.staffInviteToken?.trim();
  if (token) {
    body.staffInviteToken = token;
  }
  const response = await authFetch(baseURL, '/api/v1/auth/register', {
    method: 'POST',
    body,
    includeAccessToken: false,
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json() as Promise<RegisterResponse>;
}

export async function resendVerificationEmail(
  baseURL: string,
  email: string
): Promise<{ verificationUrl?: string | null }> {
  const tenant = await loadTenant();
  if (!tenant) {
    throw new Error('Select a store first.');
  }

  const response = await authFetch(baseURL, '/api/v1/auth/resend-verification', {
    method: 'POST',
    body: { email },
    includeAccessToken: false,
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  if (response.status === 204) {
    return {};
  }
  return response.json() as Promise<{ verificationUrl?: string | null }>;
}

export async function logout(baseURL: string): Promise<void> {
  try {
    await authFetch(baseURL, '/api/v1/auth/logout', { method: 'POST' });
  } finally {
    await clearTokens();
  }
}

export async function fetchBranches(baseURL: string): Promise<BranchOption[]> {
  const response = await authFetch(baseURL, '/api/v1/auth/branches');
  if (!response.ok) {
    throw new Error(`Failed to fetch branches: ${response.status}`);
  }
  const payload = (await response.json()) as BranchOption[] | { branches?: BranchOption[] };
  return Array.isArray(payload) ? payload : (payload.branches ?? []);
}

export async function resolveTenantByEmail(
  baseURL: string,
  email: string
): Promise<{ host: string; slug: string; businessId: string; displayName: string }> {
  const response = await fetch(
    `${baseURL}/api/v1/public/host/resolve-by-email?email=${encodeURIComponent(email)}`
  );
  if (!response.ok) {
    throw new Error(`Tenant not found for email: ${response.status}`);
  }
  return response.json();
}
