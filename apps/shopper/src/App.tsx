import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Linking } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  bootstrapTenant,
  getEmbeddedTenantSlug,
  getTenantDisplayName,
  isShopperDeepLinkIntent,
  resolveTenantFromDeepLink,
  tenantHostSuffix,
  useTenantDeepLink,
  type TenantContext,
} from '@kiosk/core';
import { Button, Text } from '@kiosk/ui';
import { StyleSheet, View } from 'react-native';
import { AppNavigator } from './navigation/AppNavigator';
import { TenantEntryScreen } from './screens/TenantEntryScreen';
import { TenantProvider, useTenant } from './lib/TenantContext';
import { queryClient } from './lib/query-client';
import { useStorefrontRealtime } from './hooks/useStorefrontRealtime';
import { API_BASE_URL } from './lib/config';

function RealtimeBridge() {
  const tenant = useTenant();
  useStorefrontRealtime(tenant.slug);
  return null;
}

type BootState =
  | { status: 'loading' }
  | { status: 'ready'; tenant: TenantContext }
  | { status: 'picker' }
  | { status: 'error'; message: string };

async function tryResolveShopperDeepLink(
  url: string | null | undefined
): Promise<TenantContext | null> {
  if (!url?.trim()) {
    return null;
  }
  const result = await resolveTenantFromDeepLink(url, API_BASE_URL, {
    hostSuffixes: [tenantHostSuffix()],
  });
  if (!result || !isShopperDeepLinkIntent(result.intent)) {
    return null;
  }
  return result.tenant;
}

export function App() {
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });

  const runBootstrap = useCallback(async () => {
    setBoot({ status: 'loading' });
    try {
      const initialUrl = await Linking.getInitialURL();
      const fromDeepLink = await tryResolveShopperDeepLink(initialUrl);
      if (fromDeepLink) {
        setBoot({ status: 'ready', tenant: fromDeepLink });
        return;
      }

      const tenant = await bootstrapTenant(API_BASE_URL);
      if (tenant) {
        setBoot({ status: 'ready', tenant });
        return;
      }
      if (getEmbeddedTenantSlug()) {
        setBoot({
          status: 'error',
          message: 'Could not connect to your store. Check your network and try again.',
        });
        return;
      }
      setBoot({ status: 'picker' });
    } catch (error) {
      if (getEmbeddedTenantSlug()) {
        setBoot({
          status: 'error',
          message: error instanceof Error ? error.message : 'Could not load your store',
        });
      } else {
        setBoot({ status: 'picker' });
      }
    }
  }, []);

  useEffect(() => {
    void runBootstrap();
  }, [runBootstrap]);

  useTenantDeepLink(async (url) => {
    try {
      const tenant = await tryResolveShopperDeepLink(url);
      if (tenant) {
        setBoot({ status: 'ready', tenant });
      }
    } catch {
      // Ignore unknown links.
    }
  });

  if (boot.status === 'loading') {
    return null;
  }

  if (boot.status === 'error') {
    return (
      <View style={styles.errorContainer}>
        <Text variant="h1">{getTenantDisplayName() ?? 'Store unavailable'}</Text>
        <Text variant="body" style={styles.errorMessage}>
          {boot.message}
        </Text>
        <Button title="Try again" onPress={runBootstrap} />
        <StatusBar style="auto" />
      </View>
    );
  }

  if (boot.status === 'picker') {
    return (
      <>
        <TenantEntryScreen onTenantResolved={(tenant) => setBoot({ status: 'ready', tenant })} />
        <StatusBar style="auto" />
      </>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider tenant={boot.tenant}>
        <RealtimeBridge />
        <AppNavigator />
        <StatusBar style="auto" />
      </TenantProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  errorMessage: {
    marginVertical: 24,
    color: '#6c757d',
  },
});
