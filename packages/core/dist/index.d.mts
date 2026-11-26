interface TenantContext {
    /**
     * The tenant's id, as the server issues it. The name is older than the plan and is sent as the
     * X-Tenant-Id header, so it stays.
     */
    businessId: string;
    slug: string;
    /** The host to send as X-Tenant-Host: the shop's primary domain, as the server reports it. */
    host: string;
    displayName: string;
    branding: Record<string, unknown>;
    /** Lifecycle status from the server (ACTIVE, SUSPENDED, INACTIVE). Absent on contexts saved before Phase 0b. */
    status?: string;
    storefrontEnabled?: boolean;
    /**
     * The shop's formats as the server names them, for example `['mini-mart']` or `['restaurant', 'lodging']`
     * (plan §5.6). Absent until the server sends it, which is not the same as an empty list.
     */
    storeTypes?: string[];
    /**
     * What the apps may offer in this shop, worked out by the server (plan §5.6). A name that is missing is
     * unknown, not false: only an explicit `false` takes something away.
     */
    capabilities?: Record<string, boolean>;
    /** ISO time the server last confirmed this shop. */
    fetchedAt?: string;
}
/** What `previewStore` returns and `activateStore` persists (plan §5.2). */
type StoreSnapshot = TenantContext & {
    fetchedAt: string;
};
type UnavailableReason = 'suspended' | 'storefront_disabled' | 'not_listed';
/**
 * Every way finding a shop can end. A network failure and a server error both come back as
 * `offline`: either way the app has no answer yet and should say so and offer to retry.
 */
type StoreResult = {
    kind: 'found';
    store: StoreSnapshot;
} | {
    kind: 'unavailable';
    reason: UnavailableReason;
    store?: StoreSnapshot;
} | {
    kind: 'not_found';
} | {
    kind: 'offline';
} | {
    kind: 'rate_limited';
    retryAfterSec?: number;
};
/** Who is asking. A shop with its storefront switched off is still a shop for its own staff. */
type StoreAudience = 'shopper' | 'staff';
interface UnsentSummary {
    total: number;
    needsAttention: number;
}

type StoreQuery = {
    kind: 'slug';
    slug: string;
} | {
    kind: 'host';
    host: string;
};
interface PreviewOptions {
    /** A shopper cannot open a shop whose storefront is switched off. Its own staff can. */
    audience: StoreAudience;
    timeoutMs?: number;
}
/** What the person typed, as a slug or a host. Null when it is neither (an email, a sentence, nothing). */
declare function parseStoreInput(input: string): StoreQuery | null;
/** Whether this shop may be opened by this audience, and if not, why. */
declare function classifyStore(store: StoreSnapshot, audience: StoreAudience): StoreResult;
/**
 * Looks a shop up without changing anything on the device. Never throws: every outcome is a
 * StoreResult the screen can show.
 */
declare function previewStore(input: string, baseURL: string, options: PreviewOptions): Promise<StoreResult>;
/**
 * Looks a shop up by the short code printed on its receipts and posters. `code` is what
 * `parseShopCode` returned: already upper case and in the code alphabet. The server answers with the
 * same body as the by-slug route (plan §5.10 row 3), so the result is classified the same way.
 */
declare function previewStoreByCode(code: string, baseURL: string, options: PreviewOptions): Promise<StoreResult>;
/** A sentence for a screen that has no design for each outcome yet. */
declare function describeStoreResult(result: Exclude<StoreResult, {
    kind: 'found';
}>, input?: string): string;

/**
 * Which shop this phone is working in (plan §5.2).
 *
 * One shop is active at a time. Everything that belongs to a shop (tokens, till id, profile, queued
 * sales) is stored under that shop's id, so switching shops never mixes them. The record of the
 * active shop is kept on the device, which is why the app opens offline.
 *
 * Nothing here guesses. A shop is found by the address or name the person typed, the server answers,
 * and the answer is a StoreResult. Only a "found" result can become the active shop.
 */
type SwitchResult = {
    kind: 'switched';
    store: StoreSnapshot | null;
} | {
    kind: 'blocked';
    reason: 'unsent_sales';
    unsent: UnsentSummary;
};
type OpenStoreResult = {
    kind: 'opened';
    store: StoreSnapshot;
} | {
    kind: 'blocked';
    reason: 'unsent_sales';
    unsent: UnsentSummary;
} | Exclude<StoreResult, {
    kind: 'found';
}>;
type UnsentProbe = (tenantId: string) => Promise<UnsentSummary>;
declare class StoreLookupError extends Error {
    readonly result: Exclude<StoreResult, {
        kind: 'found';
    }>;
    constructor(result: Exclude<StoreResult, {
        kind: 'found';
    }>, message: string);
}
declare class StoreSwitchBlockedError extends Error {
    readonly unsent: UnsentSummary;
    constructor(unsent: UnsentSummary);
}
/** @kiosk/offline registers how to count a shop's unsent work. Without it nothing is ever "unsent". */
declare function registerUnsentProbe(probe: UnsentProbe | null): void;
declare function getUnsentSummary(tenantId?: string): Promise<UnsentSummary>;
/** Calls the listener whenever the active shop, or what is known about it, changes. Returns the unsubscribe. */
declare function subscribeActiveStore(listener: (store: StoreSnapshot | null) => void): () => void;
/**
 * Calls the listener with the id of the active shop each time it becomes a different shop, or none.
 * It stays quiet for changes to the same shop: a new name or colour, or a shop carried over from the
 * old layout getting the id the server confirmed. For anything held in memory for one shop, such as a
 * query cache, which must be dropped when the shop changes.
 */
declare function subscribeActiveStoreId(listener: (tenantId: string | null) => void): () => void;
/** The active shop, from this device. Never touches the network, so it works in airplane mode. */
declare function loadActiveStore(): Promise<StoreSnapshot | null>;
/** A remembered shop by id: the active one from memory, any other from the device. Null when this phone has no record of it. */
declare function loadStoreById(tenantId: string): Promise<StoreSnapshot | null>;
declare function getActiveTenantId(): Promise<string | null>;
/** Makes a shop that `previewStore` found the active one. It is not checked against unsent work: use `switchStore` for that. */
declare function activateStore(store: StoreSnapshot): Promise<void>;
/**
 * Moves to another shop, or to none (null, which shows the picker).
 *
 * If the shop being left has sales that were never sent, nothing changes and the result is
 * `blocked`, so the screen can ask. With `keepUnsent` the switch goes ahead and the sales wait in
 * that shop's own queue; they are sent when the shop is opened again. When nothing is unsent, the
 * session being left is ended on this phone.
 */
declare function switchStore(to: StoreSnapshot | null, options?: {
    keepUnsent?: boolean;
}): Promise<SwitchResult>;
/** Look a shop up and, if it can be opened, switch to it. The call a "find my shop" screen makes. */
declare function openStore(input: string, baseURL: string, options: {
    audience: StoreAudience;
    keepUnsent?: boolean;
}): Promise<OpenStoreResult>;
/**
 * Opens a shop this phone already knows, from its saved record: the shop is on screen at once, with or
 * without a connection, and the server is asked about it in the background (see `revalidateActive`). A
 * shop that was suspended, or had its storefront off, when the phone last heard is asked about first,
 * because it may have come back; if that cannot be asked, it stays closed rather than opening on old news.
 */
declare function openRememberedStore(tenantId: string, baseURL: string, options: {
    audience: StoreAudience;
    keepUnsent?: boolean;
}): Promise<OpenStoreResult>;
/**
 * Asks the server about the active shop again and keeps what it says (name, branding, status).
 * Meant to run in the background after the app is already open; it never throws and a failed
 * attempt changes nothing. The result says what the server answered, so a screen can react to a
 * shop that has since been suspended.
 */
declare function revalidateActive(baseURL: string, options: {
    audience: StoreAudience;
}): Promise<StoreResult | null>;
/** The shops this phone has worked in, most recent first, for a switcher. */
declare function listRememberedStores(): Promise<StoreSnapshot[]>;
/** Removes a shop from this phone: its session, till id, profile and hints. Unsent sales stay unless `dropOutbox`. */
declare function forgetStore(tenantId: string, options?: {
    dropOutbox?: boolean;
}): Promise<void>;
/** Forgets which shop is active, and nothing else. Use `switchStore(null)` to be asked about unsent sales first. */
declare function clearActiveStore(): Promise<void>;
/**
 * The headers that tell the server which shop a request is for. A shop carried over from the old
 * layout has no confirmed id yet, so only its host is sent until the server names it.
 */
