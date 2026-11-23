import { parseShopCodeLink } from './shop-code';
import { openStore, unwrapOpened, type StoreAudience, type StoreResult, type TenantContext } from './tenant';
import { parseStoreInput, previewStore, previewStoreByCode } from './tenant-resolve';

export type TenantDeepLinkIntent = 'shop' | 'login' | 'tenant';

export interface ParsedTenantDeepLink {
  intent: TenantDeepLinkIntent;
  /** Present for `kiosk://…/{slug}` links; may be null for hostname-only universal links. */
  slug: string | null;
  /** Hostname for `https://{host}/shop` style links. */
  host: string | null;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isStaffIntent(intent: TenantDeepLinkIntent): boolean {
  return intent === 'login' || intent === 'tenant';
}

export function isShopperDeepLinkIntent(intent: TenantDeepLinkIntent): boolean {
  return intent === 'shop' || intent === 'tenant';
}

export function isStaffDeepLinkIntent(intent: TenantDeepLinkIntent): boolean {
  return isStaffIntent(intent);
}

function extractSlugFromHost(host: string): string | null {
  const first = host.split('.')[0]?.trim().toLowerCase() ?? '';
  return SLUG_RE.test(first) ? first : null;
}

function parseCustomSchemeUrl(url: string): ParsedTenantDeepLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const scheme = parsed.protocol.replace(':', '').toLowerCase();
  if (scheme === 'http' || scheme === 'https') {
    return null;
  }

  const intent = parsed.hostname.trim().toLowerCase();
  if (intent !== 'shop' && intent !== 'login' && intent !== 'tenant') {
    return null;
  }

  const slug = parsed.pathname.replace(/^\//, '').split('/')[0]?.trim().toLowerCase() ?? '';
  if (!slug || !SLUG_RE.test(slug)) {
    return null;
  }

  return { intent, slug, host: null };
}

function parseUniversalLink(url: string): ParsedTenantDeepLink | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const host = parsed.hostname.trim().toLowerCase();
  if (!host) {
    return null;
  }

  const path = parsed.pathname.replace(/\/$/, '').toLowerCase();
  if (path === '/shop' || path.endsWith('/shop')) {
    return { intent: 'shop', slug: extractSlugFromHost(host), host };
  }
  if (path === '/app' || path.endsWith('/app')) {
    return { intent: 'login', slug: extractSlugFromHost(host), host };
  }

  return null;
}

/**
 * Parses tenant deep links such as `kiosk://shop/palmart` or `https://palmart.kiosk.ke/shop`.
 */
export function parseTenantDeepLink(url: string): ParsedTenantDeepLink | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  return parseCustomSchemeUrl(trimmed) ?? parseUniversalLink(trimmed);
}

const MAX_SCAN_LENGTH = 512;

/** What a scanned QR code points at. */
export type ScanTarget =
  /** A shop code, from a link such as `https://kiosk.ke/c/K7M4Q`. */
  | { kind: 'code'; code: string }
  /** A shop's address or short name, for `previewStore`. */
  | { kind: 'store'; input: string }
  | { kind: 'unknown' };

/**
 * Reads what a camera found. A code link, a shop link (`kiosk://shop/acme`, `https://acme.kiosk.ke/shop`)
 * and a bare address all name a shop; anything else does not. Bare text is never taken for a code here:
 * a printed code is a link, and a short word that is also a valid code is far more likely a shop's name.
 */
export function parseScan(data: string): ScanTarget {
  const text = data.trim();
  // A shop's QR code is a short link. Anything longer is some other kind of code, and is not sent anywhere.
  if (!text || text.length > MAX_SCAN_LENGTH) {
    return { kind: 'unknown' };
  }
  const code = parseShopCodeLink(text);
  if (code) {
    return { kind: 'code', code };
  }
  const link = parseTenantDeepLink(text);
  if (link && (link.host ?? link.slug)) {
    return { kind: 'store', input: (link.host ?? link.slug) as string };
  }
  // A link in some other app's scheme is not an address: reading `kiosk://unknown/acme` as the shop
  // "unknown" would send the person to a "not found" for a QR code that was never a shop.
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(text)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') {
    return { kind: 'unknown' };
  }
  return parseStoreInput(text) ? { kind: 'store', input: text } : { kind: 'unknown' };
}

/**
 * Looks up the shop a link names without opening it, so the app can show the shop and ask first. Null
 * when the link is not about a shop at all. A link that names a host is about that host, as in
 * `resolveTenantFromDeepLink`.
 */
export async function previewDeepLink(
  url: string,
  baseURL: string,
  options: { audience: StoreAudience },
): Promise<{ intent: TenantDeepLinkIntent; result: StoreResult } | null> {
  const code = parseShopCodeLink(url);
  if (code) {
    return { intent: 'shop', result: await previewStoreByCode(code, baseURL, options) };
  }
  const parsed = parseTenantDeepLink(url);
  const input = parsed?.host ?? parsed?.slug;
  if (!parsed || !input) {
    return null;
  }
  return { intent: parsed.intent, result: await previewStore(input, baseURL, options) };
}

export async function resolveTenantFromDeepLink(
  url: string,
  baseURL: string,
  options: { audience: StoreAudience; keepUnsent?: boolean }
): Promise<{ tenant: TenantContext; intent: TenantDeepLinkIntent } | null> {
  const parsed = parseTenantDeepLink(url);
  if (!parsed) {
    return null;
  }

  // A link that names a host is about that host. Its first label is only a guess at a slug, and for a
  // custom domain such as shop.example.com the guess ("shop") names the wrong shop or none.
  const input = parsed.host ?? parsed.slug;
  if (!input) {
    return null;
  }

  const tenant = unwrapOpened(
    await openStore(input, baseURL, { audience: options.audience, keepUnsent: options.keepUnsent }),
    input,
  );
  return { tenant, intent: parsed.intent };
}
