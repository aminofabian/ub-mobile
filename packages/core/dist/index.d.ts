interface TenantContext {
    businessId: string;
    slug: string;
    host: string;
    displayName: string;
    branding: Record<string, unknown>;
}
declare function resolveShopperStore(input: string, baseURL: string, options?: {
    hostSuffixes?: string[];
}): Promise<TenantContext>;
declare function resolveTenant(input: string, baseURL?: string, options?: {
    hostSuffixes?: string[];
}): Promise<TenantContext>;
declare function loadTenant(): Promise<TenantContext | null>;
declare function getTenantHeaders(tenant: TenantContext): Record<string, string>;
declare function clearTenant(): Promise<void>;

type TenantDeepLinkIntent = 'shop' | 'login' | 'tenant';
interface ParsedTenantDeepLink {
    intent: TenantDeepLinkIntent;
    /** Present for `kiosk://…/{slug}` links; may be null for hostname-only universal links. */
    slug: string | null;
    /** Hostname for `https://{host}/shop` style links. */
    host: string | null;
}
declare function isShopperDeepLinkIntent(intent: TenantDeepLinkIntent): boolean;
declare function isStaffDeepLinkIntent(intent: TenantDeepLinkIntent): boolean;
/**
 * Parses tenant deep links such as `kiosk://shop/palmart` or `https://palmart.kiosk.ke/shop`.
 */
declare function parseTenantDeepLink(url: string): ParsedTenantDeepLink | null;
declare function resolveTenantFromDeepLink(url: string, baseURL: string, options?: {
    hostSuffixes?: string[];
}): Promise<{
    tenant: TenantContext;
    intent: TenantDeepLinkIntent;
} | null>;

declare function useTenantDeepLink(onUrl: (url: string) => void | Promise<void>): void;

interface ApiClientConfig {
    baseURL: string;
    getTenant?: () => Promise<TenantContext | null>;
}
declare function apiRequest<T>(config: ApiClientConfig, method: string, path: string, options?: {
    body?: unknown;
    idempotent?: boolean;
    public?: boolean;
}): Promise<T>;
declare function publicApiRequest<T>(baseURL: string, method: string, path: string, options?: {
    body?: unknown;
}): Promise<T>;

interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
declare function storeTokens(tokens: AuthTokens): Promise<void>;
declare function getAccessToken(): Promise<string | null>;
declare function getRefreshToken(): Promise<string | null>;
declare function clearTokens(): Promise<void>;

interface LoginResponse {
    accessToken: string;
    refreshToken?: string;
}
interface BranchOption {
    id: string;
    name: string;
    code?: string;
}
interface RegisterResponse {
    userId: string;
    email: string;
    status: string;
    verificationUrl?: string | null;
}
type RefreshOutcome = {
    kind: 'ok';
} | {
    kind: 'rejected';
} | {
    kind: 'network';
};
declare function loginWithPassword(baseURL: string, email: string, password: string): Promise<void>;
declare function loginWithPin(baseURL: string, email: string, pin: string, branchId: string): Promise<void>;
declare function refreshAccessToken(baseURL: string): Promise<RefreshOutcome>;
declare function registerAccount(baseURL: string, name: string, email: string, password: string, opts?: {
    staffInviteToken?: string;
}): Promise<RegisterResponse>;
declare function resendVerificationEmail(baseURL: string, email: string): Promise<{
    verificationUrl?: string | null;
}>;
declare function logout(baseURL: string): Promise<void>;
declare function fetchBranches(baseURL: string): Promise<BranchOption[]>;
declare function resolveTenantByEmail(baseURL: string, email: string): Promise<{
    host: string;
    slug: string;
    businessId: string;
    displayName: string;
}>;

declare const NATIVE_KIOSK_CLIENT_HEADER = "X-Kiosk-Client";
declare const NATIVE_KIOSK_CLIENT_VALUE = "native";
type AuthTokenPayload = {
    accessToken?: string;
    refreshToken?: string;
    access_token?: string;
    refresh_token?: string;
};
/** Split concatenated Set-Cookie header values without breaking Expires dates. */
declare function readSetCookieLines(headers: Headers): string[];
declare function readCookieFromSetCookie(headers: Headers, name: string): string;
declare function readAuthTokens(payload: AuthTokenPayload, headers: Headers): {
    accessToken: string;
    refreshToken: string;
};
/** PIN login only accepts a real branch UUID; omit placeholders like "default". */
declare function pinLoginBranchId(branchId: string | undefined): string | undefined;

