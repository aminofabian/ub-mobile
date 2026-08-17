/** Shared dev settings for Expo apps (cleartext HTTP, local API URL). */
module.exports = function applyDevConfig(expo) {
  const isEasBuild = process.env.EAS_BUILD === 'true';
  const isProduction = process.env.NODE_ENV === 'production' || isEasBuild;

  // Dev ignores app.json's production API so Expo Go talks to the LAN backend.
  // Override with EXPO_PUBLIC_API_BASE_URL when you need a remote API locally.
  const apiBaseURL = isProduction
    ? (process.env.EXPO_PUBLIC_API_BASE_URL ?? expo.extra?.apiBaseURL)
    : (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://192.168.100.2:5050');

  const tenantHostSuffix =
    process.env.EXPO_PUBLIC_TENANT_HOST_SUFFIX ??
    expo.extra?.tenantHostSuffix ??
    (isProduction ? undefined : 'localhost');

  const next = {
    ...expo,
    extra: {
      ...expo.extra,
      ...(apiBaseURL ? { apiBaseURL } : {}),
      ...(tenantHostSuffix ? { tenantHostSuffix } : {}),
    },
  };

  if (isProduction) {
    return next;
  }

  return {
    ...next,
    ios: {
      ...next.ios,
      infoPlist: {
        ...next.ios?.infoPlist,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
          NSAllowsLocalNetworking: true,
        },
      },
    },
    android: {
      ...next.android,
      usesCleartextTraffic: true,
    },
  };
};
