import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTenant } from '../lib/TenantContext';
import { useSession } from '../hooks/useSession';
import {
  fetchKplcConfig,
  fetchKplcTokens,
  saveKplcMeter,
  setKplcDepletionAlerts,
  type KplcHistory,
  type KplcMeter,
  type KplcMonthSpend,
  type KplcToken,
} from '../api/services';
import { looksLikeKenyanMobile, toKenyanLocal07 } from '../lib/phone';
import { loadTabPhone, saveTabPhone } from '../lib/remembered-phone';
import {
  formatKplcClock,
  formatKplcTimeLeft,
  formatMeterDisplay,
  formatRelativeTokenTime,
  formatTokenNo,
  kplcEstimateCopy,
  resolveKplcEstimate,
  resolveKplcStats,
} from '../lib/kplc';
import { failFeel, stepFeel } from '../lib/haptics';
import { formatMoney, moneyFromUnknown } from '../lib/media';
import { Capsule, PressScale } from '../components/Capsule';
import { Coast, COAST_SWELL, Lobe } from '../components/Coast';
import { Field } from '../components/Field';
import { FONT, GUTTER, MART, martFromTenant, RADIUS, SPACE, TILE, TYPE, ZONE } from '../theme/mart';

const LAND = ZONE.lilac;

/**
 * The top of the errand: its zone colour running down from the navigation bar to a curved coast, with
 * the heading on it. The coast sits wherever the words end, so a long heading or large text still fits.
 */
function ZoneHead({ title, body, numeric = false }: { title: string; body: string; numeric?: boolean }) {
  const [height, setHeight] = useState(0);
  return (
    <View style={styles.head}>
      <View style={styles.headOverscroll} />
      {height > 0 ? <Coast color={LAND} height={height} /> : null}
      <View style={styles.headCopy} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
        <Text accessibilityRole="header" style={[styles.headTitle, numeric && styles.headNumeric]}>
          {title}
        </Text>
        <Text style={styles.headBody}>{body}</Text>
      </View>
    </View>
  );
}

/** One choice in a row of capsules. The chosen one fills with ink. */
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        stepFeel();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.choice, selected && styles.choiceOn, pressed && styles.pressed]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <View style={styles.problem} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Ionicons name="alert-circle" size={22} color={MART.danger} />
      <Text style={styles.problemText}>{message}</Text>
    </View>
  );
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

function meterLooksValid(raw: string): boolean {
  const digits = digitsOnly(raw);
  return digits.length >= 8 && digits.length <= 13;
}

function depletionTitle(
  live: ReturnType<typeof resolveKplcEstimate>,
  nowMs = Date.now()
): string {
  if (!live) return 'Need one more top-up';
  const empty = live.emptyAt;
  if (live.alreadyEmpty || (empty && empty.getTime() <= nowMs)) return 'Likely already out';
  if (!empty) return 'Need one more top-up';
  return `Until ${formatKplcClock(empty)}`;
}