interface ApiClient {
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body?: unknown, options?: {
        idempotent?: boolean;
    }): Promise<T>;
    patch<T>(path: string, body?: unknown, options?: {
        idempotent?: boolean;
    }): Promise<T>;
    delete<T>(path: string, options?: {
        idempotent?: boolean;
    }): Promise<T>;
}
interface CreateApiClientOptions {
    baseURL: string;
    getTenant?: () => Promise<TenantContext | null>;
    onAuthFailed?: () => void;
}
declare function createApiClient(options: CreateApiClientOptions): ApiClient;

declare function getEmbeddedTenantSlug(): string | null;
declare function isWhiteLabelApp(): boolean;
declare function getTenantDisplayName(): string | null;
/**
 * Loads a persisted tenant, or auto-resolves the slug baked in at build time
 * for white-label apps. Returns null when the generic app needs a tenant picker.
 */
declare function bootstrapTenant(baseURL: string): Promise<TenantContext | null>;

declare function resolveMobileApiBaseUrl(): string;
declare function tenantHostSuffix(): string;
type WhiteLabelThemeColors = {
    primary?: string;
    secondary?: string;
    logoUrl?: string;
};
/** Build-time tenant identity from app.config.js → expo-constants. */
declare function getWhiteLabelExtra(): {
    tenantId: string | null;
    apiBaseUrl: string | null;
    themeColors: WhiteLabelThemeColors | null;
    isWhiteLabel: boolean;
};

interface PublicMobileBranding {
    displayName: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string | null;
    accentColor: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    ogImage: string | null;
    metaKeywords: string | null;
    heroBannerUrls: string[] | null;
}
interface PublicMobileDeepLinks {
    shopper: string;
    cashier: string;
    grocery: string;
    admin: string;
    stock: string;
    tenant: string;
    universalShop: string;
    universalApp: string;
}
interface PublicMobileStoreLinks {
    ios: string | null;
    android: string | null;
}
interface PublicMobileApp {
    role: string;
    name: string;
    bundleId: string;
    whiteLabel: boolean;
    embeddedTenantSlug: string;
    storeLinks: PublicMobileStoreLinks;
}
interface PublicMobileConfig {
    tenantId: string;
    slug: string;
    displayName: string;
    tenantHost: string;
    tenantStatus: string;
    storefrontEnabled: boolean;
    apiBaseUrl: string;
    branding: PublicMobileBranding;
    deepLinks: PublicMobileDeepLinks;
    platformStoreLinks: PublicMobileStoreLinks;
    apps: PublicMobileApp[];
}
declare function fetchPublicMobileConfig(baseURL: string, slug: string): Promise<PublicMobileConfig>;

type ProblemResponse = {
    type: string;
    title: string;
    status: number;
    detail?: string;
    code?: string;
};
declare function parseProblem(payload: unknown): ProblemResponse | null;
declare function formatApiProblemMessage(payload: unknown): string;
declare function readApiErrorMessage(response: Response): Promise<string>;

declare function generateIdempotencyKey(): string;

declare const TILL_DEVICE_HEADER = "X-Till-Device-Id";
/** Durable per-install till id for shift scoping. */
declare function getOrCreateTillDeviceId(): Promise<string>;

export { type ApiClient, type ApiClientConfig, type AuthTokenPayload, type AuthTokens, type BranchOption, type CreateApiClientOptions, type LoginResponse, NATIVE_KIOSK_CLIENT_HEADER, NATIVE_KIOSK_CLIENT_VALUE, type ParsedTenantDeepLink, type ProblemResponse, type PublicMobileApp, type PublicMobileBranding, type PublicMobileConfig, type PublicMobileDeepLinks, type PublicMobileStoreLinks, type RefreshOutcome, type RegisterResponse, TILL_DEVICE_HEADER, type TenantContext, type TenantDeepLinkIntent, type WhiteLabelThemeColors, apiRequest, bootstrapTenant, clearTenant, clearTokens, createApiClient, fetchBranches, fetchPublicMobileConfig, formatApiProblemMessage, generateIdempotencyKey, getAccessToken, getEmbeddedTenantSlug, getOrCreateTillDeviceId, getRefreshToken, getTenantDisplayName, getTenantHeaders, getWhiteLabelExtra, isShopperDeepLinkIntent, isStaffDeepLinkIntent, isWhiteLabelApp, loadTenant, loginWithPassword, loginWithPin, logout, parseProblem, parseTenantDeepLink, pinLoginBranchId, publicApiRequest, readApiErrorMessage, readAuthTokens, readCookieFromSetCookie, readSetCookieLines, refreshAccessToken, registerAccount, resendVerificationEmail, resolveMobileApiBaseUrl, resolveShopperStore, resolveTenant, resolveTenantByEmail, resolveTenantFromDeepLink, storeTokens, tenantHostSuffix, useTenantDeepLink };
