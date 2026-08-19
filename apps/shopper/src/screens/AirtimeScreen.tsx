import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTenant } from '../lib/TenantContext';
import { useAirtimeConfig } from '../hooks/useAirtimeConfig';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useSession } from '../hooks/useSession';
import { createAirtimeOrder, fetchAirtimeOrder, type AirtimeOrder } from '../api/services';
import {
  detectKenyanNetwork,
  formatPhoneDisplay,
  KENYAN_NETWORKS,
  looksLikeKenyanMobile,
  toKenyanLocal07,
  type KenyanNetwork,
} from '../lib/phone';
import { loadAirtimePhones, loadTabPhone, saveAirtimePhones } from '../lib/remembered-phone';
import { formatMoney } from '../lib/media';
import { Bone, SkeletonScope } from '../components/Skeleton';
import {
  ELEVATION,
  GUTTER,
  MART,
  martFromTenant,
  ON_BRAND,
  RADIUS,
  SPACE,
  TYPE,
} from '../theme/mart';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AirtimeScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const scrollRef = useRef<ScrollView>(null);
  const mart = martFromTenant(tenant);
  const { hub } = useSession();
  const { data: config, isLoading } = useAirtimeConfig(tenant.slug);

  const [recipient, setRecipient] = useState('');
  const [payer, setPayer] = useState('');
  const [payerFollows, setPayerFollows] = useState(true);
  const [amount, setAmount] = useState('');
  const [otherAmount, setOtherAmount] = useState(false);
  const [network, setNetwork] = useState<KenyanNetwork | null>(null);
  const [networkTouched, setNetworkTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<AirtimeOrder | null>(null);

  const min = config?.minAmount ?? 10;
  const max = config?.maxAmount ?? 10000;
  const currency = config?.currency ?? 'KES';
  const quickAmounts = (config?.quickAmounts?.length ? config.quickAmounts : [50, 100, 200, 500, 1000]).filter(
    (n) => n >= min && n <= max
  );
  const detected = detectKenyanNetwork(recipient);
  const amountNum = Number.parseFloat(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum >= min && amountNum <= max;
  const canSubmit =
    looksLikeKenyanMobile(recipient) &&
    looksLikeKenyanMobile(payer) &&
    amountValid &&
    network != null &&
    !busy;

  useEffect(() => {
    let alive = true;
    void Promise.all([loadTabPhone(), loadAirtimePhones()]).then(([tab, remembered]) => {
      if (!alive) return;
      const seed = remembered.recipient || hub?.tabPhone || tab || '';
      const pay = remembered.payer || seed;
      if (seed) setRecipient(formatPhoneDisplay(seed));
      if (pay) setPayer(formatPhoneDisplay(pay));
      setPayerFollows(!remembered.payer || remembered.payer === remembered.recipient);
    });
    return () => {
      alive = false;
    };
  }, [hub?.tabPhone]);

  useEffect(() => {
    setAmount((current) => {
      if (current.trim()) return current;
      if (quickAmounts.includes(100)) return '100';
      return quickAmounts[0] != null ? String(quickAmounts[0]) : current;
    });
  }, [min, max, quickAmounts.join(',')]);

  useEffect(() => {
    if (networkTouched) return;
    if (detected) setNetwork(detected);
  }, [detected, networkTouched]);

  useEffect(() => {
    if (!order || order.delivered || order.failed) return;
    let stopped = false;
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      const fresh = await fetchAirtimeOrder(tenant.slug, order.orderId);
      if (stopped) return;
      if (fresh) {
        setOrder(fresh);
        if (fresh.delivered || fresh.failed) return;
      }
      if (attempts < 40) {
        timer = setTimeout(() => void tick(), 2500);
      }
    };
    let timer = setTimeout(() => void tick(), 2500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [order, tenant.slug]);

  async function submit() {
    if (!canSubmit || network == null) return;
    setBusy(true);
    setError(null);
    try {
      const to = toKenyanLocal07(recipient) || recipient.trim();
      const from = toKenyanLocal07(payer) || payer.trim();
      const created = await createAirtimeOrder(tenant.slug, {
        phoneNumber: to,
        amount: amountNum,
        payerPhone: from,
      });
      setOrder(created);
      await saveAirtimePhones(to, from);
      if (created.failed) {
        setError(created.message || 'The airtime purchase could not be started.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the M-Pesa prompt.');
    } finally {
      setBusy(false);
    }
  }

  function revealLowerField() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }

  if (isLoading) {
    return (
      <View style={styles.shell}>
        <SkeletonScope label="Loading airtime" style={styles.loading}>
          <Bone h={132} />
          <Bone h={44} />
          <Bone h={112} />
          <Bone h={52} />
        </SkeletonScope>
      </View>
    );
  }

  if (config && config.available === false) {
    return (
      <View style={[styles.shell, styles.centered, { paddingBottom: insets.bottom + 24 }]}>
        <Ionicons name="cellular-outline" size={32} color={MART.inkQuiet} />
        <Text style={styles.emptyTitle}>Airtime isn’t on this shop yet</Text>
        <Text style={styles.emptyBody}>{config.reason || 'Ask the till — they can switch it on.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.page, { paddingBottom: SPACE.xl }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={false}
      >
        <Text style={styles.lede}>Any Kenyan line. Pay with M-Pesa on this phone.</Text>

        {order?.delivered ? (
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={28} color="#067647" />
            <Text style={styles.successTitle}>Airtime sent</Text>
            <Text style={styles.successBody}>
              {formatMoney(order.currency || currency, Number(order.amount))} landed on{' '}
              {formatPhoneDisplay(order.phoneNumber)}.
            </Text>
            <Pressable
              onPress={() => navigation.goBack()}
              style={[styles.primary, { backgroundColor: mart.primary }]}
            >
              <Text style={styles.primaryText}>Done</Text>
            </Pressable>
          </View>
        ) : order && !order.failed ? (
          <View style={styles.wait}>
            <Ionicons
              name={order.awaitingPayment ? 'phone-portrait-outline' : 'sync-outline'}
              size={28}
              color={mart.primary}
            />
            <Text style={styles.waitTitle}>
              {formatMoney(order.currency || currency, Number(order.amount))} to{' '}
              {formatPhoneDisplay(order.phoneNumber)}
            </Text>
            <Text style={styles.waitBody}>
              {order.awaitingPayment
                ? `Check ${formatPhoneDisplay(payer)} and enter your M-Pesa PIN.`
                : 'Payment received — sending now.'}
            </Text>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Airtime goes to</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                value={recipient}
                onChangeText={(v) => {
                  setRecipient(v);
                  if (payerFollows) setPayer(v);
                  setError(null);
                }}
                placeholder="07…"
                placeholderTextColor={MART.inkQuiet}
                accessibilityLabel="Phone that receives airtime"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Network</Text>
              <Text style={styles.hint}>
                {detected
                  ? 'Detected from the number — tap if we guessed wrong.'
                  : 'Pick the recipient’s network.'}
              </Text>
              <View style={styles.networkRow}>
                {KENYAN_NETWORKS.map((n) => {
                  const selected = network === n.id;
                  return (
                    <Pressable
                      key={n.id}
                      onPress={() => {
                        setNetwork(n.id);
                        setNetworkTouched(true);
                        setError(null);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[
                        styles.netChip,
                        selected && { backgroundColor: mart.primary, borderColor: mart.primary },
                      ]}
                    >
                      <Text style={[styles.netChipText, selected && styles.netChipTextOn]}>{n.short}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Amount</Text>
              <Text style={styles.amountDisplay}>
                {amountValid ? formatMoney(currency, amountNum) : formatMoney(currency, 0)}
              </Text>
              <Text style={styles.hint}>
                {formatMoney(currency, min)}–{formatMoney(currency, max)}
              </Text>
              <View style={styles.amountGrid}>
                {quickAmounts.map((n) => {
                  const selected = amountValid && Math.abs(amountNum - n) < 0.001;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => {
                        setAmount(String(n));
                        setOtherAmount(false);
                        setError(null);
                      }}
                      style={[
                        styles.amountChip,
                        selected && { backgroundColor: mart.primary, borderColor: mart.primary },
                      ]}
                    >
                      <Text style={[styles.amountChipText, selected && styles.netChipTextOn]}>
                        {n.toLocaleString('en-KE')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {otherAmount ? (
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={amount}
                  onChangeText={(v) => {
                    setAmount(v);
                    setError(null);
                  }}
                  onFocus={revealLowerField}
                  placeholder={`${min}–${max}`}
                  placeholderTextColor={MART.inkQuiet}
                  accessibilityLabel="Custom amount"
                />
              ) : (
                <Pressable onPress={() => setOtherAmount(true)} style={styles.linkBtn}>
                  <Text style={[styles.link, { color: mart.primary }]}>Other amount</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Pay from</Text>
              <Text style={styles.hint}>This line gets the M-Pesa PIN prompt.</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                value={payer}
                onChangeText={(v) => {
                  setPayer(v);
                  setPayerFollows(false);
                  setError(null);
                }}
                onFocus={revealLowerField}
                placeholder="Same number, or another"
                placeholderTextColor={MART.inkQuiet}
                accessibilityLabel="Phone that pays with M-Pesa"
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        )}
      </ScrollView>
      {!(order?.delivered || (order && !order.failed)) ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: SPACE.md + (keyboardHeight > 0 ? SPACE.sm : insets.bottom),
              marginBottom: keyboardHeight,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              void submit();
            }}
            disabled={!canSubmit}
            style={[
              styles.primary,
              { backgroundColor: mart.primary, opacity: canSubmit ? 1 : 0.45 },
            ]}
          >
            <Text style={styles.primaryText}>
              {busy
                ? 'Sending prompt…'
                : amountValid
                  ? `Pay ${formatMoney(currency, amountNum)}`
                  : 'Pay with M-Pesa'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: MART.paper },
  scroll: { flex: 1 },
  loading: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.lg,
    gap: SPACE.lg,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.xxl,
    gap: SPACE.sm,
  },
  page: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
    gap: SPACE.lg,
  },
  lede: {
    ...TYPE.body,
    color: MART.inkMuted,
  },
  form: {
    gap: SPACE.xl,
  },
  field: { gap: SPACE.sm },
  label: { ...TYPE.label, fontWeight: '700', color: MART.ink },
  hint: { ...TYPE.meta, color: MART.inkQuiet },
  amountDisplay: {
    ...TYPE.heading,
    fontVariant: ['tabular-nums'],
    color: MART.ink,
  },
  networkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
  },
  netChip: {
    minWidth: 56,
    flexGrow: 1,
    minHeight: 40,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...ELEVATION.ruled,
  },
  netChipText: { ...TYPE.label, fontWeight: '700', color: MART.ink },
  netChipTextOn: { color: ON_BRAND.primary },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
  },
  amountChip: {
    width: '31%',
    minHeight: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...ELEVATION.ruled,
  },
  amountChipText: { ...TYPE.heading, color: MART.ink },
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
  linkBtn: {
    minHeight: 40,
    justifyContent: 'center',
  },
  link: { ...TYPE.label, fontWeight: '700' },
  error: {
    ...TYPE.meta,
    color: MART.danger,
  },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  primary: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { ...TYPE.heading, color: ON_BRAND.primary },
  success: {
    padding: SPACE.xl,
    borderRadius: RADIUS.md,
    backgroundColor: MART.successSurface,
    gap: SPACE.sm,
  },
  successTitle: { ...TYPE.title, color: MART.success },
  successBody: { ...TYPE.body, color: MART.ink },
  wait: {
    padding: SPACE.xl,
    borderRadius: RADIUS.md,
    gap: SPACE.sm,
    ...ELEVATION.ruled,
  },
  waitTitle: { ...TYPE.heading, color: MART.ink },
  waitBody: { ...TYPE.body, color: MART.inkMuted },
  emptyTitle: { ...TYPE.title, color: MART.ink, textAlign: 'center' },
  emptyBody: { ...TYPE.body, color: MART.inkMuted, textAlign: 'center' },
});
