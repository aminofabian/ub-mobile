const {
  SHARED_TENANT_ID,
  tenantIdFromEnv,
  resolveProfilePath,
  loadTenantProfile,
  resolveTenantAsset,
  relativeFromCwd,
} = require('./load-tenant-profile');

/** @typedef {'cashier' | 'shopper' | 'grocery' | 'admin' | 'stock'} AppKey */

function pickAsset(tenantId, filename, configured) {
  const fromDisk = resolveTenantAsset(tenantId, filename);
  if (fromDisk) {
    return relativeFromCwd(fromDisk);
  }
  return configured;
}

/**
 * The shared profile (tenants/_shared) brands the generic build: the listing's name, slug and bundle
 * ids, and the OTA identity. It never sets isWhiteLabel, embeddedTenantSlug or any tenant extra, so
 * the app boots into the store picker. Schemes come from expo-deep-links.js and art from
 * apps/<app>/assets.
 *
 * @param {import('expo/config').ExpoConfig} expo
 * @param {AppKey} appKey
 * @param {Record<string, any>} profile
 * @param {string} profileId
 */
function applyMarketplace(expo, appKey, profile, profileId) {
  const appProfile = profile.apps?.[appKey];
  if (!appProfile) {
    throw new Error(`Shared profile "${profileId}" has no app profile for "${appKey}".`);
  }

  const easProjectId = appProfile.easProjectId ?? profile.easProjectId;

  return {
    ...expo,
    name: appProfile.name ?? expo.name,
    slug: appProfile.expoSlug ?? expo.slug,
    runtimeVersion: expo.runtimeVersion ?? { policy: 'appVersion' },
    ...(easProjectId
      ? {
          updates: {
            ...(expo.updates ?? {}),
            url: `https://u.expo.dev/${easProjectId}`,
          },
        }
      : {}),
    ios: {
      ...expo.ios,
      bundleIdentifier: appProfile.iosBundleId ?? appProfile.bundleId ?? expo.ios?.bundleIdentifier,
    },
    android: {
      ...expo.android,
      package: appProfile.androidPackage ?? appProfile.bundleId ?? expo.android?.package,
    },
    extra: {
      ...expo.extra,
      ...(easProjectId ? { eas: { ...(expo.extra?.eas ?? {}), projectId: easProjectId } } : {}),
    },
  };
}

/**
 * Permission prompts in app.json name the platform ("Allow Kiosk to use your camera…"). A white-label
 * build names the shop instead.
 */
function brandPlugins(plugins, displayName) {
  if (!Array.isArray(plugins)) {
    return plugins;
  }
  return plugins.map((plugin) => {
    const options = Array.isArray(plugin) ? plugin[1] : null;
    if (!options || typeof options !== 'object') {
      return plugin;
    }
    const branded = Object.fromEntries(
      Object.entries(options).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.replace(/\bKiosk\b/g, () => displayName) : value,
      ])
    );
    return [plugin[0], branded, ...plugin.slice(2)];
  });
}

/**
 * Applies per-business branding when TENANT_ID or KIOSK_TENANT is set at build/start time. With none
 * set, the build is the generic one: tenants/_shared brands it, and it shows the store picker on
 * first launch.
 *
 * @param {import('expo/config').ExpoConfig} expo
 * @param {AppKey} appKey
 */
