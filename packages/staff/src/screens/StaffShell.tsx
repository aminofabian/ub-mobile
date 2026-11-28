import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import {
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
} from '@expo-google-fonts/schibsted-grotesk';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Text, theme } from '@kiosk/ui';
import {
  APP_NAMES,
  checkTillRegistration,
  clearKnownStaff,
  createApiClient,
  endSession,
  fetchBranches,
  fetchMe,
  fetchPlatformConfig,
  fetchShiftsDisabled,
  forgetKnownStaff,
  forgetTillRegistered,
  getEmbeddedTenantSlug,
  getOrCreateTillDeviceId,
  getTenantDisplayName,
  getUnsentSummary,
  loadKnownStaff,
  parseTenantDeepLink,
  rememberStaff,
  removeKnownStaff,
  requestTillAccess,
  shiftsAreDisabled,
  type ApiClient,
  type BranchOption,
  type KnownStaff,
  type PlatformConfig,
  type StaffApp,
  type StaffUser,
  type TenantContext,
} from '@kiosk/core';
import { MART } from '../theme/mart';
import { useStaffBoot } from '../hooks/useStaffBoot';
import { enterApp, enterBranch, type EntryQuestions, type EntryStage } from '../lib/entry';
import { describeEntryNotice, type NoticeActionId, type NoticeStage } from '../lib/notices';
import { endsSessionOn, judgeSignIn, mayFollowShopLink, sessionLossMatters, wantsEntryAnswer } from '../lib/shell-guards';
import { confirmSignOut, leaveStore } from '../lib/store-switch';
import { useAuthStore } from '../store/auth-store';
import { BranchSelectScreen } from './BranchSelectScreen';
import { NoticeScreen } from './NoticeScreen';
import { PairScreen, type PairScannerRenderer } from './PairScreen';
import { SignInScreen, type SignedInDetails } from './SignInScreen';
import { TenantEntryScreen } from './TenantEntryScreen';
import { WhiteLabelErrorScreen } from './WhiteLabelErrorScreen';

/** What an app gets once the person is signed in, fits the app, and is at a branch. */
export interface StaffSession {
  api: ApiClient;
  tenant: TenantContext;
  user: StaffUser;
  branchId: string;
  branchName: string | null;
  /** The shop runs without shifts: the till never asks the person to open one (plan §5.6). */
  shiftsDisabled: boolean;
  /**
   * Ends the session on this phone, then shows the sign-in screen. Works with no connection. Resolves true once the
   * session has ended, and false when it did not: the person was asked about unsent sales and chose to stay signed in.
   */
  signOut: () => Promise<boolean>;
}

export interface StaffShellProps {
  app: StaffApp;
  baseURL: string;
  /** A password beside the PIN (the Cashier and Admin offer it). */
  allowPassword?: boolean;
  /** This phone works as a till (the Cashier): ask whether it is still a registered one. */
  isTill?: boolean;
  /** Saves the sales that were never sent as text the person can keep. Passed by the Cashier. */
  exportUnsent?: () => Promise<void>;
  /** The shop has taken this phone off as a till: the app lets go of what it kept for that shop. Must not throw. */
  onRemoved?: (shopId: string) => void | Promise<void>;
  /** Draws the camera for the pairing QR. Only apps that ship the camera module pass it; the rest type the code. */
  renderScanner?: PairScannerRenderer;
  children: (session: StaffSession) => React.ReactNode;
}

type Stage =
  | { name: 'signin' }
  | { name: 'checking' }
  | { name: 'signing_out' }
  | { name: 'pairing' }
  | Exclude<EntryStage, { name: 'signed_out' }>;

const SESSION_ENDED = 'You were signed out. Sign in again.';

/** The shop that is open now, by its slug, which does not change when its id goes from provisional to confirmed. */
function openShop(): string | undefined {
  return useAuthStore.getState().tenant?.slug;
}

/**
 * One way into every staff app (plan §5.11, §5.12): find the shop, sign in with a PIN, learn who the
 * person is from the server, check the app fits them, work out the branch, and only then open the app.
 * The four apps used to carry their own copy of this; they now render their screens inside it.
 */
