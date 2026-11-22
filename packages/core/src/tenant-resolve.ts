import { tenantHostSuffix } from './mobile-config';
import { isProvisionalId, isStorableTenantId } from './storage-keys';
import type { StoreAudience, StoreResult, StoreSnapshot } from './tenant-types';

/**
 * Finding a shop on the server (plan §5.2). Network only: nothing here reads or writes storage.
 *
 * Resolution is host first. A typed address such as "acme.kiosk.ke" or "shop.example.com" is a host
 * and goes to host/resolve as typed. A bare name such as "acme" is a slug and goes to the mobile
 * config endpoint, whose answer carries the shop's real host. No host is ever guessed from a slug.
 * Nothing falls back to a branch id: the tenant id is the one the server returns, or there is no store.
 */

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{1,5})?$/;

/**
 * Labels the platform never gives to a shop. Mirrors ReservedHostnameGuard.HARD_RESERVED on the
 * backend; a stale entry here only costs one pointless request.
 */
const RESERVED_LABELS = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'ftp', 'cdn', 'static', 'assets', 'status', 'docs', 'help',
  'support', 'billing', 'pay', 'webhook', 'webhooks', 'super-admin', 'superadmin', 'platform', 'null',
  'undefined', 'marketplace', 'supplier', 'suppliers', 'trade', 'wholesale', 'portal', 's', 'shop', 'shops',
]);

const DEFAULT_TIMEOUT_MS = 10_000;

export type StoreQuery = { kind: 'slug'; slug: string } | { kind: 'host'; host: string };

export interface PreviewOptions {
  /** A shopper cannot open a shop whose storefront is switched off. Its own staff can. */
  audience: StoreAudience;
  timeoutMs?: number;
}

