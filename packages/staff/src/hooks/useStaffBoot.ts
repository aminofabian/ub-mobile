import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import {
  bootstrapTenant,
  getEmbeddedTenantSlug,
  isStaffDeepLinkIntent,
  resolveTenantFromDeepLink,
  tenantHostSuffix,
  useTenantDeepLink,
  type TenantContext,
} from '@kiosk/core';

export type StaffBootPhase = 'loading' | 'tenant' | 'branch' | 'login' | 'ready' | 'error';

async function tryResolveStaffDeepLink(
  url: string | null | undefined,
  baseURL: string
): Promise<TenantContext | null> {
  if (!url?.trim()) {
    return null;
  }
  const result = await resolveTenantFromDeepLink(url, baseURL, {
    hostSuffixes: [tenantHostSuffix()],
  });
  if (!result || !isStaffDeepLinkIntent(result.intent)) {
    return null;
  }
  return result.tenant;
}

export function useStaffBoot(
  baseURL: string,
  setTenant: (tenant: TenantContext) => void
): {
  phase: StaffBootPhase;
  setPhase: (phase: StaffBootPhase) => void;
  bootError: string | null;
  retry: () => void;
} {
  const [phase, setPhase] = useState<StaffBootPhase>('loading');
  const [bootError, setBootError] = useState<string | null>(null);

  const applyDeepLinkTenant = useCallback(
    (tenant: TenantContext) => {
      setTenant(tenant);
      setBootError(null);
      setPhase('branch');
    },
    [setTenant]
  );

  const runBootstrap = useCallback(async () => {
    setPhase('loading');
    setBootError(null);
    try {
      const initialUrl = await Linking.getInitialURL();
      const fromDeepLink = await tryResolveStaffDeepLink(initialUrl, baseURL);
      if (fromDeepLink) {
        applyDeepLinkTenant(fromDeepLink);
        return;
      }

      const tenant = await bootstrapTenant(baseURL);
      if (tenant) {
        setTenant(tenant);
        setPhase('branch');
        return;
      }
      if (getEmbeddedTenantSlug()) {
        setBootError('Could not connect to your store. Check your network and try again.');
        setPhase('error');
        return;
      }
      setPhase('tenant');
    } catch (error) {
      if (getEmbeddedTenantSlug()) {
        setBootError(error instanceof Error ? error.message : 'Could not load your store');
        setPhase('error');
      } else {
        setPhase('tenant');
      }
    }
  }, [applyDeepLinkTenant, baseURL, setTenant]);

  useEffect(() => {
    void runBootstrap();
  }, [runBootstrap]);

  useTenantDeepLink(async (url) => {
    try {
      const tenant = await tryResolveStaffDeepLink(url, baseURL);
      if (!tenant) {
        return;
      }
      applyDeepLinkTenant(tenant);
    } catch {
      // Ignore malformed or unknown links while the app is open.
    }
  });

  return { phase, setPhase, bootError, retry: runBootstrap };
}
