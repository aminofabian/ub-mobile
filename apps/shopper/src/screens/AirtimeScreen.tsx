import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { doneFeel, failFeel, stepFeel } from '../lib/haptics';
import { formatMoney } from '../lib/media';
import { Capsule } from '../components/Capsule';
import { Coast, COAST_SWELL, Lobe } from '../components/Coast';
import { Field } from '../components/Field';
import { Bone, SkeletonScope } from '../components/Skeleton';
import { StateBlock } from '../components/StateBlock';
import { FONT, GUTTER, MART, martFromTenant, RADIUS, SPACE, TILE, TYPE, ZONE } from '../theme/mart';
import { RootStackParamList } from '../navigation/types';

const LAND = ZONE.pond;

/**
 * The top of the errand: its zone colour running down from the navigation bar to a curved coast, with
 * the heading on it. The coast sits wherever the words end, so a long heading or large text still fits.
 */
function ZoneHead({ title, body }: { title: string; body: string }) {
  const [height, setHeight] = useState(0);
  return (
    <View style={styles.head}>
      <View style={styles.headOverscroll} />
      {height > 0 ? <Coast color={LAND} height={height} /> : null}
      <View style={styles.headCopy} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>
        <Text accessibilityRole="header" style={styles.headTitle}>
          {title}
        </Text>
        <Text style={styles.headBody}>{body}</Text>
      </View>
    </View>
  );
}