function applyWhiteLabel(expo, appKey) {
  const requested = tenantIdFromEnv();
  const tenantId = requested || (resolveProfilePath(SHARED_TENANT_ID) ? SHARED_TENANT_ID : '');
  if (!tenantId) {
    return expo;
  }

  const loaded = loadTenantProfile(tenantId);
  const profile = loaded.profile;
  if (profile.marketplace === true) {
    return applyMarketplace(expo, appKey, profile, tenantId);
  }
  const appProfile = profile.apps?.[appKey];
  if (!appProfile) {
    throw new Error(`Tenant "${tenantId}" has no app profile for "${appKey}".`);
  }

  const slug = (profile.slug || profile.id || tenantId).trim();
  if (!slug) {
    throw new Error(`Tenant "${tenantId}" is missing "slug".`);
  }

  const tenantHostSuffix = profile.tenantHostSuffix ?? expo.extra?.tenantHostSuffix;
  const configuredHost =
    typeof profile.tenantHost === 'string' ? profile.tenantHost.trim().toLowerCase() : '';
  const tenantHost =
    configuredHost ||
    (typeof tenantHostSuffix === 'string' &&
    (tenantHostSuffix === slug || tenantHostSuffix.startsWith(`${slug}.`))
      ? tenantHostSuffix
      : undefined);

  const splashColor =
    appProfile.splashBackgroundColor ??
    profile.splashBg ??
    profile.splashBackgroundColor ??
    expo.splash?.backgroundColor ??
    '#164715';

  const theme = profile.theme ?? {};
  const primaryColor = theme.primary ?? profile.primaryColor ?? splashColor;

  const icon = pickAsset(tenantId, 'icon.png', appProfile.icon ?? profile.assets?.icon ?? expo.icon);
  const splashImage = pickAsset(
    tenantId,
    'splash.png',
    appProfile.splashImage ?? profile.assets?.splashImage
  );
  const adaptiveIcon = pickAsset(
    tenantId,
    'adaptive-icon.png',
    appProfile.adaptiveIcon ?? profile.assets?.adaptiveIcon ?? expo.android?.adaptiveIcon?.foregroundImage
  );
  const favicon = pickAsset(
    tenantId,
    'favicon.png',
    profile.assets?.favicon ?? expo.web?.favicon
  );

  const iosGoogle = resolveTenantAsset(tenantId, 'GoogleService-Info.plist');
  const androidGoogle = resolveTenantAsset(tenantId, 'google-services.json');

  const iosBundleId = appProfile.iosBundleId ?? appProfile.bundleId ?? expo.ios?.bundleIdentifier;
  const androidPackage =
    appProfile.androidPackage ?? appProfile.bundleId ?? expo.android?.package;

  const scheme = appProfile.scheme ?? profile.scheme ?? slug;
  const schemes = Array.from(new Set([scheme, 'kiosk'].filter(Boolean)));

  const apiBaseUrl = profile.apiBaseUrl ?? profile.apiBaseURL ?? expo.extra?.apiBaseURL;
  const easProjectId = appProfile.easProjectId ?? profile.easProjectId;

  return {
    ...expo,
    name: appProfile.name ?? expo.name,
    slug: appProfile.expoSlug ?? `${tenantId}-${appKey}`,
    scheme: schemes.length === 1 ? schemes[0] : schemes,
    icon,
    ...(expo.plugins ? { plugins: brandPlugins(expo.plugins, profile.displayName ?? slug) } : {}),
    runtimeVersion: expo.runtimeVersion ?? { policy: 'appVersion' },
    ...(easProjectId
      ? {
          updates: {
            ...(expo.updates ?? {}),
            url: `https://u.expo.dev/${easProjectId}`,
          },
        }
      : {}),
    splash: {
      ...expo.splash,
      backgroundColor: splashColor,
      ...(splashImage ? { image: splashImage } : {}),
    },
    ios: {
      ...expo.ios,
      bundleIdentifier: iosBundleId,
      ...(iosGoogle ? { googleServicesFile: relativeFromCwd(iosGoogle) } : {}),
    },
    android: {
      ...expo.android,
      package: androidPackage,
      adaptiveIcon: {
        ...expo.android?.adaptiveIcon,
        backgroundColor: profile.iconBackground ?? splashColor,
        ...(adaptiveIcon ? { foregroundImage: adaptiveIcon } : {}),
      },
      ...(androidGoogle ? { googleServicesFile: relativeFromCwd(androidGoogle) } : {}),
    },
    web: {
      ...expo.web,
      ...(favicon ? { favicon } : {}),
    },
    extra: {
      ...expo.extra,
      tenantId: profile.id ?? tenantId,
      embeddedTenantSlug: slug,
      isWhiteLabel: true,
      tenantDisplayName: profile.displayName ?? slug,
      tenantHostSuffix: tenantHostSuffix ?? expo.extra?.tenantHostSuffix,
      ...(tenantHost ? { tenantHost } : {}),
      apiBaseUrl,
      apiBaseURL: apiBaseUrl,
      primaryColor,
      themeColors: {
        primary: primaryColor,
        accent: theme.accent ?? theme.secondary ?? undefined,
        gold: theme.gold ?? undefined,
        secondary: theme.secondary ?? theme.accent ?? undefined,
        logoUrl: theme.logoUrl ?? undefined,
      },
      ...(easProjectId
        ? { eas: { ...(expo.extra?.eas ?? {}), projectId: easProjectId } }
        : {}),
    },
  };
}

module.exports = applyWhiteLabel;
// Exposed so scripts/white-label-config.test.js can reach the parts a profile on disk cannot.
module.exports.applyMarketplace = applyMarketplace;
module.exports.brandPlugins = brandPlugins;