declare function getTenantHeaders(tenant: TenantContext): Record<string, string>;
/** The store an `openStore` call opened, or the error that explains why it did not. For callers that only catch errors. */
declare function unwrapOpened(result: OpenStoreResult, input?: string): StoreSnapshot;
/** @deprecated Use `openStore` and show the result. Kept so screens that only catch an error still work. */
declare function resolveShopperStore(input: string, baseURL: string): Promise<TenantContext>;
/** @deprecated Use `openStore` and show the result. Kept so screens that only catch an error still work. */
declare function resolveTenant(input: string, baseURL?: string): Promise<TenantContext>;
/** @deprecated Use `loadActiveStore`. */
declare function loadTenant(): Promise<TenantContext | null>;
/** @deprecated Use `switchStore(null)`, which asks about unsent sales first, or `clearActiveStore`. */
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
/** What a scanned QR code points at. */
type ScanTarget = 
/** A shop code, from a link such as `https://kiosk.ke/c/K7M4Q`. */
{
    kind: 'code';
    code: string;
}
/** A shop's address or short name, for `previewStore`. */
 | {
    kind: 'store';
    input: string;
} | {
    kind: 'unknown';
};
/**
 * Reads what a camera found. A code link, a shop link (`kiosk://shop/acme`, `https://acme.kiosk.ke/shop`)
 * and a bare address all name a shop; anything else does not. Bare text is never taken for a code here:
 * a printed code is a link, and a short word that is also a valid code is far more likely a shop's name.
 */
declare function parseScan(data: string): ScanTarget;
/**
 * Looks up the shop a link names without opening it, so the app can show the shop and ask first. Null
 * when the link is not about a shop at all. A link that names a host is about that host, as in
 * `resolveTenantFromDeepLink`.
 */
declare function previewDeepLink(url: string, baseURL: string, options: {
    audience: StoreAudience;
}): Promise<{
    intent: TenantDeepLinkIntent;
    result: StoreResult;
} | null>;
declare function resolveTenantFromDeepLink(url: string, baseURL: string, options: {
    audience: StoreAudience;
    keepUnsent?: boolean;
}): Promise<{
    tenant: TenantContext;
    intent: TenantDeepLinkIntent;
} | null>;

/**
 * What the platform says to every app before any shop is open (plan §5.10 row 4): the oldest app version
 * that still works, versions known to be bad, who to contact, and which features the server has switched
 * on. It is read from `GET /api/v1/platform/mobile-schema-version`, which today answers a schema version
 * and a minimum app version; the other fields are optional additions.
 *
 * Every field is optional and read defensively. A server that sends nothing new leaves the app behaving
 * exactly as it did, which is what lets this ship before the server does.
 */
interface PlatformSupport {
    phone?: string;
    email?: string;
    whatsapp?: string;
    url?: string;
}
interface PlatformConfig {
    schemaVersion?: number;
    /** The oldest app version that may keep working. Older ones are asked to update. */
    minAppVersion?: string;
    /** Exact versions that are refused even though they are newer than the minimum. */
    blockedVersions: string[];
    support?: PlatformSupport;
    /** Search by name. On unless the server says `false`: the endpoint exists today. */
    directoryEnabled: boolean;
    /** Shop codes. Off unless the server says `true`: there is no by-code route until the server ships one. */
    shopCodesEnabled: boolean;
    /** Pairing a phone to a till with a QR from the manager. Off unless `true`: the server has no such route yet. */
    pairingEnabled: boolean;
    /** The slug of a demo shop for reviewers and the curious. Absent until the server seeds one. */
    demoShop?: string;
    storeLinks?: {
        ios?: string;
        android?: string;
    };
}
declare const DEFAULT_PLATFORM_CONFIG: PlatformConfig;
/** "1.2.3" as [1, 2, 3]. A suffix such as "-beta.1" is ignored; null when there is no number at all. */
declare function parseVersion(version: string): number[] | null;
/** Negative when `a` is older than `b`, positive when newer, zero when the same. Missing parts count as 0. */
declare function compareVersions(a: number[], b: number[]): number;
/** Reads the answer. Anything that is not understood is left at its default. */
declare function parsePlatformConfig(body: unknown): PlatformConfig;
/** The platform's answer, or null when it could not be had: offline, an older server, or a page that is not ours. */
declare function fetchPlatformConfig(baseURL: string, options?: {
    timeoutMs?: number;
}): Promise<PlatformConfig | null>;
/** This build's own version, from its manifest. Undefined when the build does not say. */
declare function getAppVersion(): string | undefined;
type UpdateState = {
    required: false;
} | {
    required: true;
    reason: 'below_minimum' | 'blocked';
    minAppVersion?: string;
    storeUrl?: string;
};
/**
 * Whether this build must be updated. It is only ever "yes" when both sides are known: an app that does
 * not know its version, or a platform that could not be reached, is left alone rather than locked out.
 */
declare function updateStateFor(appVersion: string | undefined, config: PlatformConfig | null, platform: string): UpdateState;

/**
 * Shop codes (plan §5.3, §5.10 row 3): five or six characters printed on receipts, shelf tags and
 * posters, typed or scanned. The alphabet leaves out the characters people mix up (0 O 1 I L), so
 * what is printed can be read back without guessing.
 *
 * The server owns the format, including a check character. The app only tidies what was typed and
 * refuses what can never be a code; whether a code belongs to a shop is the server's answer.
 */
/** A to Z without I, L and O, then 2 to 9: 31 characters. */
declare const SHOP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
declare const SHOP_CODE_MIN_LENGTH = 5;
declare const SHOP_CODE_MAX_LENGTH = 6;
type ShopCodeParse = {
    kind: 'ok';
    code: string;
}
/** Fewer than five characters so far: say nothing, the person is still typing. */
 | {
    kind: 'incomplete';
} | {
    kind: 'too_long';
} | {
    kind: 'invalid_characters';
    characters: string[];
};
/** What was typed, as a code. Case, spaces, dots, dashes and underscores do not matter. */
declare function parseShopCode(input: string): ShopCodeParse;
/** The sentence to show beside the field, or null when there is nothing to say yet. */
declare function describeShopCodeProblem(parse: ShopCodeParse): string | null;
/**
 * The code in a link such as `https://kiosk.ke/c/K7M4Q` or `kiosk://c/K7M4Q`, or null for anything else.
 * Only the platform's own address counts: a code on someone else's site is not ours to open.
 */
declare function parseShopCodeLink(url: string): string | null;

/**
 * Finding a shop by name (plan §5.3). Network only, like tenant-resolve.ts: nothing here reads or
 * writes storage, and nothing here opens a shop. Search is for shoppers; staff reach their shop by code,
 * address, pairing or a verified phone, so they never depend on what the directory lists.
 */
declare const MIN_SEARCH_LENGTH = 2;
/** One row of the shop directory. Public information only. */
interface StoreHit {
    slug: string;
    name: string;
    logoUrl?: string;
    /** The shop's own address, when it has one. */
    host?: string;
}
type SearchResult = {
    kind: 'results';
    query: string;
    hits: StoreHit[];
} | {
    kind: 'too_short';
} | {
    kind: 'offline';
} | {
    kind: 'rate_limited';
    retryAfterSec?: number;
}
/** The server has no directory to search, or refused the request in a way retrying will not fix. */
 | {
    kind: 'unavailable';
};
/** What the search box holds, tidied: spaces collapsed, length capped. */
declare function cleanSearchText(input: string): string;
/**
 * Asks the directory for shops matching what was typed. Never throws. `query` in the answer is the
 * text that was actually sent, so a screen that has moved on to newer text can drop a late answer.
 */
declare function searchStores(input: string, baseURL: string, options?: {
    timeoutMs?: number;
}): Promise<SearchResult>;

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
declare function markSessionEnded(tenantId: string): void;
declare function sessionWasEnded(tenantId: string): boolean;
/**
 * Stores a session for a shop. A shop this phone has no record of (forgotten while the request was
 * in flight) gets nothing stored, so a removed shop cannot leave a session behind.
 */
declare function storeTokens(tokens: AuthTokens, tenantId?: string): Promise<void>;
declare function getAccessToken(tenantId?: string): Promise<string | null>;
declare function getRefreshToken(tenantId?: string): Promise<string | null>;
declare function clearTokens(tenantId?: string): Promise<void>;

/**
 * Who has signed in to a staff app, as the server describes them (`GET /api/v1/me`, and the `user`
 * in a sign-in answer). Read defensively: a field that is missing or of the wrong type leaves the
 * app at "unknown", never at a guess.
 */
interface StaffUser {
    id: string;
    email: string;
    name: string;
    /** The branch the server assigned this person. Branch-locked roles always have one. */
    branchId: string | null;
    /** The role's key, for showing where the role works. Never decide anything from it: custom roles exist. Empty when the account has no role. */
    roleKey: string;
    roleName: string;
    /** Permission keys, lower case. This is what a gate reads (plan §5.11.4 rule 2). */
    permissions: string[];
    /**
     * Department (item-type) IDs this person is restricted to. Grocery clerks with none
     * see no departments until an admin assigns at least one.
     */
    itemTypeIds: string[];
    hasPin: boolean;
}
/** What a sign-in answer carries about the person: enough to know the assigned branch. */
interface SignedInUser {
    id: string;
    email: string;
    name: string;
    branchId: string | null;
}
/** `GET /api/v1/me`. Null when the answer is not a person with a role. */
declare function parseMe(payload: unknown): StaffUser | null;
/** The `user` in a sign-in answer. Null when the server did not send one; sign-in still worked. */
declare function parseSignedInUser(payload: unknown): SignedInUser | null;