/** One choice in a wrap of capsules. The chosen one fills with ink. */
function Choice({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        if (!selected) stepFeel();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.choice, selected && styles.choiceOn, pressed && styles.pressed]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

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

  useLayoutEffect(() => {
    navigation.setOptions({ headerStyle: { backgroundColor: LAND } });
  }, [navigation]);

  // One tick of the haptic engine for each outcome, not one per poll.
  const delivered = Boolean(order?.delivered);
  useEffect(() => {
    if (delivered) doneFeel();
  }, [delivered]);
  useEffect(() => {
    if (error) failFeel();
  }, [error]);

  function revealLowerField() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }

  if (isLoading) {
    return (
      <View style={styles.shell}>
        <SkeletonScope label="Loading airtime" style={styles.loading}>
          <Bone h={34} w="56%" r={RADIUS.sm} />
          <Bone h={54} r={RADIUS.pill} />
          <Bone h={132} r={RADIUS.lg} />
          <Bone h={54} r={RADIUS.pill} />
        </SkeletonScope>
      </View>
    );
  }

  if (config && config.available === false) {
    return (
      <View style={[styles.shell, { paddingBottom: insets.bottom + SPACE.xl }]}>
        <StateBlock
          tone="note"
          icon="cellular"
          title="Airtime isn’t on this shop yet"
          body={config.reason || 'Ask at the till. They can switch it on.'}
        />
      </View>
    );
  }

  const showForm = !(order?.delivered || (order && !order.failed));

  return (
    <View style={styles.shell}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: SPACE.xl }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={false}
      >
        <ZoneHead title="Buy airtime" body="Any Kenyan line. Pay with M-Pesa on this phone." />

        <View style={styles.page}>
          {order?.delivered ? (
            <View style={[styles.state, { backgroundColor: MART.successSurface }]}>
              <Lobe color={ZONE.leaf} size={64} shape={3} style={styles.stateLobe}>
                <Ionicons name="checkmark" size={30} color={MART.ink} />
              </Lobe>
              <Text style={styles.stateTitle}>Airtime sent</Text>
              <Text style={styles.stateBody}>
                {formatMoney(order.currency || currency, Number(order.amount))} landed on{' '}
                {formatPhoneDisplay(order.phoneNumber)}.
              </Text>
              <Capsule
                label="Done"
                chip="checkmark"
                fill={mart.primary}
                onPress={() => navigation.goBack()}
                style={styles.stateAction}
              />
            </View>
          ) : order && !order.failed ? (
            <View
              style={[styles.state, { backgroundColor: MART.infoSurface }]}
              accessibilityLiveRegion="polite"
            >
              <Lobe color={LAND} size={64} shape={1} style={styles.stateLobe}>
                <Ionicons
                  name={order.awaitingPayment ? 'phone-portrait' : 'sync'}
                  size={28}
                  color={MART.ink}
                />
              </Lobe>
              <Text style={styles.stateTitle}>
                {formatMoney(order.currency || currency, Number(order.amount))} to{' '}
                {formatPhoneDisplay(order.phoneNumber)}
              </Text>
              <Text style={styles.stateBody}>
                {order.awaitingPayment
                  ? `Check ${formatPhoneDisplay(payer)} and enter your M-Pesa PIN.`
                  : 'Payment received. Sending the airtime now.'}
              </Text>
              <View style={styles.waiting}>
                <ActivityIndicator size="small" color={MART.ink} />
                <Text style={styles.waitingText}>
                  {order.awaitingPayment ? 'Waiting for M-Pesa' : 'Sending'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              <Field
                label="Airtime goes to"
                icon="call-outline"
                keyboardType="phone-pad"
                value={recipient}
                onChangeText={(v) => {
                  setRecipient(v);
                  if (payerFollows) setPayer(v);
                  setError(null);
                }}
                placeholder="07…"
                accessibilityLabel="Phone that receives airtime"
                style={styles.number}
              />

              <View style={styles.group}>
                <Text style={styles.label}>Network</Text>
                <Text style={styles.hint}>
                  {detected
                    ? 'Read from the number. Tap another if we guessed wrong.'
                    : 'Pick the recipient’s network.'}
                </Text>
                <View style={styles.wrap}>
                  {KENYAN_NETWORKS.map((n) => (
                    <Choice
                      key={n.id}
                      label={n.short}
                      selected={network === n.id}
                      onPress={() => {
                        setNetwork(n.id);
                        setNetworkTouched(true);
                        setError(null);
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.group}>
                <Text style={styles.label}>Amount</Text>
                <Text style={styles.hint}>
                  {formatMoney(currency, min)} to {formatMoney(currency, max)}
                </Text>
                <View style={styles.wrap}>
                  {quickAmounts.map((n) => (
                    <Choice
                      key={n}
                      label={n.toLocaleString('en-KE')}
                      accessibilityLabel={formatMoney(currency, n)}
                      selected={amountValid && Math.abs(amountNum - n) < 0.001}
                      onPress={() => {
                        setAmount(String(n));
                        setOtherAmount(false);
                        setError(null);
                      }}
                    />
                  ))}
                  {otherAmount ? null : (
                    <Choice label="Other" selected={false} onPress={() => setOtherAmount(true)} />
                  )}
                </View>
                {otherAmount ? (
                  <Field
                    keyboardType="number-pad"
                    value={amount}
                    onChangeText={(v) => {
                      setAmount(v);
                      setError(null);
                    }}
                    onFocus={revealLowerField}
                    placeholder={`${min} to ${max}`}
                    prefix={currency === 'KES' ? 'KSh' : currency}
                    accessibilityLabel="Custom amount"
                    style={styles.number}
                    containerStyle={styles.other}
                  />
                ) : null}
              </View>

              <Field
                label="Pay from"
                hint="This line gets the M-Pesa PIN prompt."
                icon="wallet-outline"
                keyboardType="phone-pad"
                value={payer}
                onChangeText={(v) => {
                  setPayer(v);
                  setPayerFollows(false);
                  setError(null);
                }}
                onFocus={revealLowerField}
                placeholder="Same number, or another"
                accessibilityLabel="Phone that pays with M-Pesa"
                style={styles.number}
              />

              {error ? (
                <View
                  style={styles.problem}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                >
                  <Ionicons name="alert-circle" size={22} color={MART.danger} />
                  <Text style={styles.problemText}>{error}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
      {showForm ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: SPACE.md + (keyboardHeight > 0 ? SPACE.sm : insets.bottom),
              marginBottom: keyboardHeight,
            },
          ]}
        >
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>You pay</Text>
            <Text style={styles.total}>
              {amountValid ? formatMoney(currency, amountNum) : formatMoney(currency, 0)}
            </Text>
          </View>
          <Capsule
            label={busy ? 'Sending prompt…' : 'Pay with M-Pesa'}
            accessibilityLabel={
              amountValid ? `Pay ${formatMoney(currency, amountNum)} with M-Pesa` : 'Pay with M-Pesa'
            }
            chip="arrow-forward"
            fill={mart.primary}
            busy={busy}
            disabled={!canSubmit}
            onPress={() => {
              Keyboard.dismiss();
              void submit();
            }}
          />
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
    paddingTop: SPACE.xl,
    gap: SPACE.lg,
  },
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
  headBody: { ...TYPE.body, marginTop: SPACE.sm, color: MART.ink, maxWidth: 320 },
  page: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
  },
  form: {
    gap: SPACE.xxl,
  },
  group: {},
  label: { ...TYPE.label, marginLeft: SPACE.xs, color: MART.ink },
  hint: { ...TYPE.meta, marginTop: SPACE.xxs, marginLeft: SPACE.xs, color: MART.inkQuiet },
  wrap: {
    marginTop: SPACE.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
  },
  choice: {
    minWidth: 72,
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
  other: { marginTop: SPACE.md },
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
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
    backgroundColor: MART.paper,
    borderTopWidth: 1,
    borderTopColor: MART.border,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: SPACE.md,
    marginBottom: SPACE.md,
    paddingHorizontal: SPACE.xs,
  },
  totalLabel: { ...TYPE.label, color: MART.inkMuted },
  total: { ...TYPE.price, fontSize: 22, lineHeight: 26, color: MART.ink },
  state: {
    ...TILE,
    padding: SPACE.xl,
  },
  stateLobe: { marginLeft: -SPACE.xs },
  stateTitle: { ...TYPE.title, marginTop: SPACE.lg, color: MART.ink },
  stateBody: { ...TYPE.body, marginTop: SPACE.sm, color: MART.ink },
  stateAction: { marginTop: SPACE.xl },
  waiting: {
    marginTop: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  waitingText: { ...TYPE.label, color: MART.info },
});
