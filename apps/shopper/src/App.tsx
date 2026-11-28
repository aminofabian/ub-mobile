import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, AppState, Linking, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
} from '@expo-google-fonts/schibsted-grotesk';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import {
  bootstrapTenant,
  fetchPlatformConfig,
  getAppVersion,
  getEmbeddedTenantSlug,
  getTenantDisplayName,
  isShopperDeepLinkIntent,
  parseTenantDeepLink,
  previewDeepLink,
  resolveTenantFromDeepLink,
  subscribeActiveStore,
  subscribeActiveStoreId,
  updateStateFor,
  useTenantDeepLink,
  type PlatformConfig,
  type StoreResult,
  type StoreSnapshot,
  type TenantContext,
  type UpdateState,
} from '@kiosk/core';
import { AppNavigator } from './navigation/AppNavigator';
import { BrandSplash } from './components/BrandSplash';
import { AuthGateProvider } from './components/AuthGate';
import { DeliveryCoverage } from './components/DeliveryCoverage';
import { LinkOfferModal } from './components/LinkOfferModal';
import { TenantEntryScreen, type PickerSeed } from './screens/TenantEntryScreen';
import { UpdateRequiredScreen } from './screens/UpdateRequiredScreen';
import { TenantProvider, useTenant } from './lib/TenantContext';
import { ShopNavigatorProvider, type ShopNavigator } from './lib/ShopNavigator';
import { queryClient } from './lib/query-client';
import { afterModalCloses } from './lib/modal-handoff';
import { openRememberedShop } from './lib/open-shop';
import { applyWaitingOta } from './lib/ota';
import { shouldAskPlatformAgain } from './lib/platform-refresh';
import { useOpening } from './lib/useOpening';
import { linkIsForMyShop } from './lib/white-label-link';
import { brandName } from './lib/brand';
import { problemCopy } from './lib/picker-copy';
import { useStorefrontRealtime } from './hooks/useStorefrontRealtime';
import { API_BASE_URL } from './lib/config';
import { Capsule } from './components/Capsule';
import { Lobe } from './components/Coast';
import { MART, SPACE, TYPE, ZONE } from './theme/mart';

function RealtimeBridge() {
  const tenant = useTenant();
  useStorefrontRealtime(tenant.slug);
  return null;
}

type BootState =
  | { status: 'loading' }
  | { status: 'ready'; tenant: TenantContext }
  /** `seed` is a shop or a problem that a link already found, shown the moment the picker opens. */
  | { status: 'picker'; seed?: PickerSeed }
  | { status: 'error'; message: string };

/**
 * A link, in a shop's own app. That app has one shop, so a link is followed only when it names that shop:
 * following a link to any other would sign the person out of theirs and show somebody else's. (The generic
 * app never follows a link by itself; see `receiveLink`.)
 */
async function tryResolveShopperDeepLink(
  url: string | null | undefined
): Promise<TenantContext | null> {
  const mine = getEmbeddedTenantSlug();
  if (!url?.trim() || !mine || !parseTenantDeepLink(url)) {
    return null;
  }
  const looked = await previewDeepLink(url, API_BASE_URL, { audience: 'shopper' });
  if (!looked || !isShopperDeepLinkIntent(looked.intent) || looked.result.kind !== 'found') {
    return null;
  }
  if (!linkIsForMyShop(mine, looked.result.store.slug)) {
    return null;
  }
  const result = await resolveTenantFromDeepLink(url, API_BASE_URL, { audience: 'shopper' });
  if (!result || !isShopperDeepLinkIntent(result.intent)) {
    return null;
  }
  return result.tenant;
}

function BootError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorShell}>
      <Lobe color={ZONE.pond} size={88} shape={2} style={styles.errorIcon}>
        <Ionicons name="cloud-offline" size={34} color={MART.ink} />
      </Lobe>
      <Text style={styles.errorTitle}>{brandName(getTenantDisplayName())} is offline</Text>
      <Text style={styles.errorBody}>{message}</Text>
      <Capsule label="Try again" chip="refresh" onPress={onRetry} stretch={false} style={styles.retry} />
      <StatusBar style="dark" />
    </View>
  );
}

