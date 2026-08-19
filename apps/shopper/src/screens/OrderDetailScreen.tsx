import { useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTenant } from '../lib/TenantContext';
import { usePaymentStatus } from '../hooks/usePaymentStatus';
import { Bone, SkeletonScope } from '../components/Skeleton';
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

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;

export function OrderDetailScreen() {
  const tenant = useTenant();
  const insets = useSafeAreaInsets();
  const mart = martFromTenant(tenant);
  const route = useRoute<Props['route']>();
  const { orderId } = route.params;
  const { data: status, isLoading, error, refetch } = usePaymentStatus(tenant.slug, orderId, true);

  const tone = status?.paymentFailed
    ? { bg: MART.dangerSurface, fg: MART.danger, label: 'Payment failed' }
    : status?.paid
      ? { bg: MART.successSurface, fg: MART.success, label: 'Paid' }
      : { bg: MART.warningSurface, fg: MART.warning, label: status?.orderStatus ?? 'Pending' };

  return (
    <View style={[styles.shell, { paddingBottom: SPACE.xl + insets.bottom }]}>
      <View style={styles.body}>
        <Text style={styles.title}>Order status</Text>
        <Text style={styles.orderId}>#{orderId.slice(-8).toUpperCase()}</Text>

        {isLoading ? (
          <SkeletonScope label="Loading order status" style={styles.loading}>
            <Bone h={96} />
          </SkeletonScope>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.errorTitle}>We could not load this order</Text>
            <Text style={styles.errorBody}>
              {error instanceof Error ? error.message : 'Check your connection and refresh.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: tone.bg, borderWidth: 0 }]}>
            <Text style={[styles.statusLabel, { color: tone.fg }]}>{tone.label}</Text>
            {status?.failureReason ? (
              <Text style={styles.statusReason}>{status.failureReason}</Text>
            ) : status?.paid ? (
              <Text style={styles.statusReason}>
                Payment confirmed. Collect at the counter with this number.
              </Text>
            ) : (
              <Text style={styles.statusReason}>
                We are still waiting on confirmation. This refreshes on its own.
              </Text>
            )}
          </View>
        )}
      </View>

      <Pressable
        onPress={() => void refetch()}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: mart.primary },
          pressed && styles.ctaPressed,
        ]}
      >
        <Text style={styles.ctaLabel}>Refresh</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.lg,
    backgroundColor: MART.paper,
  },
  body: {
    flex: 1,
  },
  title: {
    ...TYPE.display,
    color: MART.ink,
  },
  orderId: {
    ...TYPE.body,
    marginTop: SPACE.xs,
    color: MART.inkQuiet,
    fontVariant: ['tabular-nums'],
  },
  loading: {
    marginTop: SPACE.xxl,
  },
  card: {
    marginTop: SPACE.xxl,
    padding: SPACE.xl,
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
  },
  statusLabel: {
    ...TYPE.title,
    textTransform: 'capitalize',
  },
  statusReason: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: MART.ink,
  },
  errorTitle: {
    ...TYPE.heading,
    color: MART.ink,
  },
  errorBody: {
    ...TYPE.body,
    marginTop: SPACE.xs,
    color: MART.inkMuted,
  },
  cta: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaLabel: {
    ...TYPE.heading,
    color: ON_BRAND.primary,
  },
});
