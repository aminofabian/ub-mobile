"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  NATIVE_KIOSK_CLIENT_HEADER: () => NATIVE_KIOSK_CLIENT_HEADER,
  NATIVE_KIOSK_CLIENT_VALUE: () => NATIVE_KIOSK_CLIENT_VALUE,
  TILL_DEVICE_HEADER: () => TILL_DEVICE_HEADER,
  apiRequest: () => apiRequest,
  bootstrapTenant: () => bootstrapTenant,
  clearTenant: () => clearTenant,
  clearTokens: () => clearTokens,
  createApiClient: () => createApiClient,
  fetchBranches: () => fetchBranches,
  fetchPublicMobileConfig: () => fetchPublicMobileConfig,
  formatApiProblemMessage: () => formatApiProblemMessage,
  generateIdempotencyKey: () => generateIdempotencyKey,
  getAccessToken: () => getAccessToken,
  getEmbeddedTenantSlug: () => getEmbeddedTenantSlug,
  getOrCreateTillDeviceId: () => getOrCreateTillDeviceId,
  getRefreshToken: () => getRefreshToken,
  getTenantDisplayName: () => getTenantDisplayName,
  getTenantHeaders: () => getTenantHeaders,
  getWhiteLabelExtra: () => getWhiteLabelExtra,
  isShopperDeepLinkIntent: () => isShopperDeepLinkIntent,
  isStaffDeepLinkIntent: () => isStaffDeepLinkIntent,
  isWhiteLabelApp: () => isWhiteLabelApp,
  loadTenant: () => loadTenant,
  loginWithPassword: () => loginWithPassword,
  loginWithPin: () => loginWithPin,
  logout: () => logout,
  parseProblem: () => parseProblem,
  parseTenantDeepLink: () => parseTenantDeepLink,
  pinLoginBranchId: () => pinLoginBranchId,
  publicApiRequest: () => publicApiRequest,
  readApiErrorMessage: () => readApiErrorMessage,
  readAuthTokens: () => readAuthTokens,
  readCookieFromSetCookie: () => readCookieFromSetCookie,
  readSetCookieLines: () => readSetCookieLines,
  refreshAccessToken: () => refreshAccessToken,
  registerAccount: () => registerAccount,
  resendVerificationEmail: () => resendVerificationEmail,
  resolveMobileApiBaseUrl: () => resolveMobileApiBaseUrl,
  resolveShopperStore: () => resolveShopperStore,
  resolveTenant: () => resolveTenant,
  resolveTenantByEmail: () => resolveTenantByEmail,
  resolveTenantFromDeepLink: () => resolveTenantFromDeepLink,
  storeTokens: () => storeTokens,
  tenantHost: () => tenantHost,
  tenantHostSuffix: () => tenantHostSuffix,
  useTenantDeepLink: () => useTenantDeepLink
});
module.exports = __toCommonJS(index_exports);