export function App() {
  // A shop's own app has one shop. Everything about choosing, switching and links to other shops is the
  // generic app's, and a white-label build behaves exactly as it did before.
  const whiteLabel = Boolean(getEmbeddedTenantSlug());

  const [boot, setBoot] = useState<BootState>({ status: 'loading' });
  const [splashDone, setSplashDone] = useState(false);
  const [platform, setPlatform] = useState<PlatformConfig | null>(null);
  const [switching, setSwitching] = useState(false);
  const [offer, setOffer] = useState<StoreSnapshot | null>(null);
  const [pendingLink, setPendingLink] = useState<StoreResult | null>(null);
  const linkTicket = useRef(0);
  const alive = useRef(true);
  const platformAskedAt = useRef(0);
  const havePlatform = useRef(false);
  // A shop is being opened somewhere in the app: the shop finder cannot be closed until it is open.
  const opening = useOpening();

  const runBootstrap = useCallback(async () => {
    setBoot({ status: 'loading' });
    try {
      await applyWaitingOta();
      if (whiteLabel) {
        const initialUrl = await Linking.getInitialURL();
        const fromDeepLink = await tryResolveShopperDeepLink(initialUrl);
        if (fromDeepLink) {
          setBoot({ status: 'ready', tenant: fromDeepLink });
          return;
        }
      }

      const tenant = await bootstrapTenant(API_BASE_URL, { audience: 'shopper' });
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
  }, [whiteLabel]);

  useEffect(() => {
    void runBootstrap();
  }, [runBootstrap]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // What the platform says before any shop is open: the oldest version that may run, a support contact, and
  // which features are switched on. If it cannot be reached the app carries on with its defaults. It is
  // asked again when the app comes back to the front after a while, so a minimum raised or a build pulled
  // later still reaches a phone that keeps the app in memory for days. A shop's own app is not held to the
  // platform's answer (see `update`), so it does not ask.
  const askPlatform = useCallback(() => {
    platformAskedAt.current = Date.now();
    void fetchPlatformConfig(API_BASE_URL).then((config) => {
      if (config && alive.current) {
        havePlatform.current = true;
        setPlatform(config);
      }
    });
  }, []);

  useEffect(() => {
    if (whiteLabel) return undefined;
    askPlatform();
    const subscription = AppState.addEventListener('change', (state) => {
      if (
        state === 'active' &&
        shouldAskPlatformAgain({ now: Date.now(), lastAskedAt: platformAskedAt.current, haveAnswer: havePlatform.current })
      ) {
        askPlatform();
      }
    });
    return () => subscription.remove();
  }, [whiteLabel, askPlatform]);
  // The platform answers one minimum for everyone and links to the generic app's listing. A shop's own app has
  // its own listing, so it is not held to that answer until the server answers per app (plan §5.9).
  const update = useMemo<UpdateState>(
    () => (whiteLabel ? { required: false } : updateStateFor(getAppVersion(), platform, Platform.OS)),
    [platform, whiteLabel]
  );

  // Everything held in memory for one store (cached answers, the cart on screen) is dropped when another store
  // is opened, so nothing from the last one can show in the next.
  useEffect(() => subscribeActiveStoreId(() => queryClient.clear()), []);

  // The store on screen follows what the device knows about it: a new name or colour, or the id the server
  // confirmed for a store carried over from the old layout.
  useEffect(
    () =>
      subscribeActiveStore((store) => {
        if (!store) return;
        setBoot((current) =>
          current.status === 'ready' && current.tenant.slug === store.slug ? { status: 'ready', tenant: store } : current
        );
      }),
    []
  );

  // A link or QR code that names a shop. In a shop's own app it is followed at once, as it always was. In the
  // generic app it is looked up and shown, and nothing changes until the person taps Open shop (plan §5.7).
  const receiveLink = useCallback(async (url: string) => {
    const mine = ++linkTicket.current;
    try {
      const previewed = await previewDeepLink(url, API_BASE_URL, { audience: 'shopper' });
      if (mine !== linkTicket.current || !previewed || !isShopperDeepLinkIntent(previewed.intent)) return;
      setPendingLink(previewed.result);
    } catch {
      // Ignore links that cannot be read.
    }
  }, []);

  useTenantDeepLink(async (url) => {
    if (!whiteLabel) {
      await receiveLink(url);
      return;
    }
    try {
      const tenant = await tryResolveShopperDeepLink(url);
      if (tenant) {
        setBoot({ status: 'ready', tenant });
      }
    } catch {
      // Ignore unknown links.
    }
  });

  // A link can arrive before the app has finished starting. It waits for the start to finish, then either
  // asks (a shop is open) or fills the picker (none is).
  // It also waits while a shop is being opened: the picker it would fill, or close, is the one doing it.
  useEffect(() => {
    if (!pendingLink || opening || boot.status === 'loading' || boot.status === 'error') return;
    const result = pendingLink;
    setPendingLink(null);
    if (boot.status === 'ready') {
      if (result.kind === 'found') {
        if (result.store.slug !== boot.tenant.slug) {
          const store = result.store;
          if (switching) {
            // The shop finder closes before the offer opens, and iOS cannot show one while the other is closing.
            setSwitching(false);
            afterModalCloses(() => setOffer(store), Platform.OS);
          } else {
            setOffer(store);
          }
        }
      } else {
        const copy = problemCopy(result, {
          method: 'link',
          codesEnabled: platform?.shopCodesEnabled ?? false,
          directoryEnabled: platform?.directoryEnabled ?? true,
        });
        Alert.alert(copy.title, copy.body);
      }
      return;
    }
    setBoot({
      status: 'picker',
      seed: result.kind === 'found' ? { store: result.store } : { problem: result, input: '' },
    });
  }, [pendingLink, boot, platform, opening, switching]);

  const shopNavigator = useMemo<ShopNavigator>(
    () => ({
      enabled: !whiteLabel,
      // The list of shops closes first, and iOS cannot show the shop finder while it is still closing.
      findAnother: () => afterModalCloses(() => setSwitching(true), Platform.OS),
      openRemembered: async (tenantId) => {
        const result = await openRememberedShop(tenantId);
        if (result.kind === 'opened') {
          setBoot({ status: 'ready', tenant: result.store });
        }
        return result;
      },
    }),
    [whiteLabel]
  );

  // The typeface is bundled with the app, so this resolves in a frame or two; the splash covers it. If
  // it ever fails the app still opens, in the system face.
  const [fontsLoaded, fontsError] = useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_800ExtraBold,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });
  const fontsReady = fontsLoaded || Boolean(fontsError);

  const handleSplashDone = useCallback(() => setSplashDone(true), []);
  // The shop finder cannot be closed while a shop is being opened from it.
  const leaveFinder = useCallback(() => {
    if (!opening) setSwitching(false);
  }, [opening]);

  // The splash can time out before the store resolves, so `loading` needs a real
  // screen behind it rather than nothing.
  let content: React.ReactNode = <BootPending />;
  if (boot.status === 'error') {
    content = <BootError message={boot.message} onRetry={runBootstrap} />;
  } else if (boot.status === 'picker') {
    content = (
      <>
        <TenantEntryScreen
          platform={platform}
          seed={boot.seed}
          onOpened={(store) => setBoot({ status: 'ready', tenant: store })}
        />
        <StatusBar style="dark" />
      </>
    );
  } else if (boot.status === 'ready') {
    content = (
      <QueryClientProvider client={queryClient}>
        <TenantProvider key={boot.tenant.slug} tenant={boot.tenant}>
          <ShopNavigatorProvider value={shopNavigator}>
            <RealtimeBridge />
            <AuthGateProvider>
              <AppNavigator />
              <DeliveryCoverage />
            </AuthGateProvider>
            <StatusBar style="dark" />
          </ShopNavigatorProvider>
        </TenantProvider>
      </QueryClientProvider>
    );
  }

  const openShop = boot.status === 'ready' ? boot.tenant : null;

  if (!fontsReady) {
    return <View style={styles.root} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
    <SafeAreaProvider>
      <View style={styles.root}>
        {update.required ? (
          <UpdateRequiredScreen update={update} appName={brandName(getTenantDisplayName())} />
        ) : (
          content
        )}
        {!update.required && openShop && !whiteLabel ? (
          <>
            <Modal visible={switching} animationType="slide" onRequestClose={leaveFinder}>
              {/* A modal is its own window on Android, so it needs its own safe-area provider. */}
              <SafeAreaProvider>
                <TenantEntryScreen
                  platform={platform}
                  currentShopName={openShop.displayName}
                  onCancel={leaveFinder}
                  onOpened={(store) => {
                    setSwitching(false);
                    setBoot({ status: 'ready', tenant: store });
                  }}
                />
              </SafeAreaProvider>
            </Modal>
            <LinkOfferModal
              store={offer}
              currentShopName={openShop.displayName}
              onDismiss={() => setOffer(null)}
              onOpened={(store) => {
                setOffer(null);
                setBoot({ status: 'ready', tenant: store });
              }}
            />
          </>
        ) : null}
        {splashDone ? null : (
          <BrandSplash
            ready={boot.status !== 'loading'}
            storeName={getTenantDisplayName()}
            onDone={handleSplashDone}
          />
        )}
      </View>
    </SafeAreaProvider>
    </GestureHandlerRootView>
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
    marginBottom: SPACE.xl,
    marginLeft: -SPACE.sm,
  },
  errorTitle: {
    ...TYPE.display,
    color: MART.ink,
  },
  errorBody: {
    ...TYPE.body,
    marginTop: SPACE.md,
    color: MART.inkMuted,
  },
  retry: {
    marginTop: SPACE.xxl,
  },
});
