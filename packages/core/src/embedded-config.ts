import Constants from 'expo-constants';

/** Build-time identity from app.config.js. Split out so the storage layer can read it without a cycle. */
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
