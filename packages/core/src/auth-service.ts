import { storeTokens, clearTokens, getRefreshToken, getAccessToken, markSessionEnded, sessionWasEnded } from './auth';
import {
  NATIVE_KIOSK_CLIENT_HEADER,
  NATIVE_KIOSK_CLIENT_VALUE,
  pinLoginBranchId,
  readAuthTokens,
  type AuthTokenPayload,
} from './auth-tokens';
import { getTenantHeaders, loadActiveStore, type TenantContext } from './tenant';
import { generateIdempotencyKey } from './idempotency';
import { ApiError, readApiError } from './problem';
import { parseSignedInUser, type SignedInUser } from './staff-user';
import { getOrCreateTillDeviceId, TILL_DEVICE_HEADER } from './till-device';

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
}

/** What a successful sign-in tells the app about the person. `user` is null when the server did not send one. */
export interface LoginResult {
  user: SignedInUser | null;
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

export type RefreshOutcome =
  | { kind: 'ok' }
  /** The server refused the session. It has been ended on this phone. */
  | { kind: 'rejected' }
  | { kind: 'network' }
  /** The session changed while the request was out (signed out, left the shop, signed in again). The answer was not used. */
  | { kind: 'superseded' };

// A sign-in that has not answered by now is given up on, so the sign-in screen is never left waiting for ever.
const SIGN_IN_TIMEOUT_MS = 30_000;
const BRANCHES_TIMEOUT_MS = 20_000;

// One refresh at a time per shop: two shops can refresh together, one shop never twice.
const inFlightRefresh = new Map<string, Promise<RefreshOutcome>>();

async function authFetch(
  baseURL: string,
  tenant: TenantContext,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    includeAccessToken?: boolean;
    /** Send this token instead of the one stored (a sign-out that has already cleared the store). */
    accessToken?: string;
    signal?: AbortSignal;
    /** Give up on the request after this long. Without it a request waits as long as the network lets it. */
    timeoutMs?: number;
  } = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Correlation-Id': generateIdempotencyKey(),
    [NATIVE_KIOSK_CLIENT_HEADER]: NATIVE_KIOSK_CLIENT_VALUE,
    ...getTenantHeaders(tenant),
  };

  const tillId = await getOrCreateTillDeviceId(tenant.businessId);
  if (tillId) {
    headers[TILL_DEVICE_HEADER] = tillId;
  }

  if (options.accessToken) {
    headers['Authorization'] = `Bearer ${options.accessToken}`;
  } else if (options.includeAccessToken !== false) {
    const accessToken = await getAccessToken(tenant.businessId);
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
  }

  const limit = !options.signal && options.timeoutMs ? new AbortController() : null;
  const timer = limit ? setTimeout(() => limit.abort(), options.timeoutMs) : null;
  try {
    return await fetch(`${baseURL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      ...(options.signal ? { signal: options.signal } : limit ? { signal: limit.signal } : {}),
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** The active shop, resolved once for the whole operation, or an error saying a shop must be chosen first. */
async function requireTenant(message: string): Promise<TenantContext> {
  const tenant = await loadActiveStore();
  if (!tenant) {
    throw new Error(message);
  }
  return tenant;
}

async function readSession(
  response: Response
): Promise<{ accessToken: string; refreshToken: string; user: SignedInUser | null }> {
  let payload: AuthTokenPayload & { user?: unknown } = {};
  try {
    payload = (await response.json()) as AuthTokenPayload & { user?: unknown };
  } catch {
    payload = {};
  }
  return { ...readAuthTokens(payload, response.headers), user: parseSignedInUser(payload?.user) };
}

async function readSessionTokens(
  response: Response
): Promise<{ accessToken: string; refreshToken: string }> {
  const { accessToken, refreshToken } = await readSession(response);
  return { accessToken, refreshToken };
}

/** How long the phone waits for the server to note a sign-out. The person never waits for it. */
const REVOKE_TIMEOUT_MS = 8000;

/**
 * Asks the server to end a session, in the background and with a time limit. Nothing waits for the answer.
 *
 * The server ends a session only for an access token it still accepts, and those last an hour. When the token
 * has run out (a till left idle overnight), the refresh token is used once to get a fresh one, which is used to
 * end the session. Without that the session would stay valid at the server, for up to a month.
 */
function revokeInBackground(
  baseURL: string,
  tenant: TenantContext,
  tokens: { accessToken?: string | null; refreshToken?: string | null },
  timeoutMs: number
): void {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const endWith = (accessToken: string) =>
    authFetch(baseURL, tenant, '/api/v1/auth/logout', { method: 'POST', accessToken, signal: controller.signal });
  void (async () => {
    const first = tokens.accessToken ? await endWith(tokens.accessToken) : null;
    if (first && first.status !== 401) return;
    if (!tokens.refreshToken) return;
    const renewed = await authFetch(baseURL, tenant, '/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: tokens.refreshToken },
      includeAccessToken: false,
      signal: controller.signal,
    });
    if (!renewed.ok) return;
    const { accessToken } = await readSessionTokens(renewed);
    if (accessToken) await endWith(accessToken);
  })()
    .catch(() => undefined)
    .finally(() => clearTimeout(timer));
}

/**
 * Keeps the tokens a sign-in was given, unless the person has gone to another shop since it was sent. A session
 * made for a shop that is no longer open is not kept on the phone or handed to whatever is open now: it is
 * ended at the server, and the caller hears that the answer was not used.
 */
async function keepSignIn(
  baseURL: string,
  tenant: TenantContext,
  tokens: { accessToken: string; refreshToken: string }
): Promise<void> {
  const current = await loadActiveStore();
  if (current?.slug === tenant.slug) {
    await storeTokens(tokens, tenant.businessId);
    return;
  }
  revokeInBackground(baseURL, tenant, tokens, REVOKE_TIMEOUT_MS);
  throw Object.assign(new Error('The shop was changed while signing in.'), { name: 'AbortError' });
}

export async function loginWithPassword(
  baseURL: string,
  email: string,
  password: string
): Promise<LoginResult> {
  const tenant = await requireTenant('Select a store first before signing in.');

  const response = await authFetch(baseURL, tenant, '/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
    includeAccessToken: false,
    timeoutMs: SIGN_IN_TIMEOUT_MS,
  });
  if (!response.ok) {
    throw await readApiError(response);
  }
  const { user, ...tokens } = await readSession(response);
  if (!tokens.accessToken) {
    throw new Error('Login failed: no access token');
  }
  await keepSignIn(baseURL, tenant, tokens);
  return { user };
}

/**
 * Signs in with the till PIN. Send no branch: the server then uses the person's assigned branch, which is
 * the only one a PIN sign-in accepts for anyone who works a till (plan §5.5). Anything else is refused as
 * "Incorrect email or password", which says nothing useful to a manager who picked a second branch.
 */
export async function loginWithPin(
  baseURL: string,
  email: string,
  pin: string,
  branchId?: string
): Promise<LoginResult> {
  const tenant = await requireTenant('Select a store first before signing in.');

  const body: { email: string; pin: string; branchId?: string } = { email, pin };
  const resolvedBranch = pinLoginBranchId(branchId);
  if (resolvedBranch) {
    body.branchId = resolvedBranch;
  }

  const response = await authFetch(baseURL, tenant, '/api/v1/auth/login-pin', {
    method: 'POST',
    body,
    includeAccessToken: false,
    timeoutMs: SIGN_IN_TIMEOUT_MS,
  });
  if (!response.ok) {
    throw await readApiError(response);
  }
  const { user, ...tokens } = await readSession(response);
  if (!tokens.accessToken) {
    throw new Error('PIN login failed: no access token');
  }
  await keepSignIn(baseURL, tenant, tokens);
  return { user };
}

export async function refreshAccessToken(baseURL: string, tenant?: TenantContext): Promise<RefreshOutcome> {
  const shop = tenant ?? (await loadActiveStore());
  if (!shop) {
    return { kind: 'rejected' };
  }
  const running = inFlightRefresh.get(shop.businessId);
  if (running) {
    return running;
  }
  const started = performRefreshOnce(baseURL, shop).finally(() => {
    inFlightRefresh.delete(shop.businessId);
  });
  inFlightRefresh.set(shop.businessId, started);
  return started;
}

async function performRefreshOnce(baseURL: string, tenant: TenantContext): Promise<RefreshOutcome> {
  // The person signed out and nobody has signed in since. A late request must not sign them in again, which a
  // refresh with no token of its own (answered from the phone's cookie) would do.
  if (sessionWasEnded(tenant.businessId)) {
    return { kind: 'rejected' };
  }
  const refreshToken = await getRefreshToken(tenant.businessId);
  let response: Response;
  try {
    response = await authFetch(baseURL, tenant, '/api/v1/auth/refresh', {
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
    return refused(tenant, refreshToken);
  }

  let tokens: { accessToken: string; refreshToken: string };
  try {
    tokens = await readSessionTokens(response);
  } catch {
    return { kind: 'network' };
  }

  if (!tokens.accessToken) {
    return refused(tenant, refreshToken);
  }

  // The answer belongs to the session that asked. If that session ended or was replaced while the
  // request was out, storing it would bring a dead session back, or put an old one over a new one.
  if (await sessionChanged(tenant, refreshToken)) {
    return { kind: 'superseded' };
  }

  // Stored under the shop the refresh was for, even if another shop is active by now.
  await storeTokens(
    {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || refreshToken || '',
    },
    tenant.businessId
  );
  return { kind: 'ok' };
}

/** True when the session on this phone is no longer the one that was used to ask for a refresh. */
async function sessionChanged(tenant: TenantContext, sentRefreshToken: string | null): Promise<boolean> {
  return (await getRefreshToken(tenant.businessId)) !== sentRefreshToken;
}

/** The server turned the session down. End it here, unless a newer sign-in already replaced it. */
async function refused(tenant: TenantContext, sentRefreshToken: string | null): Promise<RefreshOutcome> {
  if (await sessionChanged(tenant, sentRefreshToken)) {
    return { kind: 'superseded' };
  }
  await clearTokens(tenant.businessId);
  return { kind: 'rejected' };
}

export async function registerAccount(
  baseURL: string,
  name: string,
  email: string,
  password: string,
  opts?: { staffInviteToken?: string }
): Promise<RegisterResponse> {
  const tenant = await requireTenant('Select a store first before creating an account.');

  const body: Record<string, unknown> = { name, email, password };
  const token = opts?.staffInviteToken?.trim();
  if (token) {
    body.staffInviteToken = token;
  }
  const response = await authFetch(baseURL, tenant, '/api/v1/auth/register', {
    method: 'POST',
    body,
    includeAccessToken: false,
  });
  if (!response.ok) {
    throw await readApiError(response);
  }
  return response.json() as Promise<RegisterResponse>;
}

export async function resendVerificationEmail(
  baseURL: string,
  email: string
): Promise<{ verificationUrl?: string | null }> {
  const tenant = await requireTenant('Select a store first.');

  const response = await authFetch(baseURL, tenant, '/api/v1/auth/resend-verification', {
    method: 'POST',
    body: { email },
    includeAccessToken: false,
  });
  if (!response.ok) {
    throw await readApiError(response);
  }
  if (response.status === 204) {
    return {};
  }
  return response.json() as Promise<{ verificationUrl?: string | null }>;
}

export async function logout(baseURL: string): Promise<void> {
  const tenant = await loadActiveStore();
  if (!tenant) {
    return;
  }
  markSessionEnded(tenant.businessId);
  try {
    await authFetch(baseURL, tenant, '/api/v1/auth/logout', { method: 'POST' });
  } finally {
    await clearTokens(tenant.businessId);
  }
}

/**
 * Ends the session on this phone at once, then tells the server in the background.
 *
 * `logout` clears the tokens only after the server has answered, and a request with no time limit can wait
 * as long as the network lets it: on a phone that is online but cut off from the internet, for ever. Here
 * the phone forgets the session first, and the request that revokes it carries the token the phone held, so
 * an answer that arrives late cannot touch whoever signs in next. If the server is never told, the phone is
 * signed out anyway; the server's own session ends when it expires.
 */
export async function endSession(baseURL: string, options: { timeoutMs?: number } = {}): Promise<void> {
  const tenant = await loadActiveStore();
  if (!tenant) {
    return;
  }
  // From here nothing that was already on its way may sign this phone in again (see `markSessionEnded`).
  markSessionEnded(tenant.businessId);
  const accessToken = await getAccessToken(tenant.businessId);
  const refreshToken = await getRefreshToken(tenant.businessId);
  await clearTokens(tenant.businessId);
  if (!accessToken && !refreshToken) {
    return;
  }
  revokeInBackground(baseURL, tenant, { accessToken, refreshToken }, options.timeoutMs ?? REVOKE_TIMEOUT_MS);
}

export async function fetchBranches(baseURL: string): Promise<BranchOption[]> {
  const tenant = await requireTenant('Select a store first.');
  const response = await authFetch(baseURL, tenant, '/api/v1/auth/branches', { timeoutMs: BRANCHES_TIMEOUT_MS });
  if (!response.ok) {
    // The same sentence as before, now with the status kept so a caller can tell "not allowed" from "down".
    throw new ApiError(`Failed to fetch branches: ${response.status}`, { status: response.status });
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