interface LoginResponse {
    accessToken: string;
    refreshToken?: string;
}
/** What a successful sign-in tells the app about the person. `user` is null when the server did not send one. */
interface LoginResult {
    user: SignedInUser | null;
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
}
/** The server refused the session. It has been ended on this phone. */
 | {
    kind: 'rejected';
} | {
    kind: 'network';
}
/** The session changed while the request was out (signed out, left the shop, signed in again). The answer was not used. */
 | {
    kind: 'superseded';
};
declare function loginWithPassword(baseURL: string, email: string, password: string): Promise<LoginResult>;
/**
 * Signs in with the till PIN. Send no branch: the server then uses the person's assigned branch, which is
 * the only one a PIN sign-in accepts for anyone who works a till (plan §5.5). Anything else is refused as
 * "Incorrect email or password", which says nothing useful to a manager who picked a second branch.
 */
declare function loginWithPin(baseURL: string, email: string, pin: string, branchId?: string): Promise<LoginResult>;
declare function refreshAccessToken(baseURL: string, tenant?: TenantContext): Promise<RefreshOutcome>;
declare function registerAccount(baseURL: string, name: string, email: string, password: string, opts?: {
    staffInviteToken?: string;
}): Promise<RegisterResponse>;
declare function resendVerificationEmail(baseURL: string, email: string): Promise<{
    verificationUrl?: string | null;
}>;
declare function logout(baseURL: string): Promise<void>;
/**
 * Ends the session on this phone at once, then tells the server in the background.
 *
 * `logout` clears the tokens only after the server has answered, and a request with no time limit can wait
 * as long as the network lets it: on a phone that is online but cut off from the internet, for ever. Here
 * the phone forgets the session first, and the request that revokes it carries the token the phone held, so
 * an answer that arrives late cannot touch whoever signs in next. If the server is never told, the phone is
 * signed out anyway; the server's own session ends when it expires.
 */
declare function endSession(baseURL: string, options?: {
    timeoutMs?: number;
}): Promise<void>;
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

declare function generateIdempotencyKey(): string;
interface IdempotencyOptions {
    /** Send an Idempotency-Key, minting a fresh one unless `idempotencyKey` is given. */
    idempotent?: boolean;
    /**
     * Send exactly this key. Use it whenever the same operation can be sent more than once
     * (a queued sale, a retry): the server recognises the key and returns the first result
     * instead of doing the work again. Implies `idempotent`.
     */
    idempotencyKey?: string;
}
/** The key a request should carry, or undefined when it is not an idempotent request. */
declare function resolveIdempotencyKey(options?: IdempotencyOptions): string | undefined;

interface ApiClient {
    /** The shop this client is pinned to. Absent when it follows whichever shop is active. */
    readonly tenantId?: string;
    /** The same client, pinned to one shop. What the sync engine sends through, so a shop switch cannot redirect a queued sale. */
    forTenant?(tenantId: string): ApiClient;
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body?: unknown, options?: IdempotencyOptions): Promise<T>;
    put<T>(path: string, body?: unknown, options?: IdempotencyOptions): Promise<T>;
    patch<T>(path: string, body?: unknown, options?: IdempotencyOptions): Promise<T>;
    delete<T>(path: string, options?: IdempotencyOptions): Promise<T>;
}
interface CreateApiClientOptions {
    baseURL: string;
    /**
     * Pins the client to one shop. Use it for anything that can outlive a shop switch (the sync
     * engine): its requests keep going to that shop, with that shop's session, whichever is active.
     */
    tenantId?: string;
    getTenant?: () => Promise<TenantContext | null>;
    onAuthFailed?: () => void;
}
/**
 * The client pinned to one shop, for anything that can outlive a shop switch or a sign-out (a queue sending in the
 * background): its requests keep going to that shop, with that shop's own session, whichever shop is active by then. A
 * client that cannot be pinned is returned as it is.
 */
declare function pinnedTo(api: ApiClient, tenantId: string): ApiClient;
declare function createApiClient(options: CreateApiClientOptions): ApiClient;

/** Build-time identity from app.config.js. Split out so the storage layer can read it without a cycle. */
declare function getEmbeddedTenantSlug(): string | null;
declare function isWhiteLabelApp(): boolean;
declare function getTenantDisplayName(): string | null;

type BootResult = {
    kind: 'ready';
    store: StoreSnapshot;
    source: 'device' | 'server';
}
/** A build that serves any shop, with none chosen yet: show the picker. */
 | {
    kind: 'picker';
}
/** A build made for one shop that could not be found, or reached, on first launch. */
 | Exclude<StoreResult, {
    kind: 'found';
}>;
/**
 * Opens the shop for this launch. The shop saved on the device opens immediately, with no network,
 * and the server is asked about it afterwards in the background. Only when nothing is saved does a
 * build made for one shop look that shop up, using the host or slug baked in at build time.
 */
declare function bootstrapStore(baseURL: string, options?: {
    audience: StoreAudience;
}): Promise<BootResult>;
/**
 * Same as `bootstrapStore` for callers that want the shop or null (a build that serves any shop and
 * needs the picker), and an error otherwise.
 */
declare function bootstrapTenant(baseURL: string, options?: {
    audience?: StoreAudience;
}): Promise<TenantContext | null>;

declare function resolveMobileApiBaseUrl(): string;
/**
 * The platform's shared domain. A host such as acme.kiosk.ke belongs to a shop called "acme".
 * Dev builds override it through app.config extra (expo-dev-config.js sets "localhost").
 */
declare const DEFAULT_PLATFORM_HOST_SUFFIX = "kiosk.ke";
declare function tenantHostSuffix(): string;
/** Full hostname for a white-label tenant (e.g. palmart.co.ke), if baked in. */
declare function tenantHost(): string | null;
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
    /** For a `setup_required` answer: what has to be set up first (branch, shift, till, dispensing). */
    requirement?: string;
    /** Narrows `requirement` (for a branch: none, pick or assign). */
    hint?: string;
};
declare function parseProblem(payload: unknown): ProblemResponse | null;
declare function formatApiProblemMessage(payload: unknown): string;
/**
 * An error the server answered, with what it said kept: the HTTP status and the machine-readable
 * `code`, `requirement` and `hint`. The message is the same sentence the app showed before this type
 * existed, so anything that only reads `message` is unchanged. Code that has to decide something
 * reads `code`, never the English.
 */
declare class ApiError extends Error {
    readonly status: number;
    readonly code?: string;
    readonly requirement?: string;
    readonly hint?: string;
    /**
     * Set when the answer was not the app's own: a web page or nothing at all, which is what a firewall, a proxy or a
     * login page in the way sends. Absent for anything the app wrote. Code that has to decide whether the server really
     * turned a request down reads this, never the words.
     */
    readonly foreign?: true;
    /**
     * The problem's machine name as the server wrote it (`urn:problem:data-integrity`), when it gave one. Code that has
     * to tell one kind of "no" from another reads this, never the words.
     */
    readonly type?: string;
    constructor(message: string, info: {
        status: number;
        code?: string;
        requirement?: string;
        hint?: string;
        foreign?: boolean;
        type?: string;
    });
}
/** True for an `ApiError`, including one made by another copy of this module. */
declare function isApiError(error: unknown): error is ApiError;
declare function readApiError(response: Response): Promise<ApiError>;
declare function readApiErrorMessage(response: Response): Promise<string>;

/**
 * A name a shop chose for itself is shown inside the app's own sentences, such as "Open Acme Mart?", so it
 * is cleaned of what lets it read as something else: line breaks and other control characters, and the
 * invisible marks that hide or reorder text (the zero-width space, the left-to-right and right-to-left
 * marks, the embedding, override and isolate controls, the soft hyphen), of the tag characters and the
 * variation selectors that can carry hidden text, and of the filler characters that draw nothing and let a
 * name read as blank. Runs of spaces become one, the ends are trimmed, and the length is capped by characters,
 * not by UTF-16 units, so an emoji is never cut in half.
 *
 * The zero-width joiner and non-joiner stay: emoji sequences and Persian, Urdu and Indic words need them. So
 * do the two variation selectors that choose between text and emoji style (U+FE0E and U+FE0F). The marks are
 * listed as explicit ranges, not matched with a Unicode property, and the ones outside the first plane as
 * surrogate pairs, so the result is the same on every JavaScript engine the app runs on.
 */
declare const MAX_DISPLAY_NAME_LENGTH = 80;
/**
 * A shop's web address as a plain, lower-case host (with an optional port), or null when it is anything
 * else. The address comes from the server and is put inside sentences and links, so only a plain one is used.
 */
declare function plainHost(raw: unknown): string | null;
/** The cleaned text, or an empty string when there is nothing left to show. */
declare function cleanDisplayText(raw: unknown, max?: number): string;

/** Who is signed in, from the server. Throws when the answer is not a person with a role. */
declare function fetchMe(api: ApiClient): Promise<StaffUser>;
/** True when the shop runs without shifts: the till never asks for one (capability `shiftsDisabled`, plan §5.6). */
declare function shiftsAreDisabled(shop: {
    capabilities?: Record<string, boolean>;
} | null | undefined): boolean;
/**
 * "Shifts are off" as the shop's public address says it: the feature flags on the host lookup carry
 * `shifts.disabled` when the owner turned shifts off. Only a real `true` counts.
 */
