import Constants from 'expo-constants';

import { clearTenant, loadTenant, resolveTenant, type TenantContext } from './tenant';
import { tenantHost, tenantHostSuffix } from './mobile-config';

export function getEmbeddedTenantSlug(): string | null {
  const slug = Constants.expoConfig?.extra?.embeddedTenantSlug;
  if (typeof slug !== 'string') return null;
  const trimmed = slug.trim();
  return trimmed || null;
}

export function isWhiteLabelApp(): boolean {
  return Constants.expoConfig?.extra?.isWhiteLabel === true;
}

export function getTenantDisplayName(): string | null {
  const name = Constants.expoConfig?.extra?.tenantDisplayName;
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  return trimmed || null;
}

/**
 * Loads a persisted tenant, or auto-resolves the slug baked in at build time
 * for white-label apps. Returns null when the generic app needs a tenant picker.
 */
export async function bootstrapTenant(baseURL: string): Promise<TenantContext | null> {
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

  return resolveTenant(embeddedSlug as string, baseURL, {
    hostSuffixes: [tenantHostSuffix()],
  });
}
