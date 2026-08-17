import { useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Button, Text } from '@kiosk/ui';
import { useTenant } from '../lib/TenantContext';
import { usePaymentStatus } from '../hooks/usePaymentStatus';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;

export function OrderDetailScreen() {
  const tenant = useTenant();
  const route = useRoute<Props['route']>();
  const { orderId } = route.params;
  const { data: status, isLoading, error, refetch } = usePaymentStatus(tenant.slug, orderId, true);

  const label = status?.paymentFailed
    ? 'Payment Failed'
    : status?.paid
    ? 'Paid'
    : status?.orderStatus ?? 'Pending';

  const labelColor = status?.paymentFailed
    ? styles.failed
    : status?.paid
    ? styles.paid
    : styles.pending;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text variant="h1">Order Status</Text>
        <Text variant="muted" style={styles.orderId}>
          Order #{orderId.slice(-8).toUpperCase()}
        </Text>

        {isLoading ? (
          <ActivityIndicator size="large" color="#28a745" style={styles.loader} />
        ) : error ? (
          <Text style={styles.error}>
            {error instanceof Error ? error.message : 'Failed to load status'}
          </Text>
        ) : (
          <View style={styles.statusBox}>
            <Text variant="h2" style={labelColor}>
              {label}
            </Text>
            {status?.failureReason ? (
              <Text variant="muted" style={styles.failure}>
                {status.failureReason}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Button title="Refresh Status" onPress={() => refetch()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
  },
  content: {
    flex: 1,
  },
  orderId: {
    marginTop: 4,
    marginBottom: 24,
  },
  loader: {
    marginTop: 48,
  },
  statusBox: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  paid: {
    color: '#28a745',
    marginBottom: 8,
  },
  pending: {
    color: '#fd7e14',
    marginBottom: 8,
  },
  failed: {
    color: '#dc3545',
    marginBottom: 8,
  },
  failure: {
    textAlign: 'center',
    marginTop: 8,
  },
  error: {
    color: '#dc3545',
    textAlign: 'center',
    marginTop: 24,
  },
  footer: {
    marginTop: 'auto',
  },
});
