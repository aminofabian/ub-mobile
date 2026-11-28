import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_PLATFORM_CONFIG,
  MIN_SEARCH_LENGTH,
  cleanSearchText,
  describeShopCodeProblem,
  listRememberedStores,
  parseScan,
  parseShopCode,
  parseStoreInput,
  previewStore,
  previewStoreByCode,
  searchStores,
  type PlatformConfig,
  type StoreResult,
  type StoreSnapshot,
} from '@kiosk/core';
import { ActionButton } from '../components/ActionButton';
import { HelpRow } from '../components/HelpRow';
import { ScanModal } from '../components/ScanModal';
import { StoreRow } from '../components/StoreRow';
import { StorePreviewCard } from '../components/StorePreviewCard';
import { API_BASE_URL, TENANT_HOST_SUFFIX } from '../lib/config';
import { PLATFORM_NAME } from '../lib/brand';
import { forgetShop } from '../lib/forget-shop';
import { openLookedUpStore, openRememberedShop } from '../lib/open-shop';
import {
  problemCopy,
  type EntryMethod,
  type Problem,
  type ProblemAction,
} from '../lib/picker-copy';
import { createSearchSession, type SearchSession, type SearchView } from '../lib/search-session';
import { cardFromHit, cardFromStore } from '../lib/store-card';
import { useOpening } from '../lib/useOpening';
import { Capsule, ChipButton } from '../components/Capsule';
import { Coast, COAST_SWELL } from '../components/Coast';
import { Field } from '../components/Field';
import { FONT, GUTTER, MART, onFill, RADIUS, SPACE, TYPE } from '../theme/mart';

/** Before a shop is chosen there is no shop colour: the land is the app's own green. */
const ON_LAND = onFill(MART.fallbackPrimary);

/** What a link already found, to show the moment the picker opens. */
export type PickerSeed = { store: StoreSnapshot } | { problem: Problem; input: string };

interface TenantEntryScreenProps {
  /** What the server said about the platform. Null until it answers; the defaults serve meanwhile. */
  platform: PlatformConfig | null;
  seed?: PickerSeed | null;
  /** Set when the picker is over a shop that is open: the way back to it. */
  onCancel?: () => void;
  currentShopName?: string;
  onOpened: (store: StoreSnapshot) => void;
}

type Lookup =
  | { kind: 'idle' }
  | { kind: 'busy'; method: EntryMethod }
  | { kind: 'preview'; method: EntryMethod; store: StoreSnapshot }
  | {
      kind: 'problem';
      method: EntryMethod;
      input: string;
      problem: Problem;
      again?: () => void;
      forget?: StoreSnapshot;
    };

function lookupFromSeed(seed: PickerSeed | null | undefined): Lookup {
  if (!seed) return { kind: 'idle' };
  if ('store' in seed) return { kind: 'preview', method: 'link', store: seed.store };
  return { kind: 'problem', method: 'link', input: seed.input, problem: seed.problem };
}

const ACTION_LABELS: Record<ProblemAction, string> = {
  retry: 'Try again',
  scan_again: 'Scan again',
  type_code: 'Type the code',
  search: 'Search by name',
  forget: 'Remove from this phone',
};

