import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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
import { formatMoney, moneyFromUnknown } from '../lib/media';
import {
  ELEVATION,
  GUTTER,
  MART,
  martFromTenant,
  ON_BRAND,
  RADIUS,
  SPACE,
  TYPE,
  tint,
} from '../theme/mart';

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
    return <Text style={styles.muted}>No monthly spend yet. Look up a meter to start the tape.</Text>;
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
        <View style={[styles.gate, { paddingBottom: insets.bottom + 24 }]}>
          <View style={[styles.bolt, { backgroundColor: tint(mart.primary, 0.1) }]}>
            <Ionicons name="flash" size={26} color={mart.primary} />
          </View>
          <Text style={styles.gateTitle}>KPLC tokens</Text>
          <Text style={styles.gateBody}>
            Use the phone the till knows you by. We’ll show slips, spend, and when the last token is likely to run out.
          </Text>
          <Text style={styles.fieldLabel}>Tab phone</Text>
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              setError(null);
            }}
            placeholder="07…"
            placeholderTextColor={MART.inkQuiet}
            accessibilityLabel="Tab phone number"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={() => void confirmPhone()}
            disabled={busy}
            style={[styles.primary, { backgroundColor: mart.primary, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={styles.primaryText}>{busy ? 'Checking…' : 'Look up meter'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const showMeterInput = meters.length === 0 || addingMeter;

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 36 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.page}>
          <View style={styles.heroBlock}>
            <Text style={styles.meterTitle}>
              {meterLooksValid(meter) ? formatMeterDisplay(meter) : 'Look up a meter'}
            </Text>
            <Text style={styles.meterHint}>
              Slips bought on your {mart.displayName} tab
            </Text>
          </View>

          {meters.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.meterRow}
            >
              {meters.map((saved) => {
                const selected = !addingMeter && digitsOnly(meter) === saved.meterNumber;
                return (
                  <Pressable
                    key={saved.meterNumber}
                    onPress={() => void loadMeter(saved.meterNumber)}
                    style={[
                      styles.meterChip,
                      selected && { backgroundColor: mart.primary, borderColor: mart.primary },
                    ]}
                  >
                    <Text style={[styles.meterChipText, selected && { color: ON_BRAND.primary }]}>
                      {formatMeterDisplay(saved.meterNumber)}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => {
                  setAddingMeter((open) => !open);
                  if (!addingMeter) setMeter('');
                }}
                style={[styles.meterChip, addingMeter && { borderColor: mart.primary }]}
              >
                <Text style={styles.meterChipText}>{addingMeter ? 'Cancel' : 'Another'}</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {showMeterInput ? (
            <View style={styles.lookupBlock}>
              <Text style={styles.fieldLabel}>Meter number</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={meter}
                onChangeText={(v) => {
                  setMeter(digitsOnly(v));
                  setError(null);
                }}
                placeholder="As printed on the last token"
                placeholderTextColor={MART.inkQuiet}
                accessibilityLabel="KPLC meter number"
              />
              <Pressable
                onPress={() => void loadMeter(meter)}
                disabled={busy || !meterLooksValid(meter)}
                style={[
                  styles.primary,
                  {
                    backgroundColor: mart.primary,
                    opacity: busy || !meterLooksValid(meter) ? 0.45 : 1,
                  },
                ]}
              >
                <Text style={styles.primaryText}>{busy ? 'Looking up…' : 'Look up tokens'}</Text>
              </Pressable>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

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
                  After the next token we can time how fast this meter drinks units.
                </Text>
              ) : null}
              {canEstimate && live ? (
                <Text style={styles.cardBody}>{kplcEstimateCopy(live)}</Text>
              ) : null}

              <Pressable
                style={styles.remindRow}
                disabled={alertBusy || busy || !canEstimate || !depletion}
                onPress={() => void toggleReminders(!depletion?.alertsEnabled)}
                accessibilityRole="switch"
                accessibilityState={{
                  checked: Boolean(depletion?.alertsEnabled),
                  disabled: alertBusy || busy || !canEstimate || !depletion,
                }}
                accessibilityLabel="Remind me before this token runs out"
              >
                <View style={[styles.remindIcon, { backgroundColor: tint(mart.primary, 0.1) }]}>
                  <Ionicons
                    name={depletion?.alertsEnabled ? 'notifications' : 'notifications-outline'}
                    size={18}
                    color={mart.primary}
                  />
                </View>
                <View style={styles.remindCopy}>
                  <Text style={styles.remindTitle}>
                    {depletion?.alertsEnabled ? 'Reminders on' : 'Remind me before it runs out'}
                  </Text>
                  <Text style={styles.remindHint}>
                    {!canEstimate
                      ? 'Available once we can estimate the last slip'
                      : signedIn
                        ? 'Text and push, 2 days and 1 day before'
                        : 'Text 2 days and 1 day before · sign in for push'}
                  </Text>
                </View>
                <Switch
                  value={Boolean(depletion?.alertsEnabled)}
                  disabled={alertBusy || busy || !canEstimate || !depletion}
                  onValueChange={(value) => void toggleReminders(value)}
                  trackColor={{ false: MART.border, true: tint(mart.primary, 0.55) }}
                  thumbColor={depletion?.alertsEnabled ? mart.primary : '#f4f4f4'}
                  ios_backgroundColor={MART.border}
                  pointerEvents="none"
                />
              </Pressable>
            </View>
          ) : null}

          {canShowStats ? (
            <View style={styles.seg} accessibilityRole="tablist">
              <Pressable
                onPress={() => setView('tokens')}
                style={[styles.segBtn, view === 'tokens' && { backgroundColor: MART.paperElevated }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: view === 'tokens' }}
              >
                <Text style={[styles.segText, view === 'tokens' && styles.segTextOn]}>Tokens</Text>
              </Pressable>
              <Pressable
                onPress={() => setView('spend')}
                style={[styles.segBtn, view === 'spend' && { backgroundColor: MART.paperElevated }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: view === 'spend' }}
              >
                <Text style={[styles.segText, view === 'spend' && styles.segTextOn]}>Spend</Text>
              </Pressable>
            </View>
          ) : null}

          {view === 'tokens' || !canShowStats ? (
            <View style={styles.listBlock}>
              <Text style={styles.listTitle}>Token history</Text>
              {tokens.length > 0 ? (
                <Text style={styles.listHint}>Newest first. Tap a slip to share it.</Text>
              ) : null}

              {latest ? (
                <Pressable
                  onPress={() => void shareToken(latest)}
                  style={styles.latest}
                  accessibilityRole="button"
                  accessibilityLabel={`Share latest token ${formatTokenNo(latest.tokenNo)}`}
                >
                  <Text style={styles.latestWhen}>{formatRelativeTokenTime(latest.purchasedAt)}</Text>
                  <Text style={styles.latestToken}>{formatTokenNo(latest.tokenNo)}</Text>
                  <View style={styles.latestMeta}>
                    <Text style={styles.latestAmt}>
                      {formatMoney('KES', moneyFromUnknown(latest.amount))}
                      {latest.units != null
                        ? ` · ${moneyFromUnknown(latest.units).toLocaleString('en-KE')} kWh`
                        : ''}
                    </Text>
                    <Ionicons name="share-outline" size={18} color={MART.inkMuted} />
                  </View>
                </Pressable>
              ) : history && tokens.length === 0 ? (
                <Text style={styles.empty}>No tokens on this meter yet.</Text>
              ) : null}

              {older.map((token, index) => (
                <Pressable
                  key={`${token.tokenNo}-${token.purchasedAt ?? index}`}
                  onPress={() => void shareToken(token)}
                  accessibilityRole="button"
                  accessibilityLabel={`Share token ${formatTokenNo(token.tokenNo)}`}
                  style={styles.slip}
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
                  <View style={styles.slipShare}>
                    <Ionicons name="share-outline" size={18} color={MART.inkMuted} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.spend}>
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
  gate: {
    flex: 1,
    paddingHorizontal: SPACE.xl,
    justifyContent: 'center',
    gap: SPACE.sm,
  },
  bolt: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.lg,
  },
  gateTitle: { ...TYPE.display, color: MART.ink },
  gateBody: {
    ...TYPE.body,
    marginBottom: SPACE.md,
    color: MART.inkMuted,
  },
  page: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.lg,
    gap: SPACE.lg,
  },
  heroBlock: { gap: SPACE.xs },
  meterTitle: {
    ...TYPE.display,
    letterSpacing: 0.6,
    color: MART.ink,
    fontVariant: ['tabular-nums'],
  },
  meterHint: { ...TYPE.meta, color: MART.inkQuiet },
  meterRow: { gap: SPACE.sm, paddingRight: SPACE.lg },
  meterChip: {
    minHeight: 40,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...ELEVATION.ruled,
  },
  meterChipText: { ...TYPE.label, fontWeight: '700', color: MART.ink },
  lookupBlock: { gap: SPACE.sm },
  fieldLabel: { ...TYPE.label, fontWeight: '700', color: MART.ink },
  input: {
    minHeight: 52,
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderColor: MART.border,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    ...TYPE.heading,
    fontSize: 18,
    color: MART.ink,
    letterSpacing: 0.4,
  },
  error: {
    ...TYPE.meta,
    color: MART.danger,
  },
  primary: {
    minHeight: 52,
    marginTop: SPACE.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { ...TYPE.heading, color: ON_BRAND.primary },
  card: {
    padding: SPACE.lg,
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
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
    fontWeight: '700',
    color: MART.ink,
    fontVariant: ['tabular-nums'],
  },
  cardBody: { ...TYPE.meta, marginTop: SPACE.sm, lineHeight: 18, color: MART.inkMuted },
  barTrack: {
    marginTop: SPACE.md,
    height: 6,
    backgroundColor: MART.paperSunken,
    overflow: 'hidden',
  },
  barFill: { height: 6 },
  remindRow: {
    marginTop: SPACE.lg,
    paddingTop: SPACE.lg,
    borderTopWidth: 1,
    borderTopColor: MART.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  remindIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remindCopy: { flex: 1, minWidth: 0 },
  remindTitle: { ...TYPE.label, fontSize: 14, fontWeight: '700', color: MART.ink },
  remindHint: { ...TYPE.meta, marginTop: SPACE.xxs, color: MART.inkQuiet },
  seg: {
    flexDirection: 'row',
    backgroundColor: MART.paperSunken,
    borderRadius: RADIUS.md,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  segText: { ...TYPE.label, fontWeight: '700', color: MART.inkMuted },
  segTextOn: { color: MART.ink },
  listBlock: { gap: SPACE.sm },
  listTitle: { ...TYPE.heading, color: MART.ink },
  listHint: { ...TYPE.meta, color: MART.inkQuiet, marginBottom: SPACE.xs },
  latest: {
    padding: SPACE.lg,
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
  },
  latestWhen: { ...TYPE.meta, color: MART.inkQuiet },
  latestToken: {
    marginTop: SPACE.sm,
    color: MART.ink,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  latestMeta: {
    marginTop: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
  },
  latestAmt: { ...TYPE.label, flex: 1, color: MART.inkMuted },
  slip: {
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...ELEVATION.ruled,
  },
  slipMain: { flex: 1, minWidth: 0 },
  slipWhen: { ...TYPE.meta, color: MART.inkQuiet },
  slipToken: {
    marginTop: SPACE.xxs,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: MART.ink,
    fontVariant: ['tabular-nums'],
  },
  slipAmt: { ...TYPE.meta, marginTop: SPACE.xxs, color: MART.inkMuted },
  slipShare: { width: 28, alignItems: 'flex-end', justifyContent: 'center' },
  spend: { paddingTop: SPACE.xs },
  spendTitle: { ...TYPE.label, color: MART.inkMuted },
  spendHero: {
    ...TYPE.display,
    marginTop: SPACE.xs,
    color: MART.ink,
    fontVariant: ['tabular-nums'],
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
  monthLabel: { ...TYPE.label, fontSize: 14, fontWeight: '600', color: MART.ink, flex: 1 },
  monthAmt: {
    ...TYPE.label,
    fontSize: 14,
    fontWeight: '700',
    color: MART.ink,
    fontVariant: ['tabular-nums'],
  },
  monthTrack: {
    marginTop: SPACE.sm,
    height: 6,
    backgroundColor: MART.paperSunken,
    overflow: 'hidden',
  },
  monthFill: { height: 6 },
  monthMeta: { ...TYPE.meta, marginTop: SPACE.xs, color: MART.inkQuiet },
  empty: {
    ...TYPE.body,
    marginTop: SPACE.md,
    textAlign: 'center',
    color: MART.inkQuiet,
  },
  muted: { ...TYPE.meta, color: MART.inkMuted },
});
