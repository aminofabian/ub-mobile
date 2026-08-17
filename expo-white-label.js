const {
  tenantIdFromEnv,
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
 * Applies per-business branding when TENANT_ID or KIOSK_TENANT is set at
 * build/start time. Generic apps (unset) keep the default Kiosk Ke config
 * and show the tenant picker on first launch.
 *
 * @param {import('expo/config').ExpoConfig} expo
 * @param {AppKey} appKey
 */
function applyWhiteLabel(expo, appKey) {
  const tenantId = tenantIdFromEnv();
  if (!tenantId) {
    return expo;
  }

  const loaded = loadTenantProfile(tenantId);
  const profile = loaded.profile;
  const appProfile = profile.apps?.[appKey];
  if (!appProfile) {
    throw new Error(`Tenant "${tenantId}" has no app profile for "${appKey}".`);
  }

  const slug = (profile.slug || profile.id || tenantId).trim();
  if (!slug) {
    throw new Error(`Tenant "${tenantId}" is missing "slug".`);
  }

  const splashColor =
    appProfile.splashBackgroundColor ??
    profile.splashBg ??
    profile.splashBackgroundColor ??
    expo.splash?.backgroundColor ??
    '#28a745';

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
        backgroundColor: splashColor,
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
      tenantHostSuffix: profile.tenantHostSuffix ?? expo.extra?.tenantHostSuffix,
      apiBaseUrl,
      apiBaseURL: apiBaseUrl,
      primaryColor,
      themeColors: {
        primary: primaryColor,
        secondary: theme.secondary ?? undefined,
        logoUrl: theme.logoUrl ?? undefined,
      },
      ...(easProjectId
        ? { eas: { ...(expo.extra?.eas ?? {}), projectId: easProjectId } }
        : {}),
    },
  };
}

module.exports = applyWhiteLabel;
