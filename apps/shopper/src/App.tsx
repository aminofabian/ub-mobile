import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import { AppNavigator } from './navigation/AppNavigator';
import { BrandSplash } from './components/BrandSplash';
import { AuthGateProvider } from './components/AuthGate';
import { DeliveryCoverage } from './components/DeliveryCoverage';
import { TenantEntryScreen } from './screens/TenantEntryScreen';
import { TenantProvider, useTenant } from './lib/TenantContext';
import { queryClient } from './lib/query-client';
import { applyWaitingOta } from './lib/ota';
import { brandName } from './lib/brand';
import { useStorefrontRealtime } from './hooks/useStorefrontRealtime';
import { API_BASE_URL } from './lib/config';
import { MART, RADIUS, SPACE, TYPE } from './theme/mart';

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

function BootError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorShell}>
      <View style={styles.errorIcon}>
        <Ionicons name="cloud-offline-outline" size={24} color={MART.inkMuted} />
      </View>
      <Text style={styles.errorTitle}>{brandName(getTenantDisplayName())} is offline</Text>
      <Text style={styles.errorBody}>{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
      >
        <Text style={styles.retryLabel}>Try again</Text>
      </Pressable>
      <StatusBar style="dark" />
    </View>
  );
}

export function App() {
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });
  const [splashDone, setSplashDone] = useState(false);

  const runBootstrap = useCallback(async () => {
    setBoot({ status: 'loading' });
    try {
      await applyWaitingOta();
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
          message: 'We could not reach your store. Check your connection, then try again.',
        });
        return;
      }
      setBoot({ status: 'picker' });
    } catch (error) {
      if (getEmbeddedTenantSlug()) {
        setBoot({
          status: 'error',
          message: error instanceof Error ? error.message : 'We could not load your store.',
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

  const handleSplashDone = useCallback(() => setSplashDone(true), []);

  // The splash can time out before the store resolves, so `loading` needs a real
  // screen behind it rather than nothing.
  let content: React.ReactNode = <BootPending />;
  if (boot.status === 'error') {
    content = <BootError message={boot.message} onRetry={runBootstrap} />;
  } else if (boot.status === 'picker') {
    content = (
      <>
        <TenantEntryScreen onTenantResolved={(tenant) => setBoot({ status: 'ready', tenant })} />
        <StatusBar style="dark" />
      </>
    );
  } else if (boot.status === 'ready') {
    content = (
      <QueryClientProvider client={queryClient}>
        <TenantProvider tenant={boot.tenant}>
          <RealtimeBridge />
          <AuthGateProvider>
            <AppNavigator />
            <DeliveryCoverage />
          </AuthGateProvider>
          <StatusBar style="dark" />
        </TenantProvider>
      </QueryClientProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        {content}
        {splashDone ? null : (
          <BrandSplash
            ready={boot.status !== 'loading'}
            storeName={getTenantDisplayName()}
            onDone={handleSplashDone}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

function BootPending() {
  return (
    <View style={styles.pending}>
      <ActivityIndicator color={MART.inkQuiet} />
      <Text style={styles.pendingLabel}>Opening your store</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  pending: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.md,
    backgroundColor: MART.paper,
  },
  pendingLabel: {
    ...TYPE.meta,
    color: MART.inkQuiet,
  },
  errorShell: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
    backgroundColor: MART.paper,
  },
  errorIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.lg,
  },
  errorTitle: {
    ...TYPE.title,
    color: MART.ink,
  },
  errorBody: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: MART.inkMuted,
  },
  retry: {
    alignSelf: 'flex-start',
    marginTop: SPACE.xl,
    minHeight: 48,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.md,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryPressed: {
    opacity: 0.9,
  },
  retryLabel: {
    ...TYPE.label,
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