declare function readShiftsDisabled(body: unknown): boolean;
/**
 * Whether this shop runs without shifts, asked of the public host lookup the web storefront already uses.
 * Until `/mobile` carries a `shiftsDisabled` capability this is the only way the app can know. Any failure,
 * or a shop with no address, answers false: the person is offered a shift, which always works.
 */
declare function fetchShiftsDisabled(baseURL: string, host: string | undefined, options?: {
    timeoutMs?: number;
}): Promise<boolean>;

/**
 * Which staff app a person's permissions fit (plan §5.11.4 rule 2).
 *
 * The server decides what a role may do. The app decides only where to send someone, so this reads
 * the permission keys the server returns and never the role key: a custom role that holds the
 * cashier's permissions is a cashier here, and a renamed role is not a stranger.
 *
 * "Fits" means the person holds at least one permission the app's first screens depend on. It keeps
 * out the clearly wrong (a barber in the Cashier) and leaves the rest to the server, which still
 * answers 403 to anything the person may not do.
 */
type StaffApp = 'cashier' | 'grocery' | 'stock' | 'admin';
declare const STAFF_APPS: readonly StaffApp[];
declare const APP_NAMES: Readonly<Record<StaffApp, string>>;
/** What each app is for, finishing "This app is for ...". */
declare const APP_JOBS: Readonly<Record<StaffApp, string>>;
/**
 * Read from the server's own rules, so the app and the server agree on what the first screens need.
 * Cashier: the ten permissions the server calls till work (`TillDeviceService.TILL_WORK_PERMISSIONS`,
 * ADR 0017). The others: the permission on each app's first calls.
 */
declare const APP_ENTRY_PERMISSIONS: Readonly<Record<StaffApp, readonly string[]>>;
declare function fitsApp(app: StaffApp, permissions: readonly string[]): boolean;
/** Every native app these permissions fit, in the order of `STAFF_APPS`. */
declare function appsThatFit(permissions: readonly string[]): StaffApp[];
/**
 * The roles the server pins to the branch they were assigned (`BranchResolutionService`). A branch one of
 * these people picks is ignored, and with none assigned the server refuses their shifts and sales. The list
 * is the server's; it stays the authority, and this only keeps the app from offering a choice that cannot work.
 */
declare const BRANCH_LOCKED_ROLE_KEYS: readonly string[];
declare function isBranchLockedRole(roleKey: string | null | undefined): boolean;
/**
 * Where a role works on the web, in words, and the path to open on the shop's own address. Only for
 * saying so on the wrong-app screen (plan §5.11.2): it is never read to decide anything. A role this
 * does not know (a custom one) gets the shop's front page.
 */
declare function webHomeForRole(roleKey: string): {
    where: string;
    path: string;
};

/**
 * One reading of the server's `setup_required` answer (plan §5.5): a branch, a shift, a registered
 * till or a dispensing record has to exist before the action can run. The server sends a stable
 * `code`, `requirement` and `hint`; this turns them into one honest step, in words, so no screen
 * matches English or shows a bare 403.
 */
type SetupRequirement = 'branch' | 'shift' | 'till' | 'dispensing';
interface SetupRequired {
    requirement: SetupRequirement;
    hint?: string;
}
/** The setup step an error asks for, or null when the error is something else. */
declare function asSetupRequired(error: unknown): SetupRequired | null;
/** What the person can do about it, here or elsewhere. */
type SetupAction = 
/** Choose one of the shop's branches. */
'pick_branch'
/** Open a shift (in the Cashier). */
 | 'open_shift'
/** Scan a pairing QR from the manager. */
 | 'pair'
/** Nothing to do on this phone: ask the manager. */
 | 'ask_manager'
/** Nothing to do in the app: it is done on kiosk.ke. */
 | 'finish_on_web';
interface SetupStep {
    requirement: SetupRequirement;
    title: string;
    body: string;
    action: SetupAction;
}
interface SetupContext {
    app?: StaffApp;
    /** The shop runs without shifts: the till never asks the person to open one. */
    shiftsDisabled?: boolean;
    /** The platform says pairing works, so "scan a QR" is a real way forward. */
    pairingEnabled?: boolean;
    /** The shop's web address (its host), for steps that are finished on the web. Without it the copy says "the web". */
    web?: string;
}
/** A failed action, ready to show: the setup step when the server asked for one, otherwise its own words. */
interface FailureNotice {
    title: string;
    body: string;
    /** Set when the server answered `setup_required`: what the person can do about it. */
    setup?: SetupStep;
}
/**
 * What to tell the person when an action failed. A `setup_required` answer becomes its setup step (a
 * title, one sentence and an action); anything else keeps the server's own message, or `fallback.body`
 * when there is none. The title for those is `fallback.title`.
 */
declare function describeFailure(error: unknown, fallback: {
    title: string;
    body: string;
}, context?: SetupContext): FailureNotice;
declare function describeSetup(needed: SetupRequired, context?: SetupContext): SetupStep;

/**
 * Whether this phone is still a registered till (plan §5.5, §5.12.4 #13).
 *
 * `GET /api/v1/till-devices/me` answers 404 for a phone that was never registered, for one that was
 * revoked, and for every phone in a branch that has no registered tills at all. So a 404 alone does
 * not mean "removed". It means that only for a phone the app already knows was registered at this
 * branch: it was paired here, or this same question was answered 200 here once.
 */
type TillCheck = 'registered'
/** It was a registered till here and no longer is. */
 | 'removed'
/** The server does not know this phone as a till, and the app has no reason to think it should. */
 | 'not_registered'
/** The shop is switched off (a lapsed subscription): the server answers 423, and every other call would too. */
 | 'shop_off'
/** No answer: offline, or the server failed. Say nothing and keep working. */
 | 'unknown';
type TillAnswer = 'registered' | 'not_found' | 'shop_off' | 'failed';
declare function interpretTillAnswer(answer: TillAnswer, registeredHere: boolean): TillCheck;
/** Remembers that this phone is a registered till for this branch: after a pairing, or a 200. */
declare function rememberTillRegistered(tenantId: string, branchId: string): Promise<void>;
declare function forgetTillRegistered(tenantId: string): Promise<void>;
declare function checkTillRegistration(api: ApiClient, tenantId: string, branchId: string): Promise<TillCheck>;

interface TillAccessAsk {
    branchId: string;
    /** Defaults to this phone's till id for the shop when omitted. */
    deviceKey?: string;
    /** Optional label shown to the owner (phone model, etc.). */
    deviceName?: string;
}
/**
 * Asks the shop to trust this phone as a till. Creates / refreshes a pending access request
 * and notifies owners (in-app, email, WhatsApp) when the quiet period allows.
 *
 * Fire-and-forget from entry: never throws to the caller. Returns false when the ask could not
 * be sent (no device key, offline, or the server refused).
 */
declare function requestTillAccess(api: ApiClient, ask: TillAccessAsk): Promise<boolean>;

/**
 * The people who have signed in on this phone at this shop, so the next sign-in is a tap on a name and
 * the PIN (plan §5.12.3 J5). First name and email only: the email is not a secret, and no PIN or
 * password is ever kept. Kept per shop, and gone when the shop is forgotten or the phone is removed
 * from it (plan §9).
 */
interface KnownStaff {
    email: string;
    /** First name, as the server has it. */
    name: string;
}
declare const MAX_KNOWN_STAFF = 6;
/** The first word of a name: what a chip shows. */
declare function firstName(name: string): string;
/** What is stored, as a list. Anything that is not a person with an email is dropped. */
declare function parseKnownStaff(raw: string | null): KnownStaff[];
declare function serializeKnownStaff(people: KnownStaff[]): string;
/** Puts this person first. Someone already there is moved, not repeated; the oldest fall off the end. */
declare function addKnownStaff(people: KnownStaff[], person: {
    email: string;
    name: string;
}): KnownStaff[];
declare function removeKnownStaff(people: KnownStaff[], email: string): KnownStaff[];
declare function loadKnownStaff(tenantId?: string): Promise<KnownStaff[]>;
declare function rememberStaff(person: {
    email: string;
    name: string;
}, tenantId?: string): Promise<void>;
/** "Not you?": takes one person off the list. */
declare function forgetKnownStaff(email: string, tenantId?: string): Promise<void>;
declare function clearKnownStaff(tenantId?: string): Promise<void>;

declare const PAIRING_CODE_MIN_LENGTH = 6;
declare const PAIRING_CODE_MAX_LENGTH = 12;
type PairingCodeParse = {
    kind: 'ok';
    code: string;
} | {
    kind: 'incomplete';
} | {
    kind: 'too_long';
} | {
    kind: 'invalid_characters';
};
/** What was typed, as a pairing code. Case, spaces, dots, dashes and underscores do not matter. */
declare function parsePairingCode(input: string): PairingCodeParse;
/**
 * The code in a scanned QR such as `kiosk://pair/K7M4Q9XD` or `https://kiosk.ke/pair/K7M4Q9XD`, or null for
 * anything else. Only the platform's own address counts, and bare text is never taken for a code.
 */
