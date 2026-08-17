const PLATFORM_SCHEME = 'kiosk';

/**
 * Registers the shared `kiosk://` deep-link scheme for generic platform apps.
 * White-label profiles may add tenant-specific schemes on top via expo-white-label.js.
 *
 * @param {import('expo/config').ExpoConfig} expo
 */
module.exports = function applyDeepLinks(expo) {
  const existing = expo.scheme;
  const schemes = new Set([PLATFORM_SCHEME]);
  if (typeof existing === 'string' && existing.trim()) {
    schemes.add(existing.trim());
  } else if (Array.isArray(existing)) {
    for (const value of existing) {
      if (typeof value === 'string' && value.trim()) {
        schemes.add(value.trim());
      }
    }
  }

  const scheme = schemes.size === 1 ? [...schemes][0] : [...schemes];

  return {
    ...expo,
    scheme,
  };
};