/** What the person typed, as a slug or a host. Null when it is neither (an email, a sentence, nothing). */
export function parseStoreInput(input: string): StoreQuery | null {
  const raw = input.trim().toLowerCase();
  if (!raw) {
    return null;
  }
  const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const hostPart = (withoutScheme.split(/[/?#]/)[0] ?? '').replace(/\.$/, '');
  if (!hostPart || hostPart.includes('@')) {
    return null;
  }
  if (!hostPart.includes('.')) {
    return SLUG_RE.test(hostPart) ? { kind: 'slug', slug: hostPart } : null;
  }
  return HOST_RE.test(hostPart) ? { kind: 'host', host: hostPart } : null;
}

/** "acme" for "acme.kiosk.ke" on the platform domain; null for custom domains and reserved labels. */
export function platformSlugFromHost(host: string): string | null {
  const suffix = tenantHostSuffix().trim().toLowerCase().replace(/^\./, '');
  if (!suffix) {
    return null;
  }
  const bare = host.replace(/:\d+$/, '');
  if (!bare.endsWith(`.${suffix}`)) {
    return null;
  }
  const label = bare.slice(0, bare.length - suffix.length - 1);
  return SLUG_RE.test(label) && !RESERVED_LABELS.has(label) ? label : null;
}

type Fetched =
  | { kind: 'response'; status: number; body: unknown; retryAfter: string | null }
  | { kind: 'offline' };

async function getJson(url: string, timeoutMs: number): Promise<Fetched> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    let body: unknown = null;
    if (response.ok) {
      try {
        body = await response.json();
      } catch {
        // A captive portal or a proxy answered with a page that is not ours.
        return { kind: 'offline' };
      }
    }
    return {
      kind: 'response',
      status: response.status,
      body,
      retryAfter: response.headers?.get?.('retry-after') ?? null,
    };
  } catch {
    return { kind: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.ceil(seconds), 3600);
  }
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.min(Math.max(Math.ceil((at - Date.now()) / 1000), 0), 3600);
}

/** The answers that mean "no answer yet". Everything else is the caller's to interpret. */
function transientFailure(fetched: Fetched): StoreResult | null {
  if (fetched.kind === 'offline') {
    return { kind: 'offline' };
  }
  if (fetched.status === 429) {
    return { kind: 'rate_limited', retryAfterSec: parseRetryAfter(fetched.retryAfter) };
  }
  if (fetched.status >= 500 || fetched.status === 408) {
    return { kind: 'offline' };
  }
  return null;
}

function normalizeStatus(raw: unknown): string {
  return typeof raw === 'string' && raw.trim() ? raw.trim().toUpperCase() : 'ACTIVE';
}

function validId(id: unknown): id is string {
  return isStorableTenantId(id) && !isProvisionalId(id);
}

interface MobileConfigBody {
  tenantId?: string;
  slug?: string;
  displayName?: string;
  tenantHost?: string;
  tenantStatus?: string;
  storefrontEnabled?: boolean;
  branding?: Record<string, unknown> | null;
}

function fromMobileConfig(body: MobileConfigBody | null, fetchedAt: string): StoreSnapshot | null {
  if (!body || !validId(body.tenantId) || typeof body.slug !== 'string' || !body.slug) {
    return null;
  }
  return {
    businessId: body.tenantId,
    slug: body.slug,
    host: (body.tenantHost ?? '').trim().toLowerCase(),
    displayName: body.displayName?.trim() || body.slug,
    branding: body.branding ?? {},
    status: normalizeStatus(body.tenantStatus),
    storefrontEnabled: body.storefrontEnabled !== false,
    fetchedAt,
  };
}

interface HostResolveBody {
  mapped?: boolean;
  tenantId?: string;
  tenantName?: string;
  slug?: string;
  status?: string;
  branding?: { displayName?: string | null } | null;
  storefrontEnabled?: boolean;
}

function fromHostResolve(host: string, body: HostResolveBody | null, fetchedAt: string): StoreSnapshot | null {
  if (!body || body.mapped === false || !validId(body.tenantId) || typeof body.slug !== 'string' || !body.slug) {
    return null;
  }
  return {
    businessId: body.tenantId,
    slug: body.slug,
    host,
    displayName: body.branding?.displayName?.trim() || body.tenantName?.trim() || body.slug,
    branding: (body.branding as Record<string, unknown> | null | undefined) ?? {},
    status: normalizeStatus(body.status),
    storefrontEnabled: body.storefrontEnabled !== false,
    fetchedAt,
  };
}

/** Whether this shop may be opened by this audience, and if not, why. */
export function classifyStore(store: StoreSnapshot, audience: StoreAudience): StoreResult {
  const status = normalizeStatus(store.status);
  if (status === 'SUSPENDED') {
    return { kind: 'unavailable', reason: 'suspended', store };
  }
  if (status !== 'ACTIVE') {
    return { kind: 'unavailable', reason: 'not_listed', store };
  }
  if (audience === 'shopper' && store.storefrontEnabled === false) {
    return { kind: 'unavailable', reason: 'storefront_disabled', store };
  }
  return { kind: 'found', store };
}

type Step = { done: StoreResult } | { unmapped: true };

async function lookupHost(base: string, host: string, options: PreviewOptions): Promise<Step> {
  const fetched = await getJson(
    `${base}/api/v1/public/host/resolve?host=${encodeURIComponent(host)}`,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const failure = transientFailure(fetched);
  if (failure) {
    return { done: failure };
  }
  if (fetched.kind !== 'response' || fetched.status !== 200) {
    // An older backend answers an unknown host with 404 instead of {mapped:false}.
    return { unmapped: true };
  }
  const store = fromHostResolve(host, fetched.body as HostResolveBody | null, new Date().toISOString());
  return store ? { done: classifyStore(store, options.audience) } : { unmapped: true };
}

async function lookupSlug(base: string, slug: string, options: PreviewOptions): Promise<StoreResult> {
  const fetched = await getJson(
    `${base}/api/v1/public/businesses/${encodeURIComponent(slug)}/mobile`,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const failure = transientFailure(fetched);
  if (failure) {
    return failure;
  }
  if (fetched.kind !== 'response' || fetched.status !== 200) {
    return { kind: 'not_found' };
  }
  const store = fromMobileConfig(fetched.body as MobileConfigBody | null, new Date().toISOString());
  if (!store) {
    // A 200 that is not a shop: the server is misbehaving, not the input.
    return { kind: 'offline' };
  }
  return store.host ? classifyStore(store, options.audience) : { kind: 'unavailable', reason: 'not_listed', store };
}

/**
 * Looks a shop up without changing anything on the device. Never throws: every outcome is a
 * StoreResult the screen can show.
 */
export async function previewStore(input: string, baseURL: string, options: PreviewOptions): Promise<StoreResult> {
  const query = parseStoreInput(input);
  if (!query) {
    return { kind: 'not_found' };
  }
  const base = baseURL.replace(/\/+$/, '');

  if (query.kind === 'slug') {
    return lookupSlug(base, query.slug, options);
  }

  const byHost = await lookupHost(base, query.host, options);
  if ('done' in byHost) {
    return byHost.done;
  }
  // An unmapped address on the platform domain is still a shop if its first label is one.
  const slug = platformSlugFromHost(query.host);
  return slug ? lookupSlug(base, slug, options) : { kind: 'not_found' };
}

/** A sentence for a screen that has no design for each outcome yet. */
export function describeStoreResult(result: Exclude<StoreResult, { kind: 'found' }>, input = ''): string {
  switch (result.kind) {
    case 'offline':
      return 'Cannot reach the server. Check your connection and try again.';
    case 'rate_limited':
      return result.retryAfterSec
        ? `Too many attempts. Try again in ${result.retryAfterSec} seconds.`
        : 'Too many attempts. Try again in a minute.';
    case 'not_found':
      return input.trim() ? `We could not find a shop called "${input.trim()}".` : 'Enter your shop name or address.';
    case 'unavailable': {
      const name = result.store?.displayName ?? 'This shop';
      if (result.reason === 'suspended') return `${name} is currently suspended.`;
      if (result.reason === 'storefront_disabled') return `${name} is not taking online orders yet.`;
      return `${name} is not available right now.`;
    }
  }
}