declare function parsePairingScan(text: string): string | null;
/** What the confirm card shows. */
interface PairingPreview {
    /** The shop's slug or address, to open it with. */
    shop: string;
    /** The server's own id for the shop, when it sends one: it settles whether this is the open shop. */
    shopId?: string;
    shopName: string;
    branchId: string;
    branchName: string;
    /** The role the person will have, in the server's words. */
    roleName: string;
    tillName?: string;
}
/** The server's preview, or null when it is not one. */
declare function parsePairingPreview(body: unknown): PairingPreview | null;
/** Why a code did not work, or could not be tried. */
type PairingProblem = {
    kind: 'not_found';
}
/** Past its 15 minutes. The person asks the manager for a new one. */
 | {
    kind: 'expired';
}
/** Already used by a phone. The person asks the manager for a new one. */
 | {
    kind: 'used';
}
/** The server would not take what was sent. Sending it again will not change that. */
 | {
    kind: 'refused';
} | {
    kind: 'rate_limited';
    retryAfterSec?: number;
}
/** No answer: no connection, a server that is down, or an answer that is not the server's. */
 | {
    kind: 'offline';
};
type PairingLookup = {
    kind: 'found';
    preview: PairingPreview;
} | PairingProblem;
/** Looks a code up without changing anything on the phone. Never throws. */
declare function previewPairing(code: string, baseURL: string, options?: {
    timeoutMs?: number;
}): Promise<PairingLookup>;
type PairingResult = {
    kind: 'paired';
} | PairingProblem;
/**
 * Registers this phone as a till with the code. `deviceKey` is the phone's own till id for that shop
 * (what it already sends as `X-Till-Device-Id`). Call it only after the person has tapped Pair on the
 * confirm card. Never throws.
 */
declare function redeemPairing(code: string, deviceKey: string, baseURL: string, options?: {
    timeoutMs?: number;
}): Promise<PairingResult>;

/** Kept in SecureStore. */
declare const SECURE_FIELDS: readonly ["accessToken", "refreshToken", "tillDeviceId", "deviceSecret"];
/** Kept in AsyncStorage. */
declare const PLAIN_FIELDS: readonly ["profile", "tabPhone", "airtimeRecipient", "airtimePayer", "knownStaff", "tillSeen", "heldBaskets", "catalog", "shopFlags", "tillLog", "savedPrinter", "topSellers", "shiftPulse", "firstRun", "groceryDrafts", "groceryBasket", "groceryForwards", "spoils", "stockTake"];
type SecureField = (typeof SECURE_FIELDS)[number];
type PlainField = (typeof PLAIN_FIELDS)[number];
declare function isProvisionalId(id: string): boolean;
/**
 * Queued work from the v1 layout that could not be tied to a shop. It is kept, never sent: no sync
 * engine drains this namespace, so it cannot reach the wrong shop.
 */
declare const UNOWNED_ID = "unowned";
/** One outbox per shop (plan §5.4). The sync engine of a shop drains only this key. */
declare function outboxKey(tenantId: string): string;
/** Where a queue that could not be read is kept, for support, while a fresh one takes its place. */
declare function unreadableOutboxKey(tenantId: string): string;
/** What a shop-less install called a store that has not been confirmed by the server yet. */
declare function provisionalId(slug: string): string;

declare function readTenantSecret(field: SecureField, tenantId?: string): Promise<string | null>;
declare function writeTenantSecret(field: SecureField, value: string, tenantId?: string): Promise<boolean>;
declare function removeTenantSecret(field: SecureField, tenantId?: string): Promise<void>;
declare function readTenantValue(field: PlainField, tenantId?: string): Promise<string | null>;
declare function writeTenantValue(field: PlainField, value: string, tenantId?: string): Promise<boolean>;
declare function removeTenantValue(field: PlainField, tenantId?: string): Promise<void>;

declare function withOutboxLock<T>(work: () => Promise<T>): Promise<T>;

declare function ensureStorageReady(): Promise<void>;

/**
 * Quantities of stock are counted in ten-thousandths, as whole numbers, everywhere inside the app. The server keeps
 * four decimals, and "how much to add" is a subtraction of two quantities: as ordinary floating-point numbers
 * 10.3 - 7.1 is 3.1999999999999993, and a stock change a hair off is a stock change that is wrong. A quantity is a
 * plain number only at the edges: on the screen, and in what is sent to the server.
 */
/** Ten-thousandths in one unit (one item, one kilogram). */
declare const QTY_SCALE = 10000;
/** The most one typed quantity can be: a million units. A slipped finger, not a count. */
declare const MAX_QTY_UNITS: number;
type QtyProblem = 'empty' | 'not_a_number' | 'too_many_decimals' | 'zero' | 'too_big';
type QtyEntry = {
    ok: true;
    units: number;
} | {
    ok: false;
    problem: QtyProblem;
};
/**
 * What a person typed into a quantity box, in ten-thousandths, or why it is not a quantity.
 * "12", "2.5", ".5" and "1." are quantities; "1,5", "1e3", "-2", "1.23456" and "" are not. Zero is a quantity only
 * where `allowZero` says a count of nothing is meaningful (a stock take, "set to"), never for a write-off.
 */
declare function parseQty(text: string, options?: {
    allowZero?: boolean;
}): QtyEntry;
/** What to tell the person about a quantity that cannot be used. */
declare function qtyProblemWords(problem: QtyProblem): string;
/**
 * A quantity as the server sent it (a number, or a number in text) in ten-thousandths. Null for anything that is not
 * a number, or is absurdly large. A negative quantity is kept: a shop that allows selling below zero has one.
 */
declare function qtyToUnits(value: unknown): number | null;
/** Ten-thousandths as the number the server is sent. Exact to four decimals. */
declare function unitsToQty(units: number): number;
/** 25000 -> "2.5", 10000 -> "1", -30000 -> "-3", 12345000 -> "1,234.5". The thousands are grouped by commas. */
declare function formatQty(units: number): string;

/**
 * An item as the Stock and Grocery apps need it: a name to find it by, how much is on the shelf at one branch, and
 * what it costs and sells for. Read defensively from `GET /api/v1/items`: a row that is not an item is left out, and a
 * number that is missing is "unknown", never zero. An unknown on-hand must never be turned into "0", because the next
 * thing the app does with it is work out how much to add.
 */
type StockItem = {
    id: string;
    name: string;
    variantName: string | null;
    sku: string | null;
    barcode: string | null;
    /** On hand at the branch that was asked for, in ten-thousandths. Null when the server did not say (no branch was given). */
    onHandUnits: number | null;
    weighed: boolean;
    unitType: string | null;
    /** A pack of another item. Its stock is held on the parent item and cannot be changed here. */
    packageVariant: boolean;
    active: boolean;
    sellable: boolean;
    /** The department (item type) this product is filed under, when the shop files them. */
    itemTypeId: string | null;
    buyingCents: number | null;
    sellingCents: number | null;
};
/**
 * A price as the server sent it (a number, or a number in text) in whole cents, rounding half up. Null when it is not
 * a price: missing, negative, not a number, or absurdly large. Read from the decimal digits, not by multiplying a
 * floating-point number, so 1.005 is 101 cents and not 100.
 */
declare function priceToCents(value: unknown): number | null;
/** One row of `GET /api/v1/items`. Null for anything that is not an item with an id and a name, and for a heading that only groups others. */
declare function readStockItem(raw: unknown): StockItem | null;
/** "Milk" or "Milk (1 litre)": what to call the item on a screen. */
declare function itemLabel(item: {
    name: string;
    variantName: string | null;
}): string;
type ItemsPage = {
    items: StockItem[];
    /** Rows the server sent, before any were left out. Page by this, not by `items.length`. */
    seen: number;
    total: number | null;
    more: boolean;
};
/**
 * A page of items. The server's page is a Spring page: `content` and the counts either beside it or inside a `page`
 * object, depending on the version. Null when the answer is not a page, which is a failed read, not an empty list.
 */
declare function readItemsPage(raw: unknown, asked: {
    page: number;
    size: number;
}): ItemsPage | null;
type ItemsQuery = {
    branchId: string;
    search?: string;
    barcode?: string;
    /** Only items in this category. The server does the narrowing. */
    categoryId?: string;
    /** Only items of this department (an item type). The server does the narrowing. */
    itemTypeId?: string;
    lowStock?: boolean;
    zeroStock?: boolean;
    page?: number;
    size?: number;
};
declare const ITEM_PAGE_SIZE = 40;
/** What was typed in a search box: a barcode (only digits, six to fourteen of them) or words to search names and codes for. */
declare function searchTerms(typed: string): {
    barcode: string;
} | {
    search: string;
} | null;
/** The path to read one page of items for a branch. Only what is set goes in, and every value is encoded. */
declare function itemsPath(query: ItemsQuery): string;
/**
 * The shop's departments, as the till calls them: the categories its products are filed under.
 *
 * Read once and kept by the screen that shows the rail. A shop with none gets an empty list, and a failure says so by
 * throwing, so a rail can be absent rather than wrong.
 */
type CategoryOption = {
    id: string;
    name: string;
};
declare function readCategories(raw: unknown): CategoryOption[];
declare function fetchCategories(api: ApiClient): Promise<CategoryOption[]>;
/**
 * A department: an item type, as the web counter calls them. Its colour and icon are the shop's own, so a department
 * looks the same on the counter as it does on the till and in the portal.
 */
