import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTenant } from '../lib/TenantContext';
import { usePaymentOptions } from '../hooks/usePaymentOptions';
import { useStkPush } from '../hooks/useStkPush';
import { usePaymentStatus } from '../hooks/usePaymentStatus';
import { Capsule } from '../components/Capsule';
import { Coast, COAST_SWELL } from '../components/Coast';
import { Field } from '../components/Field';
import { Bone, SkeletonScope } from '../components/Skeleton';
import { doneFeel, failFeel, stepFeel } from '../lib/haptics';
import { looksLikeKenyanMobile } from '../lib/phone';
import { formatMoney } from '../lib/media';
import { RootStackParamList } from '../navigation/AppNavigator';
import { FONT, GUTTER, MART, martFromTenant, RADIUS, SPACE, TILE, TYPE } from '../theme/mart';

/** Where the amount's coast rests, below the stack header. */
const AMOUNT_HEIGHT = 148;

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function PaymentScreen() {
  const tenant = useTenant();
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const mart = martFromTenant(tenant);
  const { orderId, grandTotal, currency, customerPhone, orderCode, pickup } = route.params;
  // The short code is what the shop reads out; the end of the long id is only a fallback.
  const orderLabel = orderCode ?? orderId.slice(-8).toUpperCase();

  const { data: paymentOptions, isLoading: optionsLoading } = usePaymentOptions(tenant.slug);
  const stkPush = useStkPush(tenant.slug, orderId);
  const [phone, setPhone] = useState(customerPhone);
  const [selectedOnline, setSelectedOnline] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const { data: status } = usePaymentStatus(tenant.slug, orderId, polling);

  useEffect(() => {
    if (status?.paid) {
      setPolling(false);
      navigation.replace('OrderConfirmation', { orderId, orderCode, pickup });
    }
  }, [status, navigation, orderId, orderCode, pickup]);

  useEffect(() => {
    if (status?.paymentFailed) {
      setPolling(false);
    }
  }, [status?.paymentFailed]);

  // One tick each, the first time the answer arrives: paid, or not.
  const paid = Boolean(status?.paid);
  const failed = Boolean(status?.paymentFailed);
  useEffect(() => {
    if (paid) doneFeel();
  }, [paid]);
  useEffect(() => {
    if (failed) failFeel();
  }, [failed]);

  const onlineMethods = paymentOptions?.online ?? [];
  const manualMethods = paymentOptions?.manual ?? [];

  useEffect(() => {
    if (!selectedOnline && onlineMethods.length === 1) {
      setSelectedOnline(onlineMethods[0].configId);
    }
  }, [onlineMethods, selectedOnline]);

  async function handlePayOnline() {
    if (!selectedOnline) return;
    const result = await stkPush.mutateAsync({
      phoneNumber: phone,
      configId: selectedOnline,
    });
    if (result.accepted) {
      setPolling(true);
    }
  }

  if (optionsLoading) {
    return (
      <View style={styles.shell}>
        <SkeletonScope label="Loading payment options" style={styles.loading}>
          <Bone h={AMOUNT_HEIGHT - SPACE.lg} r={RADIUS.xl} />
          <Bone h={26} w={180} />
          <Bone h={54} r={RADIUS.pill} />
          <Bone h={56} r={RADIUS.pill} />
        </SkeletonScope>
      </View>
    );
  }

  const phoneValid = looksLikeKenyanMobile(phone);
  const canPay = phoneValid && Boolean(selectedOnline) && !stkPush.isPending;
  const on = mart.onPrimary;

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: SPACE.xxl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.amount}>
          <Coast color={mart.primary} height={AMOUNT_HEIGHT} />
          <Text style={[styles.amountLabel, { color: on.secondary }]}>Amount due</Text>
          <Text style={[styles.amountValue, { color: on.primary }]}>
            {formatMoney(currency, grandTotal)}
          </Text>
          <Text style={[styles.amountMeta, { color: on.secondary }]}>Order {orderLabel}</Text>
        </View>

        {onlineMethods.length > 0 ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Pay with M-Pesa
            </Text>

            {onlineMethods.length > 1 ? (
              <View style={styles.methods} accessibilityRole="radiogroup">
                {onlineMethods.map((method) => {
                  const selected = selectedOnline === method.configId;
                  return (
                    <Pressable
                      key={method.configId}
                      onPress={() => {
                        stepFeel();
                        setSelectedOnline(method.configId);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => [
                        styles.methodChip,
                        selected && { backgroundColor: mart.primary, borderColor: mart.primary },
                        pressed && styles.pressed,
                      ]}
                    >
                      {selected ? <Ionicons name="checkmark" size={16} color={on.primary} /> : null}
                      <Text style={[styles.methodText, selected && { color: on.primary }]}>
                        {method.displayName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Field
              label="M-Pesa number"
              icon="call-outline"
              placeholder="0712 345 678"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!polling}
              accessibilityLabel="M-Pesa phone number"
              hint="The PIN prompt goes to this phone."
              error={phone.length > 0 && !phoneValid ? 'Enter a Kenyan mobile, e.g. 0712 345 678.' : null}
              style={styles.phoneInput}
            />

            {polling ? (
              <View style={styles.waiting}>
                <ActivityIndicator color={MART.ink} />
                <View style={styles.waitingCopy}>
                  <Text style={styles.waitingTitle}>Check your phone</Text>
                  <Text style={styles.waitingBody}>
                    Enter your M-Pesa PIN to confirm. This screen updates on its own.
                  </Text>
                </View>
              </View>
            ) : (
              <Capsule
                label={
                  stkPush.isPending ? 'Sending prompt…' : `Pay ${formatMoney(currency, grandTotal)}`
                }
                chip="arrow-forward"
                fill={mart.primary}
                busy={stkPush.isPending}
                disabled={!canPay && !stkPush.isPending}
                onPress={() => void handlePayOnline()}
                style={styles.cta}
              />
            )}

            {stkPush.error ? (
              <View style={styles.failed}>
                <Ionicons name="alert-circle" size={22} color={MART.danger} />
                <Text accessibilityLiveRegion="polite" style={[styles.failedBody, styles.waitingCopy]}>
                  {stkPush.error instanceof Error
                    ? stkPush.error.message
                    : 'We could not send the M-Pesa prompt. Try again.'}
                </Text>
              </View>
            ) : null}

            {status?.paymentFailed ? (
              <View style={styles.failed} accessibilityLiveRegion="polite">
                <Ionicons name="alert-circle" size={22} color={MART.danger} />
                <View style={styles.waitingCopy}>
                  <Text style={styles.failedTitle}>Payment did not go through</Text>
                  <Text style={styles.failedBody}>
                    {status.failureReason || 'Nothing was charged. You can send the prompt again.'}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {manualMethods.length > 0 ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {onlineMethods.length > 0 ? 'Or pay at the counter' : 'Pay at the counter'}
            </Text>
            {manualMethods.map((method) => (
              <View key={method.configId} style={styles.manualCard}>
                <Text style={styles.manualLabel}>{method.label}</Text>
                <Text style={styles.manualBody}>{method.instructions}</Text>
                {method.tillNumber ? (
                  <Text selectable style={styles.manualTill}>
                    Till {method.tillNumber}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {onlineMethods.length === 0 && manualMethods.length === 0 ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              No payment method set up
            </Text>
            <View style={styles.manualCard}>
              <Text style={styles.manualBody}>
                Your order is saved. Pay at the counter and mention order {orderLabel}.
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  loading: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.lg,
    gap: SPACE.lg,
  },
  content: {
    paddingHorizontal: GUTTER,
  },
  /** The amount sits on land: a coast in the shop's colour that runs off both sides. */
  amount: {
    marginHorizontal: -GUTTER,
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.lg,
    height: AMOUNT_HEIGHT + COAST_SWELL,
  },
  amountLabel: {
    ...TYPE.label,
  },
  amountValue: {
    ...TYPE.display,
    fontSize: 40,
    lineHeight: 44,
    marginTop: SPACE.xs,
  },
  amountMeta: {
    ...TYPE.meta,
    marginTop: SPACE.sm,
  },
  section: {
    marginTop: SPACE.xxl,
  },
  sectionTitle: {
    ...TYPE.title,
    marginBottom: SPACE.lg,
    color: MART.ink,
  },
  methods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
    marginBottom: SPACE.xl,
  },
  methodChip: {
    minHeight: 44,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: MART.ink,
  },
  methodText: {
    ...TYPE.label,
    color: MART.ink,
  },
  pressed: {
    opacity: 0.7,
  },
  phoneInput: {
    fontFamily: FONT.semibold,
    fontSize: 18,
    letterSpacing: 0.4,
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.md,
    marginTop: SPACE.xl,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.infoSurface,
  },
  waitingCopy: {
    flex: 1,
    minWidth: 0,
  },
  waitingTitle: {
    ...TYPE.heading,
    color: MART.ink,
  },
  waitingBody: {
    ...TYPE.body,
    marginTop: SPACE.xxs,
    color: MART.ink,
  },
  cta: {
    marginTop: SPACE.xl,
  },
  failed: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.md,
    marginTop: SPACE.lg,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.dangerSurface,
  },
  failedTitle: {
    ...TYPE.heading,
    color: MART.danger,
  },
  failedBody: {
    ...TYPE.body,
    marginTop: SPACE.xxs,
    color: MART.ink,
  },
  manualCard: {
    ...TILE,
    marginBottom: SPACE.sm,
  },
  manualLabel: {
    ...TYPE.heading,
    color: MART.ink,
  },
  manualBody: {
    ...TYPE.body,
    marginTop: SPACE.xs,
    color: MART.inkMuted,
  },
  manualTill: {
    ...TYPE.price,
    fontSize: 22,
    lineHeight: 26,
    marginTop: SPACE.md,
    color: MART.ink,
  },
});