export function StaffShell({ app, baseURL, allowPassword = false, isTill = false, exportUnsent, onRemoved, renderScanner, children }: StaffShellProps) {
  // UI type is the device face (SF Pro / Roboto) — same as the soft POS mockups. Custom faces stay
  // loaded only for leftover call sites that still name them. If loading fails, nothing breaks.
  const [fontsLoaded, fontsError] = useFonts({
    SandeMore_400Regular: require('../../assets/fonts/SandeMore-Regular.otf'),
    SandeMore_500Medium: require('../../assets/fonts/SandeMore-Medium.otf'),
    SandeMore_700Bold: require('../../assets/fonts/SandeMore-Bold.otf'),
    SandeMore_800ExtraBold: require('../../assets/fonts/SandeMore-ExtraBold.otf'),
    DMSans_400Regular: require('../../assets/fonts/DMSans-Regular.ttf'),
    DMSans_500Medium: require('../../assets/fonts/DMSans-Medium.ttf'),
    DMSans_600SemiBold: require('../../assets/fonts/DMSans-SemiBold.ttf'),
    DMSans_700Bold: require('../../assets/fonts/DMSans-Bold.ttf'),
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_800ExtraBold,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });
  const { tenant, setTenant, setBranch, setEmail, setAuthenticated, reset } = useAuthStore();
  // The stage as the code that reacts to a late answer or a link sees it. Set together with the state (see `go`), so
  // there is no render in between in which they could still find the old one.
  const stageRef = useRef<Stage>({ name: 'signin' });
  const { phase, setPhase, bootError, retry } = useStaffBoot(baseURL, setTenant, (url) =>
    mayFollowShopLink(stageRef.current.name, parseTenantDeepLink(url), useAuthStore.getState().tenant)
  );
  const [stage, setStage] = useState<Stage>({ name: 'signin' });
  const [banner, setBanner] = useState<string | null>(null);
  const [known, setKnown] = useState<KnownStaff[]>([]);
  const [platform, setPlatform] = useState<PlatformConfig | null>(null);
  const [unsent, setUnsent] = useState(0);
  const [busy, setBusy] = useState(false);
  // Which attempt is current: an answer that arrives after the person signed out, or left, is dropped.
  const attempt = useRef(0);
  const typedEmail = useRef('');
  const go = useCallback((next: Stage) => {
    stageRef.current = next;
    setStage(next);
  }, []);

  const canChangeStore = !getEmbeddedTenantSlug();
  const pairingEnabled = platform?.pairingEnabled === true;
  const tenantId = tenant?.businessId ?? null;
  // The shop's own name for itself. Its id changes once, from a provisional one to the server's, and that is
  // the same shop; its slug does not.
  const tenantSlug = tenant?.slug ?? null;
  const shopName = tenant?.displayName ?? getTenantDisplayName() ?? undefined;
  const appTitle = `${shopName ?? 'Kiosk'} ${APP_NAMES[app]}`;

  const api = useMemo(
    () =>
      createApiClient({
        baseURL,
        onAuthFailed: () => {
          // Sign-in, pairing and signing out have no session to lose. A request that was already on its way
          // when the person signed out must not put "You were signed out" on the screen they just reached.
          if (!sessionLossMatters(stageRef.current.name)) return;
          attempt.current += 1;
          setAuthenticated(false);
          setBanner(SESSION_ENDED);
          go({ name: 'signin' });
        },
      }),
    [baseURL, go, setAuthenticated]
  );

  // The app does not pick up a session from before it started: the person signs in. So it does not keep one
  // either. A phone that was killed, crashed or ran flat with someone signed in would otherwise hold their
  // session, and its month-long refresh token, until the next sign-in.
  const coldStart = useRef(true);
  useEffect(() => {
    if (!tenantSlug || !coldStart.current) return;
    coldStart.current = false;
    void endSession(baseURL).catch(() => undefined);
  }, [tenantSlug, baseURL]);

  useEffect(() => {
    let alive = true;
    void fetchPlatformConfig(baseURL).then((config) => {
      if (alive) setPlatform(config);
    });
    return () => {
      alive = false;
    };
  }, [baseURL]);

  // A different shop starts from nothing: the sign-in and branch on screen belonged to the old one.
  useEffect(() => {
    attempt.current += 1;
    go({ name: 'signin' });
    setBanner(null);
    setAuthenticated(false);
    // The people and the unsent sales on screen belonged to the shop that was left.
    setKnown([]);
    setUnsent(0);
  }, [tenantSlug, go, setAuthenticated]);

  useEffect(() => {
    if (!tenantId || stage.name !== 'signin') return;
    let alive = true;
    void loadKnownStaff(tenantId)
      .then((people) => {
        if (alive) setKnown(people);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [tenantId, stage.name]);

  useEffect(() => {
    if (!tenantId || stage.name !== 'removed') return;
    let alive = true;
    void getUnsentSummary(tenantId)
      .then((summary) => {
        if (alive) setUnsent(summary.total);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [tenantId, stage.name]);

  const questions = useCallback(
    (id: string): EntryQuestions => ({
      app,
      loadMe: () => fetchMe(api),
      loadBranches: () => fetchBranches(baseURL),
      ...(isTill
        ? {
            checkTill: (branchId: string) => checkTillRegistration(api, id, branchId),
            askTillAccess: async (branchId: string) => {
              const deviceKey = await getOrCreateTillDeviceId(id);
              if (!deviceKey) return;
              await requestTillAccess(api, { branchId, deviceKey });
            },
            // A shop that runs without shifts says so in its public settings, which need no sign-in.
            loadShiftsDisabled: () => fetchShiftsDisabled(baseURL, useAuthStore.getState().tenant?.host),
          }
        : {}),
    }),
    [api, app, baseURL, isTill]
  );

  const arrive = useCallback(
    (next: EntryStage) => {
      if (next.name === 'signed_out') {
        setAuthenticated(false);
        setBanner(SESSION_ENDED);
        go({ name: 'signin' });
        return;
      }
      const id = useAuthStore.getState().tenant?.businessId;
      if (next.name === 'ready') {
        const email = next.user.email || typedEmail.current;
        setBranch({ id: next.branchId, name: next.branchName ?? '' });
        setEmail(email);
        setAuthenticated(true);
        if (id && email) void rememberStaff({ email, name: next.user.name }, id).catch(() => undefined);
      } else {
        setAuthenticated(false);
        // A phone that is no longer a till here keeps no list of the people who worked it.
        if (next.name === 'removed' && id) {
          void clearKnownStaff(id).catch(() => undefined);
          if (onRemoved) void Promise.resolve(onRemoved(id)).catch(() => undefined);
        }
        // Nothing on these screens uses the session, so it does not stay on the phone: the person cannot use this
        // app, or this phone, or has no branch to work at, and the only way on is to sign in again.
        if (endsSessionOn(next.name)) void endSession(baseURL).catch(() => undefined);
      }
      go(next);
    },
    [baseURL, go, onRemoved, setAuthenticated, setBranch, setEmail]
  );

  const enter = useCallback(async () => {
    const shop = useAuthStore.getState().tenant;
    if (!shop) return;
    const mine = ++attempt.current;
    go({ name: 'checking' });
    const next = await enterApp(questions(shop.businessId));
    if (wantsEntryAnswer({ attempt: mine, shop: shop.slug }, { attempt: attempt.current, shop: openShop() })) arrive(next);
  }, [arrive, go, questions]);

  const choose = useCallback(
    async (user: StaffUser, branch: BranchOption) => {
      const shop = useAuthStore.getState().tenant;
      if (!shop) return;
      const mine = ++attempt.current;
      go({ name: 'checking' });
      const next = await enterBranch(questions(shop.businessId), user, branch);
      if (wantsEntryAnswer({ attempt: mine, shop: shop.slug }, { attempt: attempt.current, shop: openShop() })) arrive(next);
    },
    [arrive, go, questions]
  );

  // A second tap while the question is on screen, or while the sign-out is under way, is the same request.
  const leaving = useRef(false);

  const signOut = useCallback(async (): Promise<boolean> => {
    if (leaving.current) return false;
    leaving.current = true;
    try {
      // Sales that were never sent go out under whoever signs in next, so the person is asked first.
      if (!(await confirmSignOut(useAuthStore.getState().tenant?.displayName))) return false;
      attempt.current += 1;
      const id = useAuthStore.getState().tenant?.businessId;
      const wasRemoved = stageRef.current.name === 'removed';
      // The sign-in screen waits until the session on this phone is gone. That is quick and never needs the
      // network: the tokens are cleared first and the server is told in the background, with a time limit.
      go({ name: 'signing_out' });
      try {
        await endSession(baseURL);
      } catch {
        // Whatever went wrong, the person is signed out of this phone.
      }
      // The person has been told the phone is no longer a till here, and has now left that screen: it does not
      // keep saying so at every sign-in after.
      if (wasRemoved && id) await forgetTillRegistered(id).catch(() => undefined);
      setAuthenticated(false);
      setBanner(null);
      go({ name: 'signin' });
      return true;
    } finally {
      leaving.current = false;
    }
  }, [baseURL, go, setAuthenticated]);

  const changeStore = useCallback(async () => {
    if (!canChangeStore) return;
    // Sales that were never sent are asked about first; leaving without confirming changes nothing.
    if (!(await leaveStore(useAuthStore.getState().tenant?.displayName))) return;
    attempt.current += 1;
    reset();
    go({ name: 'signin' });
    setPhase('tenant');
  }, [canChangeStore, go, reset, setPhase]);

  const signedIn = useCallback(
    (details: SignedInDetails) => {
      const verdict = judgeSignIn(details.shop, { shop: openShop(), stage: stageRef.current.name });
      if (verdict === 'drop') return;
      if (verdict === 'end') {
        // The answer came after the person left the sign-in screen, so a PIN typed there opens nothing.
        void endSession(baseURL).catch(() => undefined);
        return;
      }
      typedEmail.current = details.email;
      setBanner(null);
      void enter();
    },
    [baseURL, enter]
  );

  const forget = useCallback(
    (email: string) => {
      setKnown((people) => removeKnownStaff(people, email));
      if (tenantId) void forgetKnownStaff(email, tenantId).catch(() => undefined);
    },
    [tenantId]
  );

  if ((!fontsLoaded && !fontsError) || phase === 'loading') return <View style={styles.blank} />;
  if (phase === 'error' && bootError) return <WhiteLabelErrorScreen message={bootError} onRetry={retry} />;
  if (phase === 'tenant' || !tenant) {
    return (
      <TenantEntryScreen
        baseURL={baseURL}
        appTitle={appTitle}
        onTenantResolved={(resolved: TenantContext) => {
          setTenant(resolved);
          // The boot hook calls "a shop is chosen" by this name; the shell decides what comes next.
          setPhase('branch');
        }}
      />
    );
  }

  switch (stage.name) {
    case 'checking':
    case 'signing_out':
      return (
        <View style={styles.center} accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.colors.primary} />
          <Text variant="muted" style={styles.checking}>
            {stage.name === 'checking' ? 'Checking your account...' : 'Signing out...'}
          </Text>
        </View>
      );

    case 'signin':
      return (
        <SignInScreen
          // A different shop gets a screen of its own: nothing typed, listed or sent for the old one carries over.
          key={tenantSlug ?? 'none'}
          baseURL={baseURL}
          shop={tenantSlug ?? ''}
          shopName={shopName}
          allowPassword={allowPassword}
          pairingEnabled={pairingEnabled}
          knownStaff={known}
          notice={banner}
          onSignedIn={signedIn}
          onForgetStaff={forget}
          onPair={pairingEnabled ? () => go({ name: 'pairing' }) : undefined}
          onChangeStore={canChangeStore ? () => void changeStore() : undefined}
        />
      );

    case 'pairing':
      return (
        <PairScreen
          baseURL={baseURL}
          tenant={tenant}
          renderScanner={renderScanner}
          onCancel={() => go({ name: 'signin' })}
          onPaired={(branchName) => {
            setBanner(`This phone is now a till at ${branchName}. Sign in with your PIN.`);
            go({ name: 'signin' });
          }}
        />
      );

    case 'pick_branch': {
      const { user, branches } = stage;
      return (
        <BranchSelectScreen
          branches={branches}
          onSelect={(branch) => void choose(user, branch)}
          storeName={shopName}
          title="Which branch are you at?"
          backLabel="Sign out"
          onChangeStore={() => void signOut()}
        />
      );
    }

    case 'ready':
      return (
        <>
          {children({
            api,
            tenant,
            user: stage.user,
            branchId: stage.branchId,
            branchName: stage.branchName,
            shiftsDisabled: shiftsAreDisabled(tenant) || stage.shiftsDisabled,
            signOut,
          })}
        </>
      );

    default: {
      const noticeStage: NoticeStage = stage;
      const notice = describeEntryNotice(noticeStage, {
        app,
        shopName,
        host: tenant.host,
        pairingEnabled,
        unsentCount: unsent,
      });
      const actions = notice.actions.filter((action) => action.id !== 'save_unsent' || exportUnsent !== undefined);
      const act = async (id: NoticeActionId) => {
        switch (id) {
          case 'retry':
            await enter();
            return;
          case 'sign_out':
            await signOut();
            return;
          case 'open_web':
            if (notice.webUrl) await Linking.openURL(notice.webUrl).catch(() => undefined);
            return;
          case 'save_unsent':
            setBusy(true);
            try {
              await exportUnsent?.();
            } catch {
              Alert.alert('Could not save the sales', 'They are still on this phone. Try again.');
            } finally {
              setBusy(false);
            }
            return;
          case 'pair':
            go({ name: 'pairing' });
            return;
        }
      };
      return <NoticeScreen notice={{ ...notice, actions }} onAction={(id) => void act(id)} busy={busy} />;
    }
  }
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: MART.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  checking: { marginTop: theme.spacing.md },
});