type DepartmentOption = {
    id: string;
    label: string;
    color: string | null;
    sortOrder: number;
};
declare function readDepartments(raw: unknown): DepartmentOption[];
declare function fetchDepartments(api: ApiClient): Promise<DepartmentOption[]>;

type SetOnHandProblem = 'current_unknown' | 'pack_variant';
type SetOnHandPlan = {
    kind: 'same';
} | {
    kind: 'increase';
    units: number;
    unitCostCents: number;
    note: string;
} | {
    kind: 'decrease';
    units: number;
    note: string;
};
/**
 * What it takes to make the shelf hold `targetUnits`, given what a fresh read says it holds now. Refused when the
 * current stock is not known (a change is a subtraction, and there is nothing to subtract from) and for a pack, whose
 * stock lives on another item. A shop that has sold below zero has a negative current stock, and is topped up from it.
 */
declare function planSetOnHand(input: {
    currentUnits: number | null;
    targetUnits: number;
    buyingCents: number | null;
    packageVariant: boolean;
    note?: string;
}): {
    ok: true;
    plan: SetOnHandPlan;
} | {
    ok: false;
    problem: SetOnHandProblem;
};
/** The body of `POST /api/v1/inventory/stock-increase`. */
declare function stockIncreaseBody(branchId: string, itemId: string, plan: {
    units: number;
    unitCostCents: number;
    note: string;
}): {
    branchId: string;
    itemId: string;
    quantity: number;
    unitCost: number;
    notes: string;
};
/** The path that asks which batches the server would take `units` from. */
declare function allocationPreviewPath(itemId: string, branchId: string, units: number): string;
type DecreaseCall = {
    batchId: string;
    units: number;
};
/**
 * The batch-by-batch removals that make up a decrease, read from the server's allocation preview. Checked BEFORE the
 * first write: a preview that cannot cover the whole amount is refused outright, so a decrease is never started and
 * left half done. Lines that are not a batch with a positive amount are ignored, and the last line is cut to what is
 * still wanted, so never more than was asked for is removed.
 */
declare function planDecreaseCalls(preview: unknown, wantedUnits: number): {
    ok: true;
    calls: DecreaseCall[];
} | {
    ok: false;
    problem: 'none' | 'short';
    coveredUnits: number;
};
/** The body of `POST /api/v1/inventory/batch-decrease`. */
declare function batchDecreaseBody(call: DecreaseCall, note: string): {
    batchId: string;
    quantity: number;
    reason: string;
};
/** The reasons a person can give for a write-off. The keys are the server's wastage categories. */
declare const SPOIL_REASONS: readonly [{
    readonly key: "SPOILAGE";
    readonly label: "Spoiled";
}, {
    readonly key: "EXPIRED";
    readonly label: "Expired";
}, {
    readonly key: "BREAKAGE";
    readonly label: "Broken or damaged";
}, {
    readonly key: "THEFT";
    readonly label: "Stolen";
}, {
    readonly key: "SAMPLE";
    readonly label: "Sample or tasting";
}, {
    readonly key: "PERSONAL_USE";
    readonly label: "Own use";
}, {
    readonly key: "OTHER";
    readonly label: "Something else";
}];
type SpoilReason = (typeof SPOIL_REASONS)[number]['key'];
declare function isSpoilReason(value: unknown): value is SpoilReason;
/**
 * What a written-off unit is valued at. The server refuses a write-off with no cost, so an item that has no buying
 * price is valued at its selling price, and one with neither at one cent, the same fallback the web counter uses.
 * That is a book value, not a real one: it is why a shop with items missing a buying price sees odd write-off totals.
 */
declare function spoilUnitCostCents(item: {
    buyingCents: number | null;
    sellingCents: number | null;
}): number;
/** The body of `POST /api/v1/inventory/wastage`. */
declare function wastageBody(input: {
    branchId: string;
    itemId: string;
    units: number;
    unitCostCents: number;
    reason: SpoilReason;
    note?: string;
}): {
    branchId: string;
    itemId: string;
    quantity: number;
    unitCost: number;
    reason: string;
    wastageReason: "SPOILAGE" | "EXPIRED" | "BREAKAGE" | "THEFT" | "SAMPLE" | "PERSONAL_USE" | "OTHER";
};
/** One stock entry of an item's history (`GET /api/v1/items/{id}/timeline`), reduced to what recognising a write-off needs. */
type HistoryEntry = {
    eventType: string;
    branchId: string | null;
    deltaUnits: number;
    /** The operation that made it. Every batch a write-off took from carries the same one. */
    operationId: string;
    at: number | null;
};
/** The stock-movement entries of a history answer. Null when the answer is not a history, which is a failed read and not "no history". */
declare function readHistory(raw: unknown): HistoryEntry[] | null;
/**
 * How far apart the phone's clock and the server's may be, and a write-off in an item's history still be taken for the
 * one the phone sent. A history whose oldest entry is newer than the moment a write-off was sent, less this, may have
 * pushed that write-off out of what the server returned.
 */
declare const HISTORY_SLACK_MS: number;
/**
 * An item's history as the server answered, with how far back it reaches. The server returns the newest entries only,
 * at most `limit` of them: an answer that came back full may have cut off older ones, and for anything that happened
 * before its oldest entry "it is not in the history" proves nothing.
 */
type ItemHistory = {
    entries: HistoryEntry[];
    full: boolean;
    oldestAt: number | null;
};
/** The history and its reach. Null when the answer is not a history, which is a failed read and not "no history". */
declare function readItemHistory(raw: unknown, limit: number): ItemHistory | null;
/** The write-offs one branch already has in an item's history, by operation, with what each took off the shelf in all. */
declare function spoilOperations(history: readonly HistoryEntry[], branchId: string): Map<string, {
    units: number;
    at: number | null;
}>;
/**
 * Whether a write-off the app is not sure went through is in the item's history now. `known` is every write-off
 * operation the history already held BEFORE the attempt was sent, so only a new one counts, and it counts only when it
 * took exactly the amount that was asked for, at that branch, and not before the attempt started (`since`, with a
 * slack for the phone's clock). A match is "yes, it went through"; no match is only "not seen": the server may still be
 * working on it, so the caller asks the person rather than sending it again by itself.
 */
declare function findNewSpoil(history: readonly HistoryEntry[], input: {
    branchId: string;
    units: number;
    known: ReadonlySet<string>;
    since?: number;
    slackMs?: number;
}): {
    operationId: string;
} | null;
type WriteFailure = {
    kind: 'doubt';
} | {
    kind: 'refused';
    words: string;
};
/**
 * What a failed stock write means. A request with no answer (no signal, a timeout, a busy server, a web page where the
 * server's answer should be) may or may not have been applied: that is "doubt", and the caller must look at the item
 * before it writes again. Anything the server turned down says so by its status, and changed nothing. The status is
 * read, never the English.
 */
declare function classifyWrite(error: unknown): WriteFailure;

/**
 * Who may do which stock job on a phone. The server is the authority and refuses what a person may not do; this only
 * decides which buttons to show, so nobody is offered a job that is certain to be turned down. It follows the web
 * grocery counter's rules (`grocery-counter-access`) so a shop's switches mean the same on both.
 *
 * One thing the phone cannot see: `GET /api/v1/me` lists only the permissions of a person's role. The server also hands
 * `inventory.write` to a stock manager, and to a grocery clerk when the shop allows the clerk to edit stock or write
 * off spoils, without putting it on the role. So a role is read here as well as the permission list.
 */
type AccessUser = {
    roleKey: string | null | undefined;
    permissions: readonly string[];
};
type StockSettings = {
    /** A grocery counter may write off spoiled stock. */
    spoils: boolean;
    /** A grocery counter may set how much is on the shelf. */
    stockEdit: boolean;
    /** A grocery counter may place Path A supplier orders. */
    orderPad: boolean;
};
/** What a shop that has changed nothing allows: jobs on. Used until the shop's own answer is in, and when it cannot be read. */
declare const DEFAULT_STOCK_SETTINGS: StockSettings;
/**
 * The switches from `GET /api/v1/businesses/me` (`inventory.stockLevels`). Only a switch that is plainly `false` turns a
 * job off; a missing one, or one of the wrong type, leaves it on, as the web does.
 */
declare function parseStockSettings(body: unknown): StockSettings;
declare const INVENTORY_WRITE = "inventory.write";
declare const STOCK_TAKE_RUN = "stocktake.run";
declare const STOCK_TAKE_APPROVE = "stocktake.approve";
declare const INVENTORY_TRANSFER = "inventory.transfer";
declare const CATALOG_ITEMS_READ = "catalog.items.read";
declare const INVENTORY_READ = "inventory.read";
declare const GROCERY_INVOICES_CREATE = "grocery.invoices.create";
declare const GROCERY_INVOICES_PAY = "grocery.invoices.pay";
declare const GROCERY_INVOICES_CANCEL = "grocery.invoices.cancel";
declare const PURCHASING_PATH_A_WRITE = "purchasing.path_a.write";
/** The jobs the grocery counter can be switched to. */
type CounterMode = 'sell' | 'spoils' | 'stockEdit';
/**
 * Whether this person may sell at the grocery counter — that is, build a basket and forward it to the till as an
 * invoice. It needs the permission to create an invoice (`grocery.invoices.create`); a grocery-counter role has it by
 * default, the way the server delegates it. Someone in the app only to edit stock or write off spoils does not sell,
 * and is not shown the counter.
 */