// src/tenant.ts
var SecureStore = __toESM(require("expo-secure-store"));
var TENANT_KEY = "kiosk.tenant";
var DEFAULT_HOST_SUFFIXES = ["localhost", "palmart.co.ke", "kiosk.ke"];
function normalizeSlug(input) {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]?.split(".")[0] ?? "";
}
function hostFromSlugAndSuffix(slug, suffix) {
  const clean = suffix.trim().toLowerCase().replace(/^\./, "");
  if (!clean) {
    return slug;
  }
  if (clean === slug || clean.startsWith(`${slug}.`)) {
    return clean;
  }
  return `${slug}.${clean}`;
}
function hostCandidates(input, extraSuffixes = []) {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes(".")) {
    return [trimmed.replace(/^https?:\/\//, "").split("/")[0] ?? trimmed];
  }
  const slug = normalizeSlug(trimmed);
  const suffixes = [.../* @__PURE__ */ new Set([...extraSuffixes, ...DEFAULT_HOST_SUFFIXES])];
  return [...new Set(suffixes.map((suffix) => hostFromSlugAndSuffix(slug, suffix)))];
}
function mapHostResolve(host, body) {
  return {
    businessId: body.tenantId,
    slug: body.slug,
    host,
    displayName: body.branding?.displayName?.trim() || body.tenantName,
    branding: body.branding ?? {}
  };
}
function mapStorefront(slug, body) {
  return {
    businessId: body.catalogBranchId ?? body.slug,
    slug: body.slug,
    host: slug,
    displayName: body.label?.trim() || body.businessName,
    branding: {}
  };
}
var ResolveAttempt = class {
  constructor(url, status, networkError) {
    this.url = url;
    this.status = status;
    this.networkError = networkError;
  }
  url;
  status;
  networkError;
};
async function resolveByHost(baseURL, host) {
  const url = `${baseURL}/api/v1/public/host/resolve?host=${encodeURIComponent(host)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { tenant: null, attempt: new ResolveAttempt(url, response.status) };
    }
    const body = await response.json();
    return { tenant: mapHostResolve(host, body), attempt: new ResolveAttempt(url, response.status) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return { tenant: null, attempt: new ResolveAttempt(url, void 0, message) };
  }
}
async function resolveByStorefrontSlug(baseURL, slug) {
  const url = `${baseURL}/api/v1/public/businesses/${encodeURIComponent(slug)}/storefront`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { tenant: null, attempt: new ResolveAttempt(url, response.status) };
    }
    const body = await response.json();
    return { tenant: mapStorefront(slug, body), attempt: new ResolveAttempt(url, response.status) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    return { tenant: null, attempt: new ResolveAttempt(url, void 0, message) };
  }
}
async function resolveShopperStore(input, baseURL, options = {}) {
  const slug = normalizeSlug(input);
  if (!slug) {
    throw new Error("Enter a valid store slug");
  }
  const attempts = [];
  const storefrontResult = await resolveByStorefrontSlug(baseURL, slug);
  attempts.push(storefrontResult.attempt);
  if (storefrontResult.tenant) {
    for (const host of hostCandidates(input, options.hostSuffixes)) {
      const hostResult = await resolveByHost(baseURL, host);
      attempts.push(hostResult.attempt);
      if (hostResult.tenant) {
        const enriched = {
          ...hostResult.tenant,
          displayName: storefrontResult.tenant.displayName || hostResult.tenant.displayName
        };
        await SecureStore.setItemAsync(TENANT_KEY, JSON.stringify(enriched));
        return enriched;
      }
    }
    const fallbackHost = hostCandidates(slug, options.hostSuffixes)[0] ?? `${slug}.localhost`;
    const fixed = { ...storefrontResult.tenant, host: fallbackHost };
    await SecureStore.setItemAsync(TENANT_KEY, JSON.stringify(fixed));
    return fixed;
  }
  for (const host of hostCandidates(input, options.hostSuffixes)) {
    const result = await resolveByHost(baseURL, host);
    attempts.push(result.attempt);
    if (result.tenant) {
      await SecureStore.setItemAsync(TENANT_KEY, JSON.stringify(result.tenant));
      return result.tenant;
    }
  }
  const networkError = attempts.find((a) => a.networkError)?.networkError;
  if (networkError) {
    throw new Error(
      `Cannot reach API at ${baseURL} (${networkError}). Ensure the backend is running on port 5050 and your phone is on the same Wi\u2011Fi.`
    );
  }
  const triedHosts = hostCandidates(input, options.hostSuffixes).join(", ");
  throw new Error(
    `Store "${slug}" not found via ${baseURL}. Tried hosts: ${triedHosts}. If the business exists, enable the web storefront in admin settings.`
  );
}
async function resolveTenant(input, baseURL = "https://api.kiosk.ke", options = {}) {
  if (!input.includes(".")) {
    return resolveShopperStore(input, baseURL, options);
  }
  const host = input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? input;
  const { tenant: resolved } = await resolveByHost(baseURL, host);
  if (!resolved) {
    throw new Error(`Failed to resolve tenant for ${host}`);
  }
  await SecureStore.setItemAsync(TENANT_KEY, JSON.stringify(resolved));
  return resolved;
}
async function loadTenant() {
  const stored = await SecureStore.getItemAsync(TENANT_KEY);
  return stored ? JSON.parse(stored) : null;
}
function getTenantHeaders(tenant) {
  return {
    "X-Tenant-Host": tenant.host,
    "X-Tenant-Id": tenant.businessId
  };
}
async function clearTenant() {
  await SecureStore.deleteItemAsync(TENANT_KEY);
}

// src/deep-link.ts
var SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
function isStaffIntent(intent) {
  return intent === "login" || intent === "tenant";
}
function isShopperDeepLinkIntent(intent) {
  return intent === "shop" || intent === "tenant";
}
function isStaffDeepLinkIntent(intent) {
  return isStaffIntent(intent);
}
function extractSlugFromHost(host) {
  const first = host.split(".")[0]?.trim().toLowerCase() ?? "";
  return SLUG_RE.test(first) ? first : null;
}
function parseCustomSchemeUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (scheme === "http" || scheme === "https") {
    return null;
  }
  const intent = parsed.hostname.trim().toLowerCase();
  if (intent !== "shop" && intent !== "login" && intent !== "tenant") {
    return null;
  }
  const slug = parsed.pathname.replace(/^\//, "").split("/")[0]?.trim().toLowerCase() ?? "";
  if (!slug || !SLUG_RE.test(slug)) {
    return null;
  }
  return { intent, slug, host: null };
}
function parseUniversalLink(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  const host = parsed.hostname.trim().toLowerCase();
  if (!host) {
    return null;
  }
  const path = parsed.pathname.replace(/\/$/, "").toLowerCase();
  if (path === "/shop" || path.endsWith("/shop")) {
    return { intent: "shop", slug: extractSlugFromHost(host), host };
  }
  if (path === "/app" || path.endsWith("/app")) {
    return { intent: "login", slug: extractSlugFromHost(host), host };
  }
  return null;
}
function parseTenantDeepLink(url) {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  return parseCustomSchemeUrl(trimmed) ?? parseUniversalLink(trimmed);
}
async function resolveTenantFromDeepLink(url, baseURL, options = {}) {
  const parsed = parseTenantDeepLink(url);
  if (!parsed) {
    return null;
  }
  const input = parsed.slug ?? parsed.host;
  if (!input) {
    return null;
  }
  const tenant = await resolveTenant(input, baseURL, options);
  return { tenant, intent: parsed.intent };
}

// src/hooks/use-tenant-deep-link.ts
var import_react = require("react");
var import_react_native = require("react-native");
function useTenantDeepLink(onUrl) {
  const handlerRef = (0, import_react.useRef)(onUrl);
  handlerRef.current = onUrl;
  (0, import_react.useEffect)(() => {
    const handle = (url) => {
      if (!url?.trim()) {
        return;
      }
      void handlerRef.current(url);
    };
    void import_react_native.Linking.getInitialURL().then(handle);
    const subscription = import_react_native.Linking.addEventListener("url", (event) => {
      handle(event.url);
    });
    return () => {
      subscription.remove();
    };
  }, []);
}

// src/idempotency.ts
function randomHex(byteCount) {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(byteCount);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  let result = "";
  for (let i = 0; i < byteCount; i++) {
    result += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
  }
  return result;
}
function generateIdempotencyKey() {
  return `${Date.now().toString(36)}-${randomHex(8)}`;
}

// src/auth.ts
var SecureStore2 = __toESM(require("expo-secure-store"));
var ACCESS_TOKEN_KEY = "kiosk.accessToken";
var REFRESH_TOKEN_KEY = "kiosk.refreshToken";
async function storeTokens(tokens) {
  await SecureStore2.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  await SecureStore2.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}
async function getAccessToken() {
  return SecureStore2.getItemAsync(ACCESS_TOKEN_KEY);
}
async function getRefreshToken() {
  return SecureStore2.getItemAsync(REFRESH_TOKEN_KEY);
}
async function clearTokens() {
  await SecureStore2.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore2.deleteItemAsync(REFRESH_TOKEN_KEY);
}

// src/till-device.ts
var SecureStore3 = __toESM(require("expo-secure-store"));
var TILL_DEVICE_STORAGE_KEY = "ub.tillDeviceId";
var TILL_DEVICE_HEADER = "X-Till-Device-Id";
function randomTillId() {
  const rand = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `till-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return rand;
}
async function getOrCreateTillDeviceId() {
  try {
    const existing = (await SecureStore3.getItemAsync(TILL_DEVICE_STORAGE_KEY))?.trim();
    if (existing) {
      return existing;
    }
    const created = randomTillId();
    await SecureStore3.setItemAsync(TILL_DEVICE_STORAGE_KEY, created);
    return created;
  } catch {
    return "";
  }
}

// src/api-client.ts
async function apiRequest(config, method, path, options = {}) {
  const url = `${config.baseURL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "X-Correlation-Id": generateIdempotencyKey()
  };
  if (!options.public) {
    const tenant = config.getTenant ? await config.getTenant() : await loadTenant();
    if (tenant) {
      Object.assign(headers, getTenantHeaders(tenant));
    }
    const accessToken = await getAccessToken();
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    const tillId = await getOrCreateTillDeviceId();
    if (tillId) {
      headers[TILL_DEVICE_HEADER] = tillId;
    }
  }
  if (options.idempotent) {
    headers["Idempotency-Key"] = generateIdempotencyKey();
  }
  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : void 0
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
async function publicApiRequest(baseURL, method, path, options = {}) {
  const url = `${baseURL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "X-Correlation-Id": generateIdempotencyKey()
  };
  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : void 0
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// src/auth-tokens.ts
var ACCESS_COOKIE = "ub.access";
var REFRESH_COOKIE = "ub.refresh";
var NATIVE_KIOSK_CLIENT_HEADER = "X-Kiosk-Client";
var NATIVE_KIOSK_CLIENT_VALUE = "native";
function decodeCookieValue(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
function readSetCookieLines(headers) {
  const withGet = headers;
  if (typeof withGet.getSetCookie === "function") {
    return withGet.getSetCookie();
  }
  const combined = headers.get("set-cookie");
  if (!combined) {
    return [];
  }
  return combined.split(/,(?=\s*[A-Za-z0-9!#$%&'*+\-.^_`|~]+=)/);
}
function cookieNameValue(setCookieLine, name) {
  const first = setCookieLine.trim().split(";")[0] ?? "";
  const eq = first.indexOf("=");
  if (eq <= 0) {
    return null;
  }
  if (first.slice(0, eq).trim() !== name) {
    return null;
  }
  const raw = first.slice(eq + 1).trim();
  return raw ? decodeCookieValue(raw) : null;
}
function readCookieFromSetCookie(headers, name) {
  for (const line of readSetCookieLines(headers)) {
    const value = cookieNameValue(line, name);
    if (value) {
      return value;
    }
  }
  return "";
}
function readAuthTokens(payload, headers) {
  const access = payload.accessToken?.trim() || payload.access_token?.trim() || readCookieFromSetCookie(headers, ACCESS_COOKIE);
  const refresh = payload.refreshToken?.trim() || payload.refresh_token?.trim() || readCookieFromSetCookie(headers, REFRESH_COOKIE);
  return { accessToken: access, refreshToken: refresh };
}
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function pinLoginBranchId(branchId) {
  const trimmed = branchId?.trim();
  if (!trimmed || !UUID_RE.test(trimmed)) {
    return void 0;
  }
  return trimmed;
}

// src/problem.ts
var GENERIC_PROBLEM_TITLES = /* @__PURE__ */ new Set([
  "",
  "Bad Request",
  "Unauthorized",
  "Forbidden",
  "Not Found",
  "Internal Server Error"
]);
function parseProblem(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload;
  let title = typeof record.title === "string" ? record.title.trim() : "";
  const springMessage = typeof record.message === "string" ? record.message.trim() : "";
  if (!title && springMessage) {
    title = springMessage;
  }
  if (!title && typeof record.error === "string") {
    title = record.error.trim();
  }
  const type = typeof record.type === "string" ? record.type : "about:blank";
  const status = typeof record.status === "number" && Number.isFinite(record.status) ? record.status : 500;
  const detail = typeof record.detail === "string" ? record.detail : void 0;
  const code = typeof record.code === "string" ? record.code : void 0;
  return { type, title, status, detail, code };
}
function formatApiProblemMessage(payload) {
  const problem = parseProblem(payload);
  const title = problem != null && problem.title.trim().length > 0 ? problem.title.trim() : "Request failed";
  const detail = problem?.detail?.trim();
  if (detail && detail.length > 0) {
    if (GENERIC_PROBLEM_TITLES.has(title)) {
      return detail;
    }
    return `${title}: ${detail}`;
  }
  return title.length > 0 ? title : "Request failed";
}
async function readApiErrorMessage(response) {
  const text = await response.text().catch(() => "");
  if (!text) {
    return `Request failed (${response.status})`;
  }
  try {
    return formatApiProblemMessage(JSON.parse(text));
  } catch {
    return text;
  }
}

// src/auth-service.ts
var inFlightRefresh = null;
async function authFetch(baseURL, path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-Correlation-Id": generateIdempotencyKey(),
    [NATIVE_KIOSK_CLIENT_HEADER]: NATIVE_KIOSK_CLIENT_VALUE
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
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
  }
  return fetch(`${baseURL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : void 0
  });
}
async function readSessionTokens(response) {
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  return readAuthTokens(payload, response.headers);
}
async function loginWithPassword(baseURL, email, password) {
  const tenant = await loadTenant();
  if (!tenant) {
    throw new Error("Select a store first before signing in.");
  }
  const response = await authFetch(baseURL, "/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
    includeAccessToken: false
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  const tokens = await readSessionTokens(response);
  if (!tokens.accessToken) {
    throw new Error("Login failed: no access token");
  }
  await storeTokens(tokens);
}
async function loginWithPin(baseURL, email, pin, branchId) {
  const tenant = await loadTenant();
  if (!tenant) {
    throw new Error("Select a store first before signing in.");
  }
  const body = { email, pin };
  const resolvedBranch = pinLoginBranchId(branchId);
  if (resolvedBranch) {
    body.branchId = resolvedBranch;
  }
  const response = await authFetch(baseURL, "/api/v1/auth/login-pin", {
    method: "POST",
    body,
    includeAccessToken: false
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  const tokens = await readSessionTokens(response);
  if (!tokens.accessToken) {
    throw new Error("PIN login failed: no access token");
  }
  await storeTokens(tokens);
}
async function refreshAccessToken(baseURL) {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }
  inFlightRefresh = performRefreshOnce(baseURL).finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}
async function performRefreshOnce(baseURL) {
  const refreshToken = await getRefreshToken();
  let response;
  try {
    response = await authFetch(baseURL, "/api/v1/auth/refresh", {
      method: "POST",
      body: refreshToken ? { refreshToken } : {},
      includeAccessToken: false
    });
  } catch {
    return { kind: "network" };
  }
  if (response.status >= 500 || response.status === 408 || response.status === 429) {
    return { kind: "network" };
  }
  if (!response.ok) {
    return { kind: "rejected" };
  }
  let tokens;
  try {
    tokens = await readSessionTokens(response);
  } catch {
    return { kind: "network" };
  }
  if (!tokens.accessToken) {
    return { kind: "rejected" };
  }
  await storeTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken || refreshToken || ""
  });
  return { kind: "ok" };
}
async function registerAccount(baseURL, name, email, password, opts) {
  const tenant = await loadTenant();
  if (!tenant) {
    throw new Error("Select a store first before creating an account.");
  }
  const body = { name, email, password };
  const token = opts?.staffInviteToken?.trim();
  if (token) {
    body.staffInviteToken = token;
  }
  const response = await authFetch(baseURL, "/api/v1/auth/register", {
    method: "POST",
    body,
    includeAccessToken: false
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  return response.json();
}
async function resendVerificationEmail(baseURL, email) {
  const tenant = await loadTenant();
  if (!tenant) {
    throw new Error("Select a store first.");
  }
  const response = await authFetch(baseURL, "/api/v1/auth/resend-verification", {
    method: "POST",
    body: { email },
    includeAccessToken: false
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }
  if (response.status === 204) {
    return {};
  }
  return response.json();
}
async function logout(baseURL) {
  try {
    await authFetch(baseURL, "/api/v1/auth/logout", { method: "POST" });
  } finally {
    await clearTokens();
  }
}
async function fetchBranches(baseURL) {
  const response = await authFetch(baseURL, "/api/v1/auth/branches");
  if (!response.ok) {
    throw new Error(`Failed to fetch branches: ${response.status}`);
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload.branches ?? [];
}
async function resolveTenantByEmail(baseURL, email) {
  const response = await fetch(
    `${baseURL}/api/v1/public/host/resolve-by-email?email=${encodeURIComponent(email)}`
  );
  if (!response.ok) {
    throw new Error(`Tenant not found for email: ${response.status}`);
  }
  return response.json();
}

// src/create-api-client.ts
function createApiClient(options) {
  async function request(method, path, body, opts = {}) {
    const url = `${options.baseURL}${path}`;
    const headers = {
      "Content-Type": "application/json",
      "X-Correlation-Id": generateIdempotencyKey()
    };
    const tenant = options.getTenant ? await options.getTenant() : await loadTenant();
    if (tenant) {
      Object.assign(headers, getTenantHeaders(tenant));
    }
    const accessToken = await getAccessToken();
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    if (opts.idempotent) {
      headers["Idempotency-Key"] = generateIdempotencyKey();
    }
    const tillId = await getOrCreateTillDeviceId();
    if (tillId) {
      headers[TILL_DEVICE_HEADER] = tillId;
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body !== void 0 ? JSON.stringify(body) : void 0
    });
    if (response.status === 401 && !opts.retried) {
      const result = await refreshAccessToken(options.baseURL);
      if (result.kind === "ok") {
        return request(method, path, body, { ...opts, retried: true });
      }
      if (result.kind === "rejected") {
        await clearTokens();
        options.onAuthFailed?.();
      }
    }
    if (!response.ok) {
      throw new Error(await readApiErrorMessage(response));
    }
    if (response.status === 204) {
      return void 0;
    }
    return response.json();
  }
  return {
    get: (path) => request("GET", path),
    post: (path, body, opts) => request("POST", path, body, { idempotent: opts?.idempotent }),
    patch: (path, body, opts) => request("PATCH", path, body, { idempotent: opts?.idempotent }),
    delete: (path, opts) => request("DELETE", path, void 0, { idempotent: opts?.idempotent })
  };
}

// src/embedded-tenant.ts
var import_expo_constants2 = __toESM(require("expo-constants"));

// src/mobile-config.ts
var import_expo_constants = __toESM(require("expo-constants"));
var BACKEND_PORT = 5050;
function debuggerHostname() {
  const hostUri = import_expo_constants.default.expoConfig?.hostUri ?? import_expo_constants.default.expoGoConfig?.debuggerHost ?? import_expo_constants.default.manifest2?.extra?.expoClient?.hostUri;
  if (!hostUri) return null;
  const withoutProtocol = hostUri.replace(/^exp\+[\w-]+:\/\//, "").replace(/^https?:\/\//, "");
  const hostname = withoutProtocol.split(":")[0]?.trim();
  return hostname || null;
}
function resolveMobileApiBaseUrl() {
  const extra = import_expo_constants.default.expoConfig?.extra;
  const configured = extra?.apiBaseUrl ?? extra?.apiBaseURL;
  if (configured && !configured.includes("192.168.100.2")) {
    return configured.replace(/\/$/, "");
  }
  const host = debuggerHostname();
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:${BACKEND_PORT}`;
  }
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return `http://localhost:${BACKEND_PORT}`;
}
function tenantHostSuffix() {
  return import_expo_constants.default.expoConfig?.extra?.tenantHostSuffix ?? "localhost";
}
function tenantHost() {
  const host = import_expo_constants.default.expoConfig?.extra?.tenantHost;
  if (typeof host !== "string") return null;
  const trimmed = host.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  return trimmed || null;
}
function getWhiteLabelExtra() {
  const extra = import_expo_constants.default.expoConfig?.extra ?? {};
  return {
    tenantId: extra.tenantId?.trim() || extra.embeddedTenantSlug?.trim() || null,
    apiBaseUrl: extra.apiBaseUrl ?? extra.apiBaseURL ?? null,
    themeColors: extra.themeColors ?? null,
    isWhiteLabel: extra.isWhiteLabel === true
  };
}

// src/embedded-tenant.ts
function getEmbeddedTenantSlug() {
  const slug = import_expo_constants2.default.expoConfig?.extra?.embeddedTenantSlug;
  if (typeof slug !== "string") return null;
  const trimmed = slug.trim();
  return trimmed || null;
}
function isWhiteLabelApp() {
  return import_expo_constants2.default.expoConfig?.extra?.isWhiteLabel === true;
}
function getTenantDisplayName() {
  const name = import_expo_constants2.default.expoConfig?.extra?.tenantDisplayName;
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed || null;
}
async function bootstrapTenant(baseURL) {
  const embeddedSlug = getEmbeddedTenantSlug();
  const bakedHost = tenantHost();
  const stored = await loadTenant();
  if (stored) {
    const slugMismatch = Boolean(embeddedSlug && stored.slug !== embeddedSlug);
    const hostMismatch = Boolean(bakedHost && stored.host !== bakedHost);
    if (slugMismatch || hostMismatch) {
      await clearTenant();
    } else {
      return stored;
    }
  }
  if (!embeddedSlug && !bakedHost) {
    return null;
  }
  if (bakedHost) {
    return resolveTenant(bakedHost, baseURL);
  }
  return resolveTenant(embeddedSlug, baseURL, {
    hostSuffixes: [tenantHostSuffix()]
  });
}

// src/mobile-distribution.ts
async function fetchPublicMobileConfig(baseURL, slug) {
  return publicApiRequest(
    baseURL,
    "GET",
    `/api/v1/public/businesses/${encodeURIComponent(slug)}/mobile`
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  NATIVE_KIOSK_CLIENT_HEADER,
  NATIVE_KIOSK_CLIENT_VALUE,
  TILL_DEVICE_HEADER,
  apiRequest,
  bootstrapTenant,
  clearTenant,
  clearTokens,
  createApiClient,
  fetchBranches,
  fetchPublicMobileConfig,
  formatApiProblemMessage,
  generateIdempotencyKey,
  getAccessToken,
  getEmbeddedTenantSlug,
  getOrCreateTillDeviceId,
  getRefreshToken,
  getTenantDisplayName,
  getTenantHeaders,
  getWhiteLabelExtra,
  isShopperDeepLinkIntent,
  isStaffDeepLinkIntent,
  isWhiteLabelApp,
  loadTenant,
  loginWithPassword,
  loginWithPin,
  logout,
  parseProblem,
  parseTenantDeepLink,
  pinLoginBranchId,
  publicApiRequest,
  readApiErrorMessage,
  readAuthTokens,
  readCookieFromSetCookie,
  readSetCookieLines,
  refreshAccessToken,
  registerAccount,
  resendVerificationEmail,
  resolveMobileApiBaseUrl,
  resolveShopperStore,
  resolveTenant,
  resolveTenantByEmail,
  resolveTenantFromDeepLink,
  storeTokens,
  tenantHost,
  tenantHostSuffix,
  useTenantDeepLink
});
