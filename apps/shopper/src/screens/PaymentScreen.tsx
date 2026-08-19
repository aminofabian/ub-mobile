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
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTenant } from '../lib/TenantContext';
import { usePaymentOptions } from '../hooks/usePaymentOptions';
import { useStkPush } from '../hooks/useStkPush';
import { usePaymentStatus } from '../hooks/usePaymentStatus';
import { Bone, SkeletonScope } from '../components/Skeleton';
import { looksLikeKenyanMobile } from '../lib/phone';
import { formatMoney } from '../lib/media';
import { RootStackParamList } from '../navigation/AppNavigator';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function PaymentScreen() {
  const tenant = useTenant();
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const mart = martFromTenant(tenant);
  const { orderId, grandTotal, currency, customerPhone } = route.params;

  const { data: paymentOptions, isLoading: optionsLoading } = usePaymentOptions(tenant.slug);
  const stkPush = useStkPush(tenant.slug, orderId);
  const [phone, setPhone] = useState(customerPhone);
  const [selectedOnline, setSelectedOnline] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const { data: status } = usePaymentStatus(tenant.slug, orderId, polling);

  useEffect(() => {
    if (status?.paid) {
      setPolling(false);
      navigation.replace('OrderConfirmation', { orderId });
    }
  }, [status, navigation, orderId]);

  useEffect(() => {
    if (status?.paymentFailed) {
      setPolling(false);
    }
  }, [status?.paymentFailed]);

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
          <Bone h={84} />
          <Bone h={50} />
          <Bone h={44} />
          <Bone h={52} />
        </SkeletonScope>
      </View>
    );
  }

  const phoneValid = looksLikeKenyanMobile(phone);
  const canPay = phoneValid && Boolean(selectedOnline) && !stkPush.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.shell}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: SPACE.xxl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.amount, { backgroundColor: mart.primary }]}>
          <Text style={styles.amountLabel}>Amount due</Text>
          <Text style={styles.amountValue}>{formatMoney(currency, grandTotal)}</Text>
          <Text style={styles.amountMeta}>Order #{orderId.slice(-8).toUpperCase()}</Text>
        </View>

        {onlineMethods.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pay with M-Pesa</Text>

            {onlineMethods.length > 1 ? (
              <View style={styles.methods} accessibilityRole="radiogroup">
                {onlineMethods.map((method) => {
                  const selected = selectedOnline === method.configId;
                  return (
                    <Pressable
                      key={method.configId}
                      onPress={() => setSelectedOnline(method.configId)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[
                        styles.methodChip,
                        selected && { backgroundColor: mart.primary, borderColor: mart.primary },
                      ]}
                    >
                      <Text style={[styles.methodText, selected && styles.methodTextOn]}>
                        {method.displayName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>M-Pesa number</Text>
            <Text style={styles.fieldHint}>The PIN prompt goes to this phone.</Text>
            <TextInput
              style={[styles.input, phone.length > 0 && !phoneValid && styles.inputError]}
              placeholder="0712 345 678"
              placeholderTextColor={MART.inkQuiet}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!polling}
              accessibilityLabel="M-Pesa phone number"
            />
            {phone.length > 0 && !phoneValid ? (
              <Text style={styles.fieldError}>
                Enter a Kenyan mobile, e.g. 0712 345 678.
              </Text>
            ) : null}

            {polling ? (
              <View style={styles.waiting}>
                <ActivityIndicator color={mart.primary} />
                <View style={styles.waitingCopy}>
                  <Text style={styles.waitingTitle}>Check your phone</Text>
                  <Text style={styles.waitingBody}>
                    Enter your M-Pesa PIN to confirm. This screen updates on its own.
                  </Text>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => void handlePayOnline()}
                disabled={!canPay}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.cta,
                  { backgroundColor: mart.primary },
                  !canPay && styles.ctaDisabled,
                  pressed && styles.ctaPressed,
                ]}
              >
                <Text style={styles.ctaLabel}>
                  {stkPush.isPending
                    ? 'Sending prompt…'
                    : `Pay ${formatMoney(currency, grandTotal)}`}
                </Text>
              </Pressable>
            )}

            {stkPush.error ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {stkPush.error instanceof Error
                  ? stkPush.error.message
                  : 'We could not send the M-Pesa prompt. Try again.'}
              </Text>
            ) : null}

            {status?.paymentFailed ? (
              <View style={styles.failed}>
                <Ionicons name="alert-circle-outline" size={20} color={MART.danger} />
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
            <Text style={styles.sectionTitle}>
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
            <Text style={styles.sectionTitle}>No payment method set up</Text>
            <Text style={styles.manualBody}>
              Your order is saved. Pay at the counter and mention order #
              {orderId.slice(-8).toUpperCase()}.
            </Text>
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
    paddingTop: SPACE.md,
  },
  amount: {
    padding: SPACE.xl,
    borderRadius: RADIUS.md,
  },
  amountLabel: {
    ...TYPE.meta,
    color: ON_BRAND.secondary,
  },
  amountValue: {
    ...TYPE.display,
    marginTop: SPACE.xxs,
    fontSize: 34,
    lineHeight: 38,
    color: ON_BRAND.primary,
  },
  amountMeta: {
    ...TYPE.meta,
    marginTop: SPACE.sm,
    color: ON_BRAND.secondary,
    fontVariant: ['tabular-nums'],
  },
  section: {
    marginTop: SPACE.xxl,
  },
  sectionTitle: {
    ...TYPE.heading,
    marginBottom: SPACE.md,
    color: MART.ink,
  },
  methods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
    marginBottom: SPACE.lg,
  },
  methodChip: {
    minHeight: 44,
    paddingHorizontal: SPACE.lg,
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
  },
  methodText: {
    ...TYPE.label,
    color: MART.ink,
  },
  methodTextOn: {
    color: ON_BRAND.primary,
  },
  fieldLabel: {
    ...TYPE.label,
    fontWeight: '700',
    color: MART.ink,
  },
  fieldHint: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
  input: {
    ...TYPE.heading,
    marginTop: SPACE.sm,
    minHeight: 52,
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderColor: MART.border,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    color: MART.ink,
    letterSpacing: 0.4,
  },
  inputError: {
    borderColor: MART.danger,
  },
  fieldError: {
    ...TYPE.meta,
    marginTop: SPACE.xs,
    color: MART.danger,
  },
  waiting: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.md,
    marginTop: SPACE.xl,
    padding: SPACE.lg,
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
  },
  waitingCopy: {
    flex: 1,
    minWidth: 0,
  },
  waitingTitle: {
    ...TYPE.label,
    fontSize: 14,
    fontWeight: '700',
    color: MART.ink,
  },
  waitingBody: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    lineHeight: 18,
    color: MART.inkMuted,
  },
  cta: {
    marginTop: SPACE.xl,
    minHeight: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaLabel: {
    ...TYPE.heading,
    color: ON_BRAND.primary,
  },
  error: {
    ...TYPE.meta,
    marginTop: SPACE.md,
    color: MART.danger,
  },
  failed: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.md,
    marginTop: SPACE.lg,
    padding: SPACE.lg,
    borderRadius: RADIUS.md,
    backgroundColor: MART.dangerSurface,
  },
  failedTitle: {
    ...TYPE.label,
    fontSize: 14,
    fontWeight: '700',
    color: MART.danger,
  },
  failedBody: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    lineHeight: 18,
    color: MART.ink,
  },
  manualCard: {
    marginBottom: SPACE.sm,
    padding: SPACE.lg,
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
  },
  manualLabel: {
    ...TYPE.label,
    fontSize: 14,
    fontWeight: '700',
    color: MART.ink,
  },
  manualBody: {
    ...TYPE.body,
    marginTop: SPACE.xs,
    color: MART.inkMuted,
  },
  manualTill: {
    ...TYPE.heading,
    marginTop: SPACE.sm,
    color: MART.ink,
    fontVariant: ['tabular-nums'],
  },
});