declare function maySellAtCounter(user: AccessUser): boolean;
/**
 * Whether this person may place Path A supplier orders from the grocery app
 * (web `canGroceryOrderPad`).
 */
declare function mayOrderAtCounter(user: AccessUser, settings: StockSettings): boolean;
/**
 * The modes this person is offered at the grocery counter. Selling is there only for someone who may create an
 * invoice; someone who may write stock, or who works the grocery counter, also sees Spoils and Edit stock unless the
 * shop has switched the job off.
 */
declare function counterModes(user: AccessUser, settings: StockSettings): CounterMode[];
/**
 * In the Stock app: whether this person may set stock and write it off. The grocery counter's switches are about
 * grocery clerks and do not apply here. A stock manager has the right by default (the server delegates it).
 */
declare function stockAppMayWrite(user: AccessUser): boolean;
/** Whether this person may start and count a stock take. */
declare function mayCountStock(user: AccessUser): boolean;
/** Whether this person may close a stock take (the server needs `stocktake.approve`). */
declare function mayCloseStockTake(user: AccessUser): boolean;
/** Whether this person may send, receive and cancel transfers between branches. */
declare function mayMoveStock(user: AccessUser): boolean;

/** Who may see which departments — enough of the signed-in person for the rail. */
type DepartmentScopeUser = {
    roleKey: string | null | undefined;
    itemTypeIds: readonly string[];
};
/**
 * Departments this person may browse, matching the web dashboard rail:
 * assignments restrict; grocery clerks with none see nothing; other roles with
 * none see every active department.
 */
declare function visibleDepartments(all: readonly DepartmentOption[], user: DepartmentScopeUser): DepartmentOption[];
/**
 * Department IDs for GET /suppliers. `undefined` = no filter; `[]` = no
 * suppliers (grocery clerk with no assignments).
 */
declare function supplierItemTypeScope(user: DepartmentScopeUser): readonly string[] | undefined;

/**
 * Keeps one piece of a shop's data on the phone: the sale being rung up at the grocery counter, the stock take being
 * counted. The data lives in memory while the app runs, so every screen sees the same copy, and is written down after
 * each change, so a closed app or a flat battery loses nothing.
 *
 * Two rules the Cashier learned the hard way (its held baskets):
 *  - A read that FAILED is never taken for "nothing there". If the data could not be read and the app then saved over
 *    it, everything kept would be thrown away. So a keeper refuses changes until a read has worked.
 *  - Saves never overlap, and the last one asked for is the last one written, however slowly the earlier ones finish.
 */
interface KeeperStorage {
    read: () => Promise<string | null>;
    /** Writes the text, or removes what is kept when the value is null. Answers whether it landed. A failure may reject. */
    write: (value: string | null) => Promise<boolean>;
}
interface Keeper<T> {
    /** Reads what is kept (once; later calls answer from memory). A failure to read rejects and leaves the keeper unloaded. */
    load: (now: number) => Promise<T>;
    get: () => T;
    isLoaded: () => boolean;
    /** Changes the data and writes it down. Throws before the first successful `load`. Returning the same value changes nothing. */
    update: (change: (current: T) => T) => T;
    subscribe: (listener: () => void) => () => void;
    /** Settles when every write asked for so far has finished. Answers whether the last one landed. */
    saved: () => Promise<boolean>;
}
declare function createKeeper<T>(options: {
    initial: T;
    parse: (text: string | null, now: number) => T;
    /** The text to keep, or null when there is nothing worth keeping (the stored value is then removed). */
    serialize: (state: T) => string | null;
    storage: KeeperStorage;
}): Keeper<T>;

/**
 * The write-offs a person is listing, and the one that is on its way to the server. A write-off is the one stock change
 * the app cannot work out again from a fresh read (the server does not read an Idempotency-Key, and "write off 2" sent
 * twice writes off 4), so the list remembers, before it sends, exactly which write-off is in flight and what the item's
 * history already held. If the app is closed, or the answer is lost, that memory is what lets it find out afterwards
 * whether the write-off happened, instead of guessing.
 */
type SpoilLine = {
    itemId: string;
    name: string;
    units: number;
    unitCostCents: number;
    /** Sold by weight or measure, so a fraction of a unit is a real quantity. */
    weighed: boolean;
};
type InFlight = {
    itemId: string;
    name: string;
    units: number;
    unitCostCents: number;
    reason: SpoilReason;
    /** The branch it was sent from. It is looked for there, whoever is at the counter when the answer is checked. */
    branchId: string;
    /** The write-off operations the item's history already held before this one was sent. */
    baseline: string[];
    startedAt: number;
};
type SpoilList = {
    ownerId: string;
    branchId: string;
    savedAt: number;
    reason: SpoilReason;
    lines: SpoilLine[];
    inFlight: InFlight | null;
};
declare const MAX_SPOIL_LINES = 100;
/** A list left alone this long is not offered again: it is a past shift's list. A write-off in flight is never let go by the clock. */
declare const SPOIL_LIST_LIFETIME_MS: number;
/** The most history ids kept with a write-off in flight. */
declare const MAX_BASELINE = 200;
declare function emptySpoils(owner: {
    ownerId: string;
    branchId: string;
}, now: number): SpoilList;
/**
 * The list for whoever is at the counter. Someone else's lines, or another branch's, are not shown to them and not kept
 * for them; a write-off in flight stays, whoever is signed in, because it is about the shelf and not about the person.
 */
declare function claimSpoils(list: SpoilList | null, owner: {
    ownerId: string;
    branchId: string;
}, now: number): SpoilList;
declare function addSpoil(list: SpoilList, item: {
    id: string;
    name: string;
    weighed: boolean;
    buyingCents: number | null;
    sellingCents: number | null;
}, units: number, now: number): {
    ok: true;
    list: SpoilList;
} | {
    ok: false;
    why: 'bad_quantity' | 'too_big' | 'too_many' | 'busy';
};
declare function setSpoilUnits(list: SpoilList, itemId: string, units: number, now: number): SpoilList;
declare function removeSpoil(list: SpoilList, itemId: string, now: number): SpoilList;
declare function setReason(list: SpoilList, reason: SpoilReason, now: number): SpoilList;
declare function clearSpoils(list: SpoilList, now: number): SpoilList;
/** The line to send next: the first one, when nothing is in flight. */
declare function nextSpoil(list: SpoilList): SpoilLine | null;
/** Writes down that a line is about to be sent, with what the item's history held before. Refused when another is already in flight. */
declare function beginSpoil(list: SpoilList, line: SpoilLine, baseline: readonly string[], now: number): SpoilList | null;
/** What writing a write-off down needs from the keeper. */
type SpoilKeeper = Pick<Keeper<SpoilList | null>, 'update' | 'isLoaded'>;
/**
 * Writes down that a line is about to be sent, and says whether THIS call is the one that wrote it. When a write-off is
 * already in flight (another pass began one a moment ago, or the screen was closed and opened again while an earlier
 * pass was still going) nothing is changed and the answer is false: that caller must not send, or the server takes the
 * same write-off off twice. Also false when what is kept on the phone has not been read yet.
 */
declare function beginSending(keeper: SpoilKeeper, line: SpoilLine, baseline: readonly string[], now: number): boolean;
/** The write-off is known to have happened: its line is done and nothing is in flight. */
declare function spoilDone(list: SpoilList, now: number): SpoilList;
/** The server refused the write-off, or it is known not to have happened: the line stays, nothing is in flight. */
declare function spoilNotDone(list: SpoilList, now: number): SpoilList;
/** The person gave up on the line that was in doubt. */
declare function spoilSkipped(list: SpoilList, now: number): SpoilList;
/** How long after sending a write-off its absence from the item's history still proves nothing: the server may be slow. */
declare const SPOIL_SETTLE_MS: number;
type SpoilVerdict = 'done' | 'not_seen' | 'too_soon' | 'too_busy' | 'unknown';
/**
 * Whether a write-off whose answer was lost went through, from the item's history now. `done` is only ever a match: a new
 * write-off for exactly this amount at this branch since it was sent. No match is `not_seen`, and only once the server has
 * had time to finish (`too_soon` before that), so a slow server is never mistaken for a write-off that did not happen.
 * A history that came back full and does not reach back to the moment it was sent may have pushed it out: that is
 * `too_busy`, and the person is told the phone cannot tell. Without a history to look at the answer is `unknown`.
 * Whoever acts on `not_seen` or `too_busy` is the person, not the app. It is looked for at the branch it was sent from.
 */
declare function spoilVerdict(history: ItemHistory | null, flight: InFlight, now: number): SpoilVerdict;
declare function encodeSpoils(list: SpoilList | null): string | null;
/** The list kept on the phone. Null when there is none or it is unreadable; an old list is let go, unless a write-off is still in doubt. */
declare function decodeSpoils(text: string | null, now: number): SpoilList | null;

/**
 * The one keeper of a piece of a shop's data on this phone. Every screen of an app asks for it by name and gets the same
 * one, so two saves never overlap and what one screen changed is what another sees. It is made once per shop and field,
 * and let go when the phone stops working for that shop.
 */
