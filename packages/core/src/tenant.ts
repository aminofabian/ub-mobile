import * as SecureStore from 'expo-secure-store';

export interface TenantContext {
  businessId: string;
  slug: string;
  host: string;
  displayName: string;
  branding: Record<string, unknown>;
}

interface PublicHostResolveResponse {
  tenantId: string;
  tenantName: string;
  slug: string;
  branding?: { displayName?: string | null };
  storefrontEnabled?: boolean;
}

interface PublicStorefrontResponse {
  businessName: string;
  slug: string;
  label?: string | null;
  catalogBranchId?: string;
}

const TENANT_KEY = 'kiosk.tenant';

const DEFAULT_HOST_SUFFIXES = ['localhost', 'palmart.co.ke', 'kiosk.ke'];

function normalizeSlug(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]?.split('.')[0] ?? '';
}

function hostFromSlugAndSuffix(slug: string, suffix: string): string {
  const clean = suffix.trim().toLowerCase().replace(/^\./, '');
  if (!clean) {
    return slug;
  }
  // Apex / already-qualified hosts: "palmart" + "palmart.co.ke" → palmart.co.ke
  if (clean === slug || clean.startsWith(`${slug}.`)) {
    return clean;
  }
  return `${slug}.${clean}`;
}

function hostCandidates(input: string, extraSuffixes: string[] = []): string[] {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('.')) {
    return [trimmed.replace(/^https?:\/\//, '').split('/')[0] ?? trimmed];
  }
  const slug = normalizeSlug(trimmed);
  const suffixes = [...new Set([...extraSuffixes, ...DEFAULT_HOST_SUFFIXES])];
  return [...new Set(suffixes.map((suffix) => hostFromSlugAndSuffix(slug, suffix)))];
}

function mapHostResolve(host: string, body: PublicHostResolveResponse): TenantContext {
  return {
    businessId: body.tenantId,
    slug: body.slug,
    host,
    displayName: body.branding?.displayName?.trim() || body.tenantName,
    branding: (body.branding as Record<string, unknown> | undefined) ?? {},
  };
}

function mapStorefront(slug: string, body: PublicStorefrontResponse): TenantContext {
  return {
    businessId: body.catalogBranchId ?? body.slug,
    slug: body.slug,
    host: slug,
    displayName: body.label?.trim() || body.businessName,
    branding: {},
  };
}

class ResolveAttempt {
  constructor(
    readonly url: string,
    readonly status?: number,
    readonly networkError?: string
  ) {}
}

async function resolveByHost(
  baseURL: string,
  host: string
): Promise<{ tenant: TenantContext | null; attempt: ResolveAttempt }> {
  const url = `${baseURL}/api/v1/public/host/resolve?host=${encodeURIComponent(host)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { tenant: null, attempt: new ResolveAttempt(url, response.status) };
    }
    const body = (await response.json()) as PublicHostResolveResponse & { mapped?: boolean };
    if (body?.mapped === false || !body?.tenantId) {
      return { tenant: null, attempt: new ResolveAttempt(url, response.status) };
    }
    return { tenant: mapHostResolve(host, body), attempt: new ResolveAttempt(url, response.status) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    return { tenant: null, attempt: new ResolveAttempt(url, undefined, message) };
  }
}

async function resolveByStorefrontSlug(
  baseURL: string,
  slug: string
): Promise<{ tenant: TenantContext | null; attempt: ResolveAttempt }> {
  const url = `${baseURL}/api/v1/public/businesses/${encodeURIComponent(slug)}/storefront`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { tenant: null, attempt: new ResolveAttempt(url, response.status) };
    }
    const body = (await response.json()) as PublicStorefrontResponse;
    return { tenant: mapStorefront(slug, body), attempt: new ResolveAttempt(url, response.status) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    return { tenant: null, attempt: new ResolveAttempt(url, undefined, message) };
  }
}

export async function resolveShopperStore(
  input: string,
  baseURL: string,
  options: { hostSuffixes?: string[] } = {}
): Promise<TenantContext> {
  const slug = normalizeSlug(input);
  if (!slug) {
    throw new Error('Enter a valid store slug');
  }

  const attempts: ResolveAttempt[] = [];

  const storefrontResult = await resolveByStorefrontSlug(baseURL, slug);
  attempts.push(storefrontResult.attempt);
  if (storefrontResult.tenant) {
    for (const host of hostCandidates(input, options.hostSuffixes)) {
      const hostResult = await resolveByHost(baseURL, host);
      attempts.push(hostResult.attempt);
      if (hostResult.tenant) {
        const enriched: TenantContext = {
          ...hostResult.tenant,
          displayName: storefrontResult.tenant.displayName || hostResult.tenant.displayName,
        };
        await SecureStore.setItemAsync(TENANT_KEY, JSON.stringify(enriched));
        return enriched;
      }
    }
    const fallbackHost = hostCandidates(slug, options.hostSuffixes)[0] ?? `${slug}.localhost`;
    const fixed: TenantContext = { ...storefrontResult.tenant, host: fallbackHost };
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
      `Cannot reach API at ${baseURL} (${networkError}). ` +
        'Ensure the backend is running on port 5050 and your phone is on the same Wi‑Fi.'
    );
  }

  const triedHosts = hostCandidates(input, options.hostSuffixes).join(', ');
  throw new Error(
    `Store "${slug}" not found via ${baseURL}. Tried hosts: ${triedHosts}. ` +
      'If the business exists, enable the web storefront in admin settings.'
  );
}

export async function resolveTenant(
  input: string,
  baseURL: string = 'https://api.kiosk.ke',
  options: { hostSuffixes?: string[] } = {}
): Promise<TenantContext> {
  if (!input.includes('.')) {
    return resolveShopperStore(input, baseURL, options);
  }

  const host = input.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0] ?? input;
  const { tenant: resolved } = await resolveByHost(baseURL, host);
  if (!resolved) {
    throw new Error(`Failed to resolve tenant for ${host}`);
  }
  await SecureStore.setItemAsync(TENANT_KEY, JSON.stringify(resolved));
  return resolved;
}

export async function loadTenant(): Promise<TenantContext | null> {
  const stored = await SecureStore.getItemAsync(TENANT_KEY);
  return stored ? (JSON.parse(stored) as TenantContext) : null;
}

export function getTenantHeaders(tenant: TenantContext): Record<string, string> {
  return {
    'X-Tenant-Host': tenant.host,
    'X-Tenant-Id': tenant.businessId,
  };
}

export async function clearTenant(): Promise<void> {
  await SecureStore.deleteItemAsync(TENANT_KEY);
}
