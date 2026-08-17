import Constants from 'expo-constants';

const BACKEND_PORT = 5050;

function debuggerHostname(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    (Constants.manifest2 as { extra?: { expoClient?: { hostUri?: string } } } | undefined)?.extra
      ?.expoClient?.hostUri;

  if (!hostUri) return null;

  const withoutProtocol = hostUri.replace(/^exp\+[\w-]+:\/\//, '').replace(/^https?:\/\//, '');
  const hostname = withoutProtocol.split(':')[0]?.trim();
  return hostname || null;
}

export function resolveMobileApiBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as
    | { apiBaseUrl?: string; apiBaseURL?: string }
    | undefined;
  const configured = extra?.apiBaseUrl ?? extra?.apiBaseURL;
  if (configured && !configured.includes('192.168.100.2')) {
    return configured.replace(/\/$/, '');
  }

  const host = debuggerHostname();
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    return `http://${host}:${BACKEND_PORT}`;
  }

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  return `http://localhost:${BACKEND_PORT}`;
}

export function tenantHostSuffix(): string {
  return (Constants.expoConfig?.extra?.tenantHostSuffix as string | undefined) ?? 'localhost';
}

export type WhiteLabelThemeColors = {
  primary?: string;
  secondary?: string;
  logoUrl?: string;
};

/** Build-time tenant identity from app.config.js → expo-constants. */
export function getWhiteLabelExtra(): {
  tenantId: string | null;
  apiBaseUrl: string | null;
  themeColors: WhiteLabelThemeColors | null;
  isWhiteLabel: boolean;
} {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    tenantId?: string;
    embeddedTenantSlug?: string;
    apiBaseUrl?: string;
    apiBaseURL?: string;
    themeColors?: WhiteLabelThemeColors;
    isWhiteLabel?: boolean;
  };
  return {
    tenantId: extra.tenantId?.trim() || extra.embeddedTenantSlug?.trim() || null,
    apiBaseUrl: extra.apiBaseUrl ?? extra.apiBaseURL ?? null,
    themeColors: extra.themeColors ?? null,
    isWhiteLabel: extra.isWhiteLabel === true,
  };
}
