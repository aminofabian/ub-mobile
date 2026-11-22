/**
 * What the app calls itself on its first screens.
 *
 * The generic Kiosk app belongs to the platform: until the shopper picks a shop it says "Kiosk". A
 * white-label build is one shop's app and says that shop's name, the display name baked into it at
 * build time (getTenantDisplayName() in @kiosk/core).
 *
 * No imports, so node can run this file's test directly.
 */
export const PLATFORM_NAME = 'Kiosk';

/** The shop's name when there is one, otherwise the platform's. */
export function brandName(shopName?: string | null): string {
  const trimmed = typeof shopName === 'string' ? shopName.trim() : '';
  return trimmed || PLATFORM_NAME;
}
