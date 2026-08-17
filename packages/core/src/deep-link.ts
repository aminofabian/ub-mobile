import { resolveTenant, type TenantContext } from './tenant';

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

export async function resolveTenantFromDeepLink(
  url: string,
  baseURL: string,
  options: { hostSuffixes?: string[] } = {}
): Promise<{ tenant: TenantContext; intent: TenantDeepLinkIntent } | null> {
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
