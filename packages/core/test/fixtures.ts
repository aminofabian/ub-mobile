// Server answers and shops shared by the tenant tests.

export const ACME = {
  tenantId: 'aaaaaaaa-0000-4000-8000-000000000001',
  slug: 'acme',
  name: 'Acme Mart',
  host: 'acme.kiosk.ke',
};

export const BOBS = {
  tenantId: 'bbbbbbbb-0000-4000-8000-000000000002',
  slug: 'bobs',
  name: "Bob's Pharmacy",
  host: 'bobs.kiosk.ke',
};

export const PALMART = {
  tenantId: 'cccccccc-0000-4000-8000-000000000003',
  slug: 'palmart',
  name: 'Palmart Mini Mart',
  host: 'palmart.co.ke',
};

type Shop = typeof ACME;

/** GET /api/v1/public/businesses/{slug}/mobile */
export function mobileBody(shop: Shop, overrides: Record<string, unknown> = {}) {
  return {
    tenantId: shop.tenantId,
    slug: shop.slug,
    displayName: shop.name,
    tenantHost: shop.host,
    tenantStatus: 'ACTIVE',
    storefrontEnabled: true,
    apiBaseUrl: 'https://api.kiosk.ke',
    branding: { displayName: shop.name, primaryColor: '#123456' },
    deepLinks: {},
    platformStoreLinks: { ios: null, android: null },
    apps: [],
    ...overrides,
  };
}

/** GET /api/v1/public/host/resolve?host= for a mapped host */
export function hostBody(shop: Shop, overrides: Record<string, unknown> = {}) {
  return {
    tenantId: shop.tenantId,
    tenantName: shop.name,
    slug: shop.slug,
    status: 'ACTIVE',
    branding: { displayName: shop.name },
    storefrontEnabled: true,
    ...overrides,
  };
}

export const UNMAPPED = { mapped: false };

export const API = 'https://api.test';

export function mobileUrl(slug: string): string {
  return `${API}/api/v1/public/businesses/${slug}/mobile`;
}

export function hostUrl(host: string): string {
  return `${API}/api/v1/public/host/resolve?host=${encodeURIComponent(host)}`;
}

/** GET /api/v1/public/shops/search?q= */
export function searchUrl(query: string): string {
  return `${API}/api/v1/public/shops/search?q=${encodeURIComponent(query)}`;
}

/** GET /api/v1/public/shops/by-code/{code} */
export function codeUrl(code: string): string {
  return `${API}/api/v1/public/shops/by-code/${encodeURIComponent(code)}`;
}

/** GET /api/v1/platform/mobile-schema-version */
export const PLATFORM_URL = `${API}/api/v1/platform/mobile-schema-version`;

/** What the server answers today, verbatim from MobileSchemaVersionController. */
export const PLATFORM_TODAY = { schemaVersion: 1, minAppVersion: '0.0.1', breakingChangeAt: '2099-01-01T00:00:00Z' };
