import { useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Capsule, Tag } from '../components/Capsule';
import { Bone, SkeletonScope } from '../components/Skeleton';
import { StateBlock } from '../components/StateBlock';
import { useTenant } from '../lib/TenantContext';
import { usePaymentStatus } from '../hooks/usePaymentStatus';
import { RootStackParamList } from '../navigation/AppNavigator';
import { GUTTER, MART, martFromTenant, RADIUS, SPACE, TILE, TYPE, ZONE } from '../theme/mart';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;

export function OrderDetailScreen() {
  const tenant = useTenant();
  const insets = useSafeAreaInsets();
  const mart = martFromTenant(tenant);
  const route = useRoute<Props['route']>();
  const { orderId } = route.params;
  const { data: status, isLoading, error, refetch } = usePaymentStatus(tenant.slug, orderId, true);

  const tone = status?.paymentFailed
    ? { zone: ZONE.coral, label: 'Payment failed' }
    : status?.paid
      ? { zone: ZONE.leaf, label: 'Paid' }
      : { zone: ZONE.sun, label: sentence(status?.orderStatus ?? 'Pending') };

  return (
    <View style={[styles.shell, { paddingBottom: SPACE.md + insets.bottom }]}>
      <View style={styles.body}>
        <Text accessibilityRole="header" style={styles.title}>
          Order status
        </Text>
        <Text selectable style={styles.orderId}>
          #{orderId.slice(-8).toUpperCase()}
        </Text>

        {isLoading ? (
          <SkeletonScope label="Loading order status" style={styles.loading}>
            <Bone h={132} r={RADIUS.lg} />
          </SkeletonScope>
        ) : error ? (
          <StateBlock
            tone="problem"
            icon="cloud-offline"
            title="We could not load this order"
            body={error instanceof Error ? error.message : 'Check your connection and refresh.'}
            style={styles.problem}
          />
        ) : (
          <View style={styles.card}>
            <Tag label={tone.label} color={tone.zone} />
            <Text style={styles.statusReason}>
              {status?.failureReason
                ? status.failureReason
                : status?.paid
                  ? 'Payment confirmed. Collect at the counter with this number.'
                  : 'We are still waiting on confirmation. This refreshes on its own.'}
            </Text>
          </View>
        )}
      </View>

      <Capsule label="Refresh" chip="refresh" fill={mart.primary} onPress={() => void refetch()} />
    </View>
  );
}

/** "PENDING_PAYMENT" and "pending payment" both read "Pending payment". */
function sentence(text: string): string {
  const words = text.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Pending';
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
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
    color: MART.inkMuted,
  },
  loading: {
    marginTop: SPACE.xxl,
  },
  problem: {
    paddingHorizontal: 0,
  },
  card: {
    ...TILE,
    marginTop: SPACE.xxl,
    padding: SPACE.xl,
  },
  statusReason: {
    ...TYPE.body,
    marginTop: SPACE.md,
    color: MART.ink,
  },
});
