import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import {
  bootstrapTenant,
  getEmbeddedTenantSlug,
  isStaffDeepLinkIntent,
  resolveTenantFromDeepLink,
  StoreSwitchBlockedError,
  useTenantDeepLink,
  type TenantContext,
} from '@kiosk/core';
import { confirmLeavingUnsent } from '../lib/store-switch';
import { useAuthStore } from '../store/auth-store';

export type StaffBootPhase = 'loading' | 'tenant' | 'branch' | 'login' | 'ready' | 'error';

async function tryResolveStaffDeepLink(
  url: string | null | undefined,
  baseURL: string,
  keepUnsent = false
): Promise<TenantContext | null> {
  if (!url?.trim()) {
    return null;
  }
  const result = await resolveTenantFromDeepLink(url, baseURL, { audience: 'staff', keepUnsent });
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
      // A link to a different store starts from nothing: the branch and sign-in on screen belong to the old one.
      if (useAuthStore.getState().tenant?.businessId !== tenant.businessId) {
        useAuthStore.getState().reset();
      }
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
      let fromDeepLink: TenantContext | null = null;
      try {
        fromDeepLink = await tryResolveStaffDeepLink(initialUrl, baseURL);
      } catch (error) {
        // The saved store still holds sales that were never sent: the link waits and that store opens.
        if (!(error instanceof StoreSwitchBlockedError)) {
          throw error;
        }
      }
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
    } catch (error) {
      if (error instanceof StoreSwitchBlockedError && (await confirmLeavingUnsent(error.unsent))) {
        try {
          const tenant = await tryResolveStaffDeepLink(url, baseURL, true);
          if (tenant) {
            applyDeepLinkTenant(tenant);
          }
        } catch {
          // The store could not be opened after all.
        }
      }
      // Anything else is a malformed or unknown link while the app is open: ignore it.
    }
  });

  return { phase, setPhase, bootError, retry: runBootstrap };
}