type KeeperCodec<T> = {
    initial: T;
    parse: (text: string | null, now: number) => T;
    /** The text to keep, or null when there is nothing worth keeping (what was kept is then removed). */
    serialize: (value: T) => string | null;
};
declare function tenantKeeper<T>(field: PlainField, tenantId: string, codec: KeeperCodec<T>): Keeper<T>;
/** Lets go of what is held in memory for a shop. What is kept on the phone is not touched. */
declare function dropTenantKeepers(tenantId: string): void;

/**
 * A request that never answers must not hold a screen, or a sender, forever. After `ms` the wait ends with a
 * `TimeoutError`, which is not an `ApiError`, so every caller reads it as "no answer": the request may still reach the
 * server later. Nothing sent through here may depend on "no answer" meaning "it did not happen".
 */
declare class TimeoutError extends Error {
    readonly ms: number;
    constructor(ms: number);
}
declare function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>;
/** How long a read, and a write, may take before the app stops waiting for the answer. */
declare const READ_TIMEOUT_MS = 20000;
declare const WRITE_TIMEOUT_MS = 60000;

/** 125050 -> "1,250.50". Always two decimals, thousands grouped by commas. A figure that is not a number shows as a dash. */
declare function formatCents(cents: number): string;
/** 125050 -> "KES 1,250.50". */
declare function formatKes(cents: number): string;
/**
 * What a failed read means, as a sentence for the person. The status is read, never the server's own words: the app
 * says what it can stand behind. Anything with no status (no signal, a request that took too long) is "could not reach".
 */
declare function readFailureWords(error: unknown): string;

declare const TILL_DEVICE_HEADER = "X-Till-Device-Id";
/**
 * Durable till id for shift scoping, one per shop on this phone. Empty when there is no shop (the
 * id is not made up for nobody) or storage fails.
 */
declare function getOrCreateTillDeviceId(tenantId?: string): Promise<string>;

export { APP_ENTRY_PERMISSIONS, APP_JOBS, APP_NAMES, type AccessUser, type ApiClient, type ApiClientConfig, ApiError, type AuthTokenPayload, type AuthTokens, BRANCH_LOCKED_ROLE_KEYS, type BootResult, type BranchOption, CATALOG_ITEMS_READ, type CategoryOption, type CounterMode, type CreateApiClientOptions, DEFAULT_PLATFORM_CONFIG, DEFAULT_PLATFORM_HOST_SUFFIX, DEFAULT_STOCK_SETTINGS, type DecreaseCall, type DepartmentOption, type DepartmentScopeUser, type FailureNotice, GROCERY_INVOICES_CANCEL, GROCERY_INVOICES_CREATE, GROCERY_INVOICES_PAY, HISTORY_SLACK_MS, type HistoryEntry, INVENTORY_READ, INVENTORY_TRANSFER, INVENTORY_WRITE, ITEM_PAGE_SIZE, type IdempotencyOptions, type InFlight, type ItemHistory, type ItemsPage, type ItemsQuery, type Keeper, type KeeperCodec, type KeeperStorage, type KnownStaff, type LoginResponse, type LoginResult, MAX_BASELINE, MAX_DISPLAY_NAME_LENGTH, MAX_KNOWN_STAFF, MAX_QTY_UNITS, MAX_SPOIL_LINES, MIN_SEARCH_LENGTH, NATIVE_KIOSK_CLIENT_HEADER, NATIVE_KIOSK_CLIENT_VALUE, type OpenStoreResult, PAIRING_CODE_MAX_LENGTH, PAIRING_CODE_MIN_LENGTH, PURCHASING_PATH_A_WRITE, type PairingCodeParse, type PairingLookup, type PairingPreview, type PairingProblem, type PairingResult, type ParsedTenantDeepLink, type PlatformConfig, type PlatformSupport, type PreviewOptions, type ProblemResponse, type PublicMobileApp, type PublicMobileBranding, type PublicMobileConfig, type PublicMobileDeepLinks, type PublicMobileStoreLinks, QTY_SCALE, type QtyEntry, type QtyProblem, READ_TIMEOUT_MS, type RefreshOutcome, type RegisterResponse, SHOP_CODE_ALPHABET, SHOP_CODE_MAX_LENGTH, SHOP_CODE_MIN_LENGTH, SPOIL_LIST_LIFETIME_MS, SPOIL_REASONS, SPOIL_SETTLE_MS, STAFF_APPS, STOCK_TAKE_APPROVE, STOCK_TAKE_RUN, type ScanTarget, type SearchResult, type SetOnHandPlan, type SetOnHandProblem, type SetupAction, type SetupContext, type SetupRequired, type SetupRequirement, type SetupStep, type ShopCodeParse, type SignedInUser, type SpoilKeeper, type SpoilLine, type SpoilList, type SpoilReason, type SpoilVerdict, type StaffApp, type StaffUser, type StockItem, type StockSettings, type StoreAudience, type StoreHit, StoreLookupError, type StoreQuery, type StoreResult, type StoreSnapshot, StoreSwitchBlockedError, type SwitchResult, TILL_DEVICE_HEADER, type TenantContext, type TenantDeepLinkIntent, type TillAccessAsk, type TillAnswer, type TillCheck, TimeoutError, UNOWNED_ID, type UnavailableReason, type UnsentProbe, type UnsentSummary, type UpdateState, WRITE_TIMEOUT_MS, type WhiteLabelThemeColors, type WriteFailure, activateStore, addKnownStaff, addSpoil, allocationPreviewPath, apiRequest, appsThatFit, asSetupRequired, batchDecreaseBody, beginSending, beginSpoil, bootstrapStore, bootstrapTenant, checkTillRegistration, claimSpoils, classifyStore, classifyWrite, cleanDisplayText, cleanSearchText, clearActiveStore, clearKnownStaff, clearSpoils, clearTenant, clearTokens, compareVersions, counterModes, createApiClient, createKeeper, decodeSpoils, describeFailure, describeSetup, describeShopCodeProblem, describeStoreResult, dropTenantKeepers, emptySpoils, encodeSpoils, endSession, ensureStorageReady, fetchBranches, fetchCategories, fetchDepartments, fetchMe, fetchPlatformConfig, fetchPublicMobileConfig, fetchShiftsDisabled, findNewSpoil, firstName, fitsApp, forgetKnownStaff, forgetStore, forgetTillRegistered, formatApiProblemMessage, formatCents, formatKes, formatQty, generateIdempotencyKey, getAccessToken, getActiveTenantId, getAppVersion, getEmbeddedTenantSlug, getOrCreateTillDeviceId, getRefreshToken, getTenantDisplayName, getTenantHeaders, getUnsentSummary, getWhiteLabelExtra, interpretTillAnswer, isApiError, isBranchLockedRole, isProvisionalId, isShopperDeepLinkIntent, isSpoilReason, isStaffDeepLinkIntent, isWhiteLabelApp, itemLabel, itemsPath, listRememberedStores, loadActiveStore, loadKnownStaff, loadStoreById, loadTenant, loginWithPassword, loginWithPin, logout, markSessionEnded, mayCloseStockTake, mayCountStock, mayMoveStock, mayOrderAtCounter, maySellAtCounter, nextSpoil, openRememberedStore, openStore, outboxKey, parseKnownStaff, parseMe, parsePairingCode, parsePairingPreview, parsePairingScan, parsePlatformConfig, parseProblem, parseQty, parseScan, parseShopCode, parseShopCodeLink, parseSignedInUser, parseStockSettings, parseStoreInput, parseTenantDeepLink, parseVersion, pinLoginBranchId, pinnedTo, plainHost, planDecreaseCalls, planSetOnHand, previewDeepLink, previewPairing, previewStore, previewStoreByCode, priceToCents, provisionalId, publicApiRequest, qtyProblemWords, qtyToUnits, readApiError, readApiErrorMessage, readAuthTokens, readCategories, readCookieFromSetCookie, readDepartments, readFailureWords, readHistory, readItemHistory, readItemsPage, readSetCookieLines, readShiftsDisabled, readStockItem, readTenantSecret, readTenantValue, redeemPairing, refreshAccessToken, registerAccount, registerUnsentProbe, rememberStaff, rememberTillRegistered, removeKnownStaff, removeSpoil, removeTenantSecret, removeTenantValue, requestTillAccess, resendVerificationEmail, resolveIdempotencyKey, resolveMobileApiBaseUrl, resolveShopperStore, resolveTenant, resolveTenantByEmail, resolveTenantFromDeepLink, revalidateActive, searchStores, searchTerms, serializeKnownStaff, sessionWasEnded, setReason, setSpoilUnits, shiftsAreDisabled, spoilDone, spoilNotDone, spoilOperations, spoilSkipped, spoilUnitCostCents, spoilVerdict, stockAppMayWrite, stockIncreaseBody, storeTokens, subscribeActiveStore, subscribeActiveStoreId, supplierItemTypeScope, switchStore, tenantHost, tenantHostSuffix, tenantKeeper, unitsToQty, unreadableOutboxKey, unwrapOpened, updateStateFor, useTenantDeepLink, visibleDepartments, wastageBody, webHomeForRole, withOutboxLock, withTimeout, writeTenantSecret, writeTenantValue };
