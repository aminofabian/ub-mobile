const LEGACY_SCHEME = 'kiosk';
const APPS = ['shopper', 'cashier', 'grocery', 'admin', 'stock'];

/**
 * One deep-link scheme per app (plan §5.7): kioskshopper://, kioskcashier://, and so on, so a phone
 * with two Kiosk apps can tell which one should open a link.
 *
 * The Shopper also keeps `kiosk://` through a deprecation window, because printed links and codes in
 * the wild use it. No other app claims it. White-label builds replace all of this in
 * expo-white-label.js.
 *
 * @param {import('expo/config').ExpoConfig} expo
 * @param {'cashier' | 'shopper' | 'grocery' | 'admin' | 'stock'} appKey
 */
module.exports = function applyDeepLinks(expo, appKey) {
  if (!APPS.includes(appKey)) {
    throw new Error(`applyDeepLinks needs the app key (${APPS.join(', ')}), got "${appKey}".`);
  }

  const schemes = new Set([`kiosk${appKey}`]);
  if (appKey === 'shopper') {
    schemes.add(LEGACY_SCHEME);
  }

  const existing = expo.scheme;
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
