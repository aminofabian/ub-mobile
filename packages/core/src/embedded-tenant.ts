import Constants from 'expo-constants';

import { clearTenant, loadTenant, resolveTenant, type TenantContext } from './tenant';
import { tenantHostSuffix } from './mobile-config';

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
  const stored = await loadTenant();

  if (stored) {
    if (embeddedSlug && stored.slug !== embeddedSlug) {
      await clearTenant();
    } else {
      return stored;
    }
  }

  if (!embeddedSlug) {
    return null;
  }

  return resolveTenant(embeddedSlug, baseURL, {
    hostSuffixes: [tenantHostSuffix()],
  });
}
