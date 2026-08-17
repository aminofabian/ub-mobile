import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Button, Text } from '@kiosk/ui';
import { useTenant } from '../lib/TenantContext';
import { usePaymentOptions } from '../hooks/usePaymentOptions';
import { useStkPush } from '../hooks/useStkPush';
import { usePaymentStatus } from '../hooks/usePaymentStatus';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function PaymentScreen() {
  const tenant = useTenant();
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<NavigationProp>();
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#28a745" />
      </View>
    );
  }

  const onlineMethods = paymentOptions?.online ?? [];
  const manualMethods = paymentOptions?.manual ?? [];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text variant="h1">Payment</Text>
        <Text variant="body">
          Order total:{' '}
          <Text style={styles.total}>
            {currency} {grandTotal.toFixed(2)}
          </Text>
        </Text>
      </View>

      {onlineMethods.length > 0 && (
        <View style={styles.section}>
          <Text variant="h2">Pay with M-Pesa</Text>
          <TextInput
            style={styles.input}
            placeholder="M-Pesa phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            accessibilityLabel="M-Pesa phone number"
          />

          <View style={styles.methods}>
            {onlineMethods.map((method) => (
              <TouchableMethod
                key={method.configId}
                label={method.displayName}
                selected={selectedOnline === method.configId}
                onPress={() => setSelectedOnline(method.configId)}
              />
            ))}
          </View>

          {polling ? (
            <View style={styles.statusBox}>
              <ActivityIndicator color="#28a745" />
              <Text style={styles.statusText}>Waiting for M-Pesa confirmation...</Text>
            </View>
          ) : (
            <Button
              title={stkPush.isPending ? 'Requesting...' : 'Request STK Push'}
              onPress={handlePayOnline}
              disabled={!phone || !selectedOnline || stkPush.isPending}
              style={styles.button}
            />
          )}

          {stkPush.error && (
            <Text style={styles.error}>
              {stkPush.error instanceof Error ? stkPush.error.message : 'Payment request failed'}
            </Text>
          )}

          {status?.paymentFailed && (
            <Text style={styles.error}>Payment failed: {status.failureReason}</Text>
          )}
        </View>
      )}

      {manualMethods.length > 0 && (
        <View style={styles.section}>
          <Text variant="h2">Manual Payment</Text>
          {manualMethods.map((method) => (
            <View key={method.configId} style={styles.manualCard}>
              <Text style={styles.manualLabel}>{method.label}</Text>
              <Text variant="body">{method.instructions}</Text>
              {method.tillNumber && <Text variant="muted">Till: {method.tillNumber}</Text>}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function TouchableMethod({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.methodChip, selected && styles.methodChipSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={selected ? styles.methodTextSelected : undefined}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 16,
  },
  total: {
    fontWeight: '700',
    color: '#28a745',
  },
  section: {
    marginTop: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginTop: 12,
    minHeight: 48,
  },
  methods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  methodChip: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    marginBottom: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  methodChipSelected: {
    backgroundColor: '#28a745',
    borderColor: '#28a745',
  },
  methodTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  button: {
    marginTop: 16,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  statusText: {
    marginLeft: 12,
  },
  error: {
    color: '#dc3545',
    marginTop: 12,
  },
  manualCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  manualLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
});