export function TenantEntryScreen({ platform, seed, onCancel, currentShopName, onOpened }: TenantEntryScreenProps) {
  const insets = useSafeAreaInsets();
  const config = platform ?? DEFAULT_PLATFORM_CONFIG;
  const codesEnabled = config.shopCodesEnabled;
  const directoryEnabled = config.directoryEnabled;
  // A shop is being opened somewhere in the app. Until it is open nothing on this screen can be started, and
  // the way back is shut: the shop would open behind a screen that was no longer there.
  const locked = useOpening();

  const [text, setText] = useState('');
  const [, setFocused] = useState(false);
  const [land, setLand] = useState(0);
  const [search, setSearch] = useState<SearchView>({ kind: 'idle' });
  const [recents, setRecents] = useState<StoreSnapshot[] | null>(null);
  const [lookup, setLookup] = useState<Lookup>(() => lookupFromSeed(seed));
  const [code, setCode] = useState('');
  const [, setCodeFocused] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);
  const sessionRef = useRef<SearchSession | null>(null);
  const ticket = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The search box: one session for the life of the screen.
  useEffect(() => {
    const session = createSearchSession(
      {
        search: (query) => searchStores(query, API_BASE_URL),
        clean: cleanSearchText,
        minLength: MIN_SEARCH_LENGTH,
      },
      setSearch,
    );
    sessionRef.current = session;
    return () => {
      session.dispose();
      sessionRef.current = null;
    };
  }, []);

  const refreshRecents = useCallback(async () => {
    try {
      const list = await listRememberedStores();
      if (mounted.current) setRecents(list);
    } catch {
      if (mounted.current) setRecents([]);
    }
  }, []);

  useEffect(() => {
    void refreshRecents();
  }, [refreshRecents]);

  // A person with no shops yet has nothing to choose from, so the keyboard is already up.
  useEffect(() => {
    if (recents !== null && recents.length === 0 && lookup.kind === 'idle' && directoryEnabled && !seed) {
      inputRef.current?.focus();
    }
    // Only when the list first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recents === null]);

  // A link that arrives while the picker is open replaces what is on screen.
  useEffect(() => {
    if (seed) {
      ticket.current += 1;
      setLookup(lookupFromSeed(seed));
      setOpenError(null);
    }
  }, [seed]);

  const dismissLookup = useCallback(() => {
    ticket.current += 1;
    setLookup({ kind: 'idle' });
    setOpenError(null);
  }, []);

  // Back closes the preview before it leaves the screen.
  useEffect(() => {
    if (lookup.kind === 'idle') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissLookup();
      return true;
    });
    return () => subscription.remove();
  }, [lookup.kind, dismissLookup]);

  const runLookup = useCallback(
    (
      method: EntryMethod,
      input: string,
      find: () => Promise<StoreResult>,
      options: { forget?: StoreSnapshot; onNotFound?: () => void } = {},
    ) => {
      const mine = ++ticket.current;
      setLookup({ kind: 'busy', method });
      setOpenError(null);
      const again = () => runLookup(method, input, find, options);
      void (async () => {
        let result: StoreResult;
        try {
          result = await find();
        } catch {
          result = { kind: 'offline' };
        }
        if (!mounted.current || mine !== ticket.current) return;
        if (result.kind === 'found') {
          setLookup({ kind: 'preview', method, store: result.store });
        } else if (result.kind === 'not_found' && options.onNotFound) {
          setLookup({ kind: 'idle' });
          options.onNotFound();
        } else {
          setLookup({ kind: 'problem', method, input, problem: result, again, forget: options.forget });
        }
      })();
    },
    [],
  );

  const lookUpSlug = useCallback(
    (method: EntryMethod, slug: string, options?: { onNotFound?: () => void }) =>
      runLookup(method, slug, () => previewStore(slug, API_BASE_URL, { audience: 'shopper' }), options),
    [runLookup],
  );

  const lookUpCode = useCallback(
    (method: EntryMethod, shopCode: string) =>
      runLookup(method, shopCode, () => previewStoreByCode(shopCode, API_BASE_URL, { audience: 'shopper' })),
    [runLookup],
  );

  function handleChangeText(value: string) {
    setText(value);
    if (lookup.kind !== 'idle') dismissLookup();
    sessionRef.current?.update(value);
  }

  function handleGo() {
    const typed = text.trim();
    if (!typed) return;
    const query = parseStoreInput(typed);
    if (!query || /\s/.test(typed)) {
      sessionRef.current?.submit();
      return;
    }
    // One word may be a shop's short name or just a word in its name: try it as a name first, and if
    // nothing answers to it, search.
    lookUpSlug(query.kind === 'host' ? 'address' : 'name', typed, {
      onNotFound: query.kind === 'slug' && directoryEnabled ? () => sessionRef.current?.submit() : undefined,
    });
  }

  const handleScanned = useCallback(
    (data: string) => {
      setScanning(false);
      const target = parseScan(data);
      if (target.kind === 'unknown') {
        setLookup({ kind: 'problem', method: 'scan', input: data, problem: { kind: 'not_a_shop' } });
      } else if (target.kind === 'code') {
        if (codesEnabled) {
          lookUpCode('scan', target.code);
        } else {
          // The server has no shop codes yet, so there is nothing to ask it.
          setLookup({ kind: 'problem', method: 'scan', input: data, problem: { kind: 'not_found' } });
        }
      } else {
        lookUpSlug('scan', target.input);
      }
    },
    [codesEnabled, lookUpCode, lookUpSlug],
  );

  const parsedCode = parseShopCode(code);
  const codeHint = describeShopCodeProblem(parsedCode);

  function handleCode() {
    if (parsedCode.kind !== 'ok') return;
    Keyboard.dismiss();
    lookUpCode('code', parsedCode.code);
  }

  const openRecent = useCallback(
    async (store: StoreSnapshot) => {
      setOpeningId(store.businessId);
      setOpenError(null);
      try {
        const result = await openRememberedShop(store.businessId);
        if (result.kind === 'busy') return; // another shop is being opened; nothing was started
        if (result.kind === 'opened') {
          // Always told to the app, even if this screen has gone: the phone has opened the shop, so the app must show it.
          onOpened(result.store);
          return;
        }
        if (!mounted.current) return;
        if (result.kind === 'blocked') {
          setOpenError('Could not switch shops right now. Try again.');
        } else {
          setLookup({
            kind: 'problem',
            method: 'recent',
            input: store.displayName,
            problem: result,
            again: () => void openRecent(store),
            forget: result.kind === 'not_found' ? store : undefined,
          });
        }
      } catch {
        if (mounted.current) setOpenError('Something went wrong opening that shop. Try again.');
      } finally {
        if (mounted.current) setOpeningId(null);
      }
    },
    [onOpened],
  );

  async function handleOpen(store: StoreSnapshot) {
    setOpening(true);
    setOpenError(null);
    try {
      const result = await openLookedUpStore(store);
      if (result === 'busy') return; // another shop is being opened; nothing was started
      if (result === 'opened') {
        onOpened(store); // as in openRecent: always told to the app
        return;
      }
      if (!mounted.current) return;
      setOpenError('Could not switch shops right now. Try again.');
    } catch {
      if (mounted.current) setOpenError('Something went wrong opening that shop. Try again.');
    } finally {
      if (mounted.current) setOpening(false);
    }
  }

  function runAction(action: ProblemAction) {
    const current = lookup;
    if (action === 'retry') {
      if (current.kind === 'problem' && current.again) current.again();
      return;
    }
    if (action === 'forget') {
      if (current.kind === 'problem' && current.forget) {
        const target = current.forget;
        dismissLookup();
        void forgetShop(target).then(() => refreshRecents());
      }
      return;
    }
    dismissLookup();
    if (action === 'scan_again') {
      setScanning(true);
    } else if (action === 'type_code') {
      setTimeout(() => codeRef.current?.focus(), 50);
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const sectionOpen = lookup.kind === 'idle';
  const showRows = search.kind === 'results' || (search.kind === 'searching' && search.hits.length > 0);
  const rows = search.kind === 'results' || search.kind === 'searching' ? search.hits : [];
  const showRecents = sectionOpen && !showRows && (recents?.length ?? 0) > 0;

  const intro = directoryEnabled
    ? `Search by name, or scan the QR code at the till${codesEnabled ? ', or type the shop code' : ''}.`
    : `Scan the QR code at the till${codesEnabled ? ', or type the shop code' : ''}.`;

  return (
    <KeyboardAvoidingView style={styles.shell} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={locked ? styles.locked : undefined}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACE.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          onLayout={(event) => setLand(Math.round(event.nativeEvent.layout.height))}
          // Until the land has been measured it is a plain field, so the cream words are never on cream.
          style={[
            styles.land,
            { paddingTop: insets.top + SPACE.md },
            land === 0 && { backgroundColor: MART.fallbackPrimary },
          ]}
        >
          {land > 0 ? <Coast color={MART.fallbackPrimary} height={land} /> : null}
          <View style={styles.landTop}>
            <Text numberOfLines={1} style={styles.markText}>
              {PLATFORM_NAME}
            </Text>
            {onCancel ? (
              <ChipButton
                icon="close"
                label={currentShopName ? `Back to ${currentShopName}` : 'Back'}
                onPress={onCancel}
                fill={ON_LAND.primary}
                color={MART.fallbackPrimary}
              />
            ) : null}
          </View>

          <Text accessibilityRole="header" style={styles.title}>
            Find your shop
          </Text>
          <Text style={styles.body}>{intro}</Text>

          <View style={styles.searchRow}>
            {directoryEnabled ? (
              <Field
                ref={inputRef}
                icon="search"
                containerStyle={styles.searchField}
                placeholder="Search shops by name"
                value={text}
                onChangeText={handleChangeText}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={handleGo}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search shops by name"
                trailing={
                  text ? (
                    <Pressable
                      onPress={() => {
                        handleChangeText('');
                        inputRef.current?.focus();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Clear search"
                      hitSlop={12}
                    >
                      <Ionicons name="close-circle" size={20} color={MART.inkMuted} />
                    </Pressable>
                  ) : null
                }
              />
            ) : null}
            {directoryEnabled ? (
              <ChipButton
                icon="qr-code-outline"
                label="Scan a shop QR code"
                onPress={() => setScanning(true)}
                fill={MART.fallbackAccent}
                size={54}
              />
            ) : (
              <Capsule
                label="Scan a QR code"
                chip="qr-code-outline"
                fill={MART.fallbackAccent}
                accessibilityLabel="Scan a shop QR code"
                onPress={() => setScanning(true)}
                style={styles.searchField}
              />
            )}
          </View>
        </View>

        <View style={styles.content}>
        {lookup.kind === 'busy' ? (
          <View style={styles.busy} accessibilityLiveRegion="polite">
            <ActivityIndicator color={MART.ink} />
            <Text style={styles.busyText}>Looking for the shop</Text>
          </View>
        ) : null}

        {lookup.kind === 'preview' ? (
          <View style={styles.section}>
            <StorePreviewCard
              store={lookup.store}
              busy={opening}
              error={openError}
              note={currentShopName ? `Your basket at ${currentShopName} stays where it is.` : undefined}
              onOpen={() => void handleOpen(lookup.store)}
              onDismiss={dismissLookup}
            />
          </View>
        ) : null}

        {lookup.kind === 'problem' ? (
          <ProblemPanel
            lookup={lookup}
            codesEnabled={codesEnabled}
            directoryEnabled={directoryEnabled}
            onAction={runAction}
            onBack={dismissLookup}
          />
        ) : null}

        {sectionOpen && search.kind === 'searching' && !showRows ? (
          <View style={styles.busy} accessibilityLiveRegion="polite">
            <ActivityIndicator color={MART.ink} />
            <Text style={styles.busyText}>Searching</Text>
          </View>
        ) : null}

        {sectionOpen && showRows ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionHead}>Shops</Text>
            <View style={styles.list}>
              {rows.map((hit) => (
                <StoreRow
                  key={hit.slug}
                  card={cardFromHit(hit, TENANT_HOST_SUFFIX)}
                  dimmed={search.kind === 'searching'}
                  onPress={() => lookUpSlug('name', hit.slug)}
                  hint="Shows this shop before opening it"
                />
              ))}
            </View>
          </View>
        ) : null}

        {sectionOpen && search.kind === 'empty' ? (
          <InlineProblem
            copy={problemCopy({ kind: 'not_found' }, { method: 'name', input: search.text, codesEnabled, directoryEnabled })}
            onAction={runAction}
          />
        ) : null}
        {sectionOpen && search.kind === 'offline' ? (
          <InlineProblem
            copy={problemCopy({ kind: 'offline' }, { method: 'name', codesEnabled, directoryEnabled })}
            onAction={() => sessionRef.current?.retry()}
          />
        ) : null}
        {sectionOpen && search.kind === 'rate_limited' ? (
          <InlineProblem
            copy={problemCopy(
              { kind: 'rate_limited', retryAfterSec: search.retryAfterSec },
              { method: 'name', codesEnabled, directoryEnabled },
            )}
            onAction={() => sessionRef.current?.retry()}
          />
        ) : null}
        {sectionOpen && search.kind === 'unavailable' ? (
          <InlineProblem
            copy={{
              title: 'Search is not available right now',
              body: codesEnabled
                ? 'Scan the QR code at the till, or type the shop code.'
                : 'Scan the QR code at the till instead.',
              actions: [],
            }}
            onAction={runAction}
          />
        ) : null}

        {showRecents ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionHead}>Your shops</Text>
            <View style={styles.list}>
              {(recents ?? []).map((store) => (
                <StoreRow
                  key={store.businessId}
                  card={cardFromStore(store, TENANT_HOST_SUFFIX)}
                  busy={openingId === store.businessId}
                  onPress={() => void openRecent(store)}
                  hint="Opens this shop"
                />
              ))}
            </View>
            {openError ? (
              <View style={styles.errorBox}>
                <Text accessibilityLiveRegion="polite" style={styles.error}>
                  {openError}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {sectionOpen && !showRows && codesEnabled ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionHead}>Have a shop code?</Text>
            <View style={styles.codeRow}>
              <Field
                ref={codeRef}
                containerStyle={styles.codeField}
                style={styles.codeInput}
                placeholder="K7M4Q"
                value={code}
                onChangeText={setCode}
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
                onSubmitEditing={handleCode}
                returnKeyType="go"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                accessibilityLabel="Shop code"
                error={codeHint}
              />
              <Capsule
                label="Find"
                onPress={handleCode}
                disabled={parsedCode.kind !== 'ok'}
                stretch={false}
                style={styles.codeButton}
              />
            </View>
          </View>
        ) : null}

        {sectionOpen && !showRows && config.demoShop ? (
          <View style={styles.section}>
            <ActionButton
              label="Try the demo shop"
              kind="quiet"
              onPress={() => lookUpSlug('demo', config.demoShop as string)}
              accessibilityHint="Shows a sample shop you can look around"
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <HelpRow support={config.support} />
        </View>
        </View>
      </ScrollView>

      <ScanModal
        visible={scanning}
        codesEnabled={codesEnabled}
        directoryEnabled={directoryEnabled}
        onClose={() => setScanning(false)}
        onScanned={handleScanned}
        onTypeCode={() => {
          setScanning(false);
          setTimeout(() => codeRef.current?.focus(), 400);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function ProblemPanel({
  lookup,
  codesEnabled,
  directoryEnabled,
  onAction,
  onBack,
}: {
  lookup: Extract<Lookup, { kind: 'problem' }>;
  codesEnabled: boolean;
  directoryEnabled: boolean;
  onAction: (action: ProblemAction) => void;
  onBack: () => void;
}) {
  const copy = problemCopy(lookup.problem, { method: lookup.method, input: lookup.input, codesEnabled, directoryEnabled });
  const actions = copy.actions.filter((action) => action !== 'retry' || lookup.again);
  return (
    <View style={styles.section}>
      <View style={[styles.problem, styles.problemHard]} accessibilityLiveRegion="polite">
        <Text style={styles.problemTitle}>{copy.title}</Text>
        <Text style={styles.problemBody}>{copy.body}</Text>
      </View>
      <View style={styles.problemActions}>
        {actions.map((action, index) => (
          <ActionButton
            key={action}
            label={ACTION_LABELS[action]}
            kind={index === 0 ? 'primary' : 'quiet'}
            onPress={() => onAction(action)}
          />
        ))}
        <ActionButton label="Back" kind="quiet" onPress={onBack} />
      </View>
    </View>
  );
}

function InlineProblem({
  copy,
  onAction,
}: {
  copy: { title: string; body: string; actions: ProblemAction[] };
  onAction: (action: ProblemAction) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.problem} accessibilityLiveRegion="polite">
        <Text style={styles.problemTitle}>{copy.title}</Text>
        <Text style={styles.problemBody}>{copy.body}</Text>
      </View>
      {copy.actions.length > 0 ? (
        <View style={styles.problemActions}>
          {copy.actions.map((action, index) => (
            <ActionButton
              key={action}
              label={ACTION_LABELS[action]}
              kind={index === 0 ? 'primary' : 'quiet'}
              onPress={() => onAction(action)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  // A shop is being opened: nothing on the screen takes a tap until it is open or has failed.
  locked: {
    pointerEvents: 'none',
  },
  land: {
    paddingHorizontal: GUTTER,
    paddingBottom: SPACE.xl,
    marginBottom: COAST_SWELL,
  },
  landTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    marginBottom: SPACE.xl,
  },
  markText: {
    ...TYPE.heading,
    flex: 1,
    color: ON_LAND.primary,
  },
  title: {
    ...TYPE.display,
    fontSize: 40,
    lineHeight: 40,
    color: ON_LAND.primary,
  },
  body: {
    ...TYPE.body,
    marginTop: SPACE.md,
    maxWidth: 340,
    color: ON_LAND.secondary,
  },
  searchRow: {
    marginTop: SPACE.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  searchField: {
    flex: 1,
  },
  content: {
    paddingHorizontal: GUTTER,
  },
  section: {
    marginTop: SPACE.xxl,
    gap: SPACE.md,
  },
  sectionHead: {
    ...TYPE.title,
    color: MART.ink,
  },
  list: {
    gap: SPACE.sm,
  },
  busy: {
    marginTop: SPACE.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  busyText: {
    ...TYPE.body,
    color: MART.inkMuted,
  },
  errorBox: {
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.dangerSurface,
  },
  error: {
    ...TYPE.label,
    color: MART.danger,
  },
  problem: {
    padding: SPACE.xl,
    gap: SPACE.xs,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.infoSurface,
  },
  problemHard: {
    backgroundColor: MART.dangerSurface,
  },
  problemTitle: {
    ...TYPE.heading,
    color: MART.ink,
  },
  problemBody: {
    ...TYPE.body,
    color: MART.ink,
  },
  problemActions: {
    gap: SPACE.sm,
  },
  codeRow: {
    flexDirection: 'row',
    gap: SPACE.sm,
    alignItems: 'flex-start',
  },
  codeField: {
    flex: 1,
  },
  codeInput: {
    fontFamily: FONT.bold,
    letterSpacing: 2,
  },
  codeButton: {
    minWidth: 96,
  },
});