function RemainingBar({ remaining, last, color }: { remaining: number; last: number; color: string }) {
  const fraction = last > 0 ? Math.max(0, Math.min(1, remaining / last)) : 0;
  return (
    <View style={styles.barTrack} accessibilityElementsHidden>
      <View style={[styles.barFill, { width: `${Math.round(fraction * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

function SpendTape({ months, accent }: { months: KplcMonthSpend[]; accent: string }) {
  const peak = months.reduce((max, month) => Math.max(max, moneyFromUnknown(month.amount)), 0);
  if (months.length === 0) {
    return <Text style={styles.muted}>No monthly spend yet. Look up a meter to start.</Text>;
  }
  return (
    <View>
      {months.map((month) => {
        const amount = moneyFromUnknown(month.amount);
        const units = moneyFromUnknown(month.units);
        const width = peak > 0 ? Math.max(8, Math.round((amount / peak) * 100)) : 8;
        return (
          <View key={month.yearMonth} style={styles.monthRow}>
            <View style={styles.monthTop}>
              <Text style={styles.monthLabel}>{month.label}</Text>
              <Text style={styles.monthAmt}>{formatMoney('KES', amount)}</Text>
            </View>
            <View style={styles.monthTrack}>
              <View style={[styles.monthFill, { width: `${width}%`, backgroundColor: accent }]} />
            </View>
            <Text style={styles.monthMeta}>
              {month.tokenCount} token{month.tokenCount === 1 ? '' : 's'}
              {units ? ` · ${units.toLocaleString('en-KE')} kWh` : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function KplcScreen() {
  const tenant = useTenant();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const mart = martFromTenant(tenant);
  const { hub, signedIn } = useSession();

  const [phone, setPhone] = useState('');
  const [phoneReady, setPhoneReady] = useState(false);
  const [meters, setMeters] = useState<KplcMeter[]>([]);
  const [meter, setMeter] = useState('');
  const [addingMeter, setAddingMeter] = useState(false);
  const [history, setHistory] = useState<KplcHistory | null>(null);
  const [view, setView] = useState<'tokens' | 'spend'>('tokens');
  const [busy, setBusy] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokens = useMemo(() => {
    const list = [...(history?.tokens ?? [])];
    list.sort((a, b) => (b.purchasedAt || '').localeCompare(a.purchasedAt || ''));
    return list;
  }, [history?.tokens]);
  const latest = tokens[0];
  const older = tokens.slice(1);
  const stats = useMemo(() => resolveKplcStats(tokens, history?.stats), [tokens, history?.stats]);
  const depletion = history?.depletion ?? null;
  const live = useMemo(
    () => resolveKplcEstimate(tokens, depletion, latest),
    [tokens, depletion, latest]
  );
  const canShowStats = Boolean(stats && (stats.months?.length || stats.allTimeCount > 0)) || Boolean(depletion) || Boolean(live);
  const emptyAt = live?.emptyAt ?? null;
  const remaining = live?.remainingUnits ?? 0;
  const lastUnits = live ? Math.max(live.stockAtLastBuy, live.lastPurchaseUnits) : 0;
  const canEstimate = Boolean(live);

  useEffect(() => {
    let alive = true;
    void loadTabPhone().then((saved) => {
      if (!alive) return;
      const seed = hub?.tabPhone || saved || '';
      if (seed) {
        setPhone(toKenyanLocal07(seed) || seed);
        setPhoneReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [hub?.tabPhone]);

  useEffect(() => {
    if (!phoneReady || !looksLikeKenyanMobile(phone)) return;
    let alive = true;
    setBusy(true);
    setError(null);
    const local = toKenyanLocal07(phone) || phone.trim();
    void fetchKplcConfig(tenant, local)
      .then((config) => {
        if (!alive) return;
        setMeters(config.meters ?? []);
        const first = config.meters?.[0]?.meterNumber;
        if (first) {
          setMeter(first);
          return fetchKplcTokens(tenant, local, first).then((h) => {
            if (alive) setHistory(h);
          });
        }
        setAddingMeter(true);
      })
      .catch((e) => {
        if (!alive) return;
        setError(
          e instanceof Error
            ? e.message
            : 'This number isn’t on the shop tab. Use the phone they know you by at the till.'
        );
        setPhoneReady(false);
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [phoneReady, phone, tenant.host]);


  useLayoutEffect(() => {
    navigation.setOptions({ headerStyle: { backgroundColor: LAND } });
  }, [navigation]);

  useEffect(() => {
    if (error) failFeel();
  }, [error]);

  async function confirmPhone() {
    if (!looksLikeKenyanMobile(phone)) {
      setError('Enter the Kenyan mobile the till uses for your tab, e.g. 0712 345 678.');
      return;
    }
    const local = toKenyanLocal07(phone) || phone.trim();
    setBusy(true);
    setError(null);
    try {
      await fetchKplcConfig(tenant, local);
      await saveTabPhone(local);
      setPhone(local);
      setPhoneReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This number isn’t on the shop tab yet.');
    } finally {
      setBusy(false);
    }
  }

  async function loadMeter(next: string) {
    if (!meterLooksValid(next) || !looksLikeKenyanMobile(phone)) return;
    const local = toKenyanLocal07(phone) || phone.trim();
    const digits = digitsOnly(next);
    setBusy(true);
    setError(null);
    try {
      await saveKplcMeter(tenant, local, digits);
      const loaded = await fetchKplcTokens(tenant, local, digits);
      setHistory(loaded);
      setMeter(digits);
      setAddingMeter(false);
      setView('tokens');
      setMeters((current) => {
        if (current.some((m) => m.meterNumber === digits)) return current;
        return [{ meterNumber: digits, lastUsedAt: new Date().toISOString() }, ...current];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not look up this meter.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleReminders(enabled: boolean) {
    if (!meterLooksValid(meter) || !looksLikeKenyanMobile(phone) || !canEstimate) return;
    const local = toKenyanLocal07(phone) || phone.trim();
    const digits = digitsOnly(meter);
    setAlertBusy(true);
    setError(null);
    try {
      const next = await setKplcDepletionAlerts(tenant, local, digits, enabled);
      setHistory((current) => (current ? { ...current, depletion: next } : current));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update reminders.');
    } finally {
      setAlertBusy(false);
    }
  }

  async function shareToken(token: KplcToken) {
    await Share.share({
      message: `KPLC token ${formatTokenNo(token.tokenNo)}${
        token.units != null ? ` · ${moneyFromUnknown(token.units)} kWh` : ''
      }`,
    });
  }

  if (!phoneReady) {
    return (
      <KeyboardAvoidingView
        style={styles.shell}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + SPACE.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <ZoneHead
            title="KPLC tokens"
            body="Use the phone the till knows you by. You’ll see your tokens, what you spent, and when the last token is likely to run out."
          />
          <View style={styles.page}>
            <Field
              label="Tab phone"
              icon="call-outline"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                setError(null);
              }}
              placeholder="07…"
              accessibilityLabel="Tab phone number"
              error={error}
              style={styles.number}
            />
            <Capsule
              label={busy ? 'Checking…' : 'Look up meter'}
              chip="arrow-forward"
              fill={mart.primary}
              busy={busy}
              onPress={() => void confirmPhone()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  const showMeterInput = meters.length === 0 || addingMeter;
  const remindOff = alertBusy || busy || !canEstimate || !depletion;

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: SPACE.xxxl + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <ZoneHead
          numeric={meterLooksValid(meter)}
          title={meterLooksValid(meter) ? formatMeterDisplay(meter) : 'Look up a meter'}
          body={`Tokens bought on your ${mart.displayName} tab`}
        />

        {meters.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.meterRow}
          >
            {meters.map((saved) => (
              <Choice
                key={saved.meterNumber}
                label={formatMeterDisplay(saved.meterNumber)}
                selected={!addingMeter && digitsOnly(meter) === saved.meterNumber}
                onPress={() => void loadMeter(saved.meterNumber)}
              />
            ))}
            <Choice
              label={addingMeter ? 'Cancel' : 'Another meter'}
              selected={false}
              onPress={() => {
                setAddingMeter((open) => !open);
                if (!addingMeter) setMeter('');
              }}
            />
          </ScrollView>
        ) : null}

        <View style={styles.page}>
          {showMeterInput ? (
            <View style={styles.lookupBlock}>
              <Field
                label="Meter number"
                icon="speedometer-outline"
                keyboardType="number-pad"
                value={meter}
                onChangeText={(v) => {
                  setMeter(digitsOnly(v));
                  setError(null);
                }}
                placeholder="As printed on the last token"
                accessibilityLabel="KPLC meter number"
                style={styles.number}
              />
              <Capsule
                label={busy ? 'Looking up…' : 'Look up tokens'}
                chip="search"
                fill={mart.primary}
                busy={busy}
                disabled={!meterLooksValid(meter)}
                onPress={() => void loadMeter(meter)}
              />
            </View>
          ) : null}

          {error ? <Problem message={error} /> : null}

          {depletion || live ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{depletionTitle(live)}</Text>
              {canEstimate && emptyAt && emptyAt.getTime() > Date.now() && !live?.alreadyEmpty ? (
                <Text style={styles.cardLeft}>{formatKplcTimeLeft(emptyAt)}</Text>
              ) : null}
              {canEstimate && remaining > 0 && lastUnits > 0 ? (
                <>
                  <RemainingBar remaining={remaining} last={lastUnits} color={mart.primary} />
                  <Text style={styles.cardRemain}>
                    About {remaining.toLocaleString('en-KE', { maximumFractionDigits: 1 })} kWh left
                  </Text>
                </>
              ) : !canEstimate ? (
                <Text style={styles.cardBody}>
                  After the next token we can work out how fast this meter uses its units.
                </Text>
              ) : null}
              {canEstimate && live ? (
                <Text style={styles.cardBody}>{kplcEstimateCopy(live)}</Text>
              ) : null}

              <Pressable
                style={[styles.remindRow, remindOff && styles.remindOff]}
                disabled={remindOff}
                onPress={() => {
                  stepFeel();
                  void toggleReminders(!depletion?.alertsEnabled);
                }}
                accessibilityRole="switch"
                accessibilityState={{
                  checked: Boolean(depletion?.alertsEnabled),
                  disabled: remindOff,
                }}
                accessibilityLabel="Remind me before this token runs out"
              >
                <Lobe color={LAND} size={44} shape={3}>
                  <Ionicons
                    name={depletion?.alertsEnabled ? 'notifications' : 'notifications-outline'}
                    size={20}
                    color={MART.ink}
                  />
                </Lobe>
                <View style={styles.remindCopy}>
                  <Text style={styles.remindTitle}>
                    {depletion?.alertsEnabled ? 'Reminders on' : 'Remind me before it runs out'}
                  </Text>
                  <Text style={styles.remindHint}>
                    {!canEstimate
                      ? 'Available once we can estimate the last token'
                      : signedIn
                        ? 'Text and push, 2 days and 1 day before'
                        : 'Text 2 days and 1 day before. Sign in for push.'}
                  </Text>
                </View>
                <Switch
                  value={Boolean(depletion?.alertsEnabled)}
                  disabled={remindOff}
                  onValueChange={(value) => void toggleReminders(value)}
                  trackColor={{ false: MART.borderStrong, true: MART.ink }}
                  thumbColor={MART.paperElevated}
                  ios_backgroundColor={MART.borderStrong}
                  pointerEvents="none"
                />
              </Pressable>
            </View>
          ) : null}

          {canShowStats ? (
            <View style={styles.seg} accessibilityRole="tablist">
              {(['tokens', 'spend'] as const).map((key) => {
                const on = view === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      if (!on) stepFeel();
                      setView(key);
                    }}
                    style={[styles.segBtn, on && styles.segBtnOn]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.segText, on && styles.segTextOn]}>
                      {key === 'tokens' ? 'Tokens' : 'Spend'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {view === 'tokens' || !canShowStats ? (
            <View style={styles.listBlock}>
              <View>
                <Text accessibilityRole="header" style={styles.listTitle}>
                  Token history
                </Text>
                {tokens.length > 0 ? (
                  <Text style={styles.listHint}>Newest first. Tap a token to share it.</Text>
                ) : null}
              </View>

              {latest ? (
                <PressScale
                  onPress={() => void shareToken(latest)}
                  style={styles.latest}
                  accessibilityRole="button"
                  accessibilityLabel={`Share latest token ${formatTokenNo(latest.tokenNo)}`}
                >
                  <Text style={styles.latestWhen}>{formatRelativeTokenTime(latest.purchasedAt)}</Text>
                  <Text selectable style={styles.latestToken}>
                    {formatTokenNo(latest.tokenNo)}
                  </Text>
                  <View style={styles.latestMeta}>
                    <Text style={styles.latestAmt}>
                      {formatMoney('KES', moneyFromUnknown(latest.amount))}
                      {latest.units != null
                        ? ` · ${moneyFromUnknown(latest.units).toLocaleString('en-KE')} kWh`
                        : ''}
                    </Text>
                    <View style={styles.shareChip}>
                      <Ionicons name="share-outline" size={20} color={MART.paper} />
                    </View>
                  </View>
                </PressScale>
              ) : history && tokens.length === 0 ? (
                <Text style={styles.empty}>No tokens on this meter yet.</Text>
              ) : null}

              {older.length > 0 ? (
                <View style={styles.slips}>
                  {older.map((token, index) => (
                    <Pressable
                      key={`${token.tokenNo}-${token.purchasedAt ?? index}`}
                      onPress={() => void shareToken(token)}
                      accessibilityRole="button"
                      accessibilityLabel={`Share token ${formatTokenNo(token.tokenNo)}`}
                      style={({ pressed }) => [
                        styles.slip,
                        index > 0 && styles.slipRule,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.slipMain}>
                        <Text style={styles.slipWhen}>{formatRelativeTokenTime(token.purchasedAt)}</Text>
                        <Text style={styles.slipToken}>{formatTokenNo(token.tokenNo)}</Text>
                        <Text style={styles.slipAmt}>
                          {formatMoney('KES', moneyFromUnknown(token.amount))}
                          {token.units != null
                            ? ` · ${moneyFromUnknown(token.units).toLocaleString('en-KE')} kWh`
                            : ''}
                        </Text>
                      </View>
                      <Ionicons name="share-outline" size={20} color={MART.ink} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.card}>
              {stats ? (
                <>
                  <Text style={styles.spendTitle}>This month</Text>
                  <Text style={styles.spendHero}>
                    {formatMoney('KES', moneyFromUnknown(stats.thisMonthAmount))}
                  </Text>
                  <Text style={styles.spendSub}>
                    {stats.thisMonthCount} token{stats.thisMonthCount === 1 ? '' : 's'}
                    {moneyFromUnknown(stats.thisMonthUnits)
                      ? ` · ${moneyFromUnknown(stats.thisMonthUnits).toLocaleString('en-KE')} kWh`
                      : ''}
                    {' · '}
                    {stats.allTimeCount} all time
                  </Text>
                  <SpendTape months={stats.months ?? []} accent={mart.primary} />
                </>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: MART.paper },
  head: {
    paddingBottom: COAST_SWELL + SPACE.sm,
  },
  /** Keeps the land whole when the page is pulled down past its top. */
  headOverscroll: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -600,
    height: 600,
    backgroundColor: LAND,
  },
  headCopy: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xs,
    paddingBottom: SPACE.lg,
  },
  headTitle: { ...TYPE.display, color: MART.ink },
  headNumeric: { letterSpacing: -0.5 },
  headBody: { ...TYPE.body, marginTop: SPACE.sm, color: MART.ink, maxWidth: 330 },
  page: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
    gap: SPACE.xl,
  },
  meterRow: {
    gap: SPACE.sm,
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xs,
    paddingBottom: SPACE.sm,
  },
  choice: {
    minHeight: 46,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: MART.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOn: { backgroundColor: MART.ink },
  choiceText: { ...TYPE.label, color: MART.ink },
  choiceTextOn: { color: MART.paper },
  pressed: { opacity: 0.7 },
  lookupBlock: { gap: SPACE.lg },
  number: {
    fontFamily: FONT.semibold,
    fontSize: 18,
  },
  problem: {
    ...TILE,
    flexDirection: 'row',
    gap: SPACE.md,
    backgroundColor: MART.dangerSurface,
  },
  problemText: { ...TYPE.body, flex: 1, color: MART.ink },
  card: {
    ...TILE,
    padding: SPACE.xl,
  },
  cardTitle: { ...TYPE.title, color: MART.ink },
  cardLeft: {
    ...TYPE.heading,
    marginTop: SPACE.xs,
    color: MART.ink,
  },
  cardRemain: {
    ...TYPE.label,
    marginTop: SPACE.sm,
    color: MART.ink,
  },
  cardBody: { ...TYPE.meta, marginTop: SPACE.sm, color: MART.inkMuted },
  barTrack: {
    marginTop: SPACE.lg,
    height: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    overflow: 'hidden',
  },
  barFill: { height: 12, borderRadius: RADIUS.pill },
  remindRow: {
    marginTop: SPACE.xl,
    paddingTop: SPACE.lg,
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: MART.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  remindOff: { opacity: 0.55 },
  remindCopy: { flex: 1, minWidth: 0 },
  remindTitle: { ...TYPE.label, color: MART.ink },
  remindHint: { ...TYPE.meta, marginTop: SPACE.xxs, color: MART.inkMuted },
  seg: {
    flexDirection: 'row',
    backgroundColor: MART.paperSunken,
    borderRadius: RADIUS.pill,
    padding: 4,
  },
  segBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
  },
  segBtnOn: { backgroundColor: MART.ink },
  segText: { ...TYPE.label, color: MART.inkMuted },
  segTextOn: { color: MART.paper },
  listBlock: { gap: SPACE.md },
  listTitle: { ...TYPE.title, color: MART.ink },
  listHint: { ...TYPE.meta, marginTop: SPACE.xxs, color: MART.inkQuiet },
  latest: {
    ...TILE,
    padding: SPACE.xl,
    backgroundColor: MART.successSurface,
  },
  latestWhen: { ...TYPE.meta, color: MART.success },
  latestToken: {
    marginTop: SPACE.sm,
    color: MART.ink,
    fontFamily: FONT.black,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0.4,
  },
  latestMeta: {
    marginTop: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
  },
  latestAmt: { ...TYPE.label, flex: 1, color: MART.ink },
  shareChip: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slips: {
    ...TILE,
    paddingVertical: SPACE.xs,
  },
  slip: {
    minHeight: 44,
    paddingVertical: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  slipRule: {
    borderTopWidth: 1,
    borderTopColor: MART.border,
  },
  slipMain: { flex: 1, minWidth: 0 },
  slipWhen: { ...TYPE.meta, color: MART.inkQuiet },
  slipToken: {
    marginTop: SPACE.xxs,
    fontFamily: FONT.bold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0.3,
    color: MART.ink,
  },
  slipAmt: { ...TYPE.meta, marginTop: SPACE.xxs, color: MART.inkMuted },
  spendTitle: { ...TYPE.label, color: MART.inkMuted },
  spendHero: {
    ...TYPE.display,
    marginTop: SPACE.xs,
    color: MART.ink,
  },
  spendSub: {
    ...TYPE.meta,
    marginTop: SPACE.xs,
    marginBottom: SPACE.xl,
    color: MART.inkQuiet,
  },
  monthRow: { marginBottom: SPACE.lg },
  monthTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: SPACE.md,
  },
  monthLabel: { ...TYPE.label, color: MART.ink, flex: 1 },
  monthAmt: {
    ...TYPE.label,
    fontFamily: FONT.bold,
    color: MART.ink,
  },
  monthTrack: {
    marginTop: SPACE.sm,
    height: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    overflow: 'hidden',
  },
  monthFill: { height: 10, borderRadius: RADIUS.pill },
  monthMeta: { ...TYPE.meta, marginTop: SPACE.xs, color: MART.inkQuiet },
  empty: {
    ...TYPE.body,
    color: MART.inkMuted,
  },
  muted: { ...TYPE.meta, color: MART.inkMuted },
});
