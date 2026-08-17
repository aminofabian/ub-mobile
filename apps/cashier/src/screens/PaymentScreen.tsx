import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Text, theme } from '@kiosk/ui';
import { initiateStkPush, pollUntilComplete } from '@kiosk/payments';
import { outbox } from '@kiosk/offline';
import { generateIdempotencyKey } from '@kiosk/core';
import type { ApiClient } from '@kiosk/core';
import { createSale, ensureCustomerByPhone } from '../api/pos-api';
import { usePosStore } from '../store/pos-store';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Payment'> & {
  api: ApiClient;
  branchId: string;
};

export function PaymentScreen({ navigation, api, branchId }: Props) {
  const { cart, cartTotal, clearCart, setLastSale } = usePosStore();
  const [method, setMethod] = useState<'cash' | 'mpesa'>('cash');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const linkedCustomerIdRef = React.useRef<string | null>(null);

  const total = cartTotal();

  const completeSale = async (payments: { method: string; amount: number; reference?: string }[]) => {
    setLoading(true);
    try {
      let customerId = linkedCustomerIdRef.current;
      if (!customerId && method === 'mpesa' && phone.trim()) {
        const linked = await ensureCustomerByPhone(api, phone.trim());
        customerId = linked?.id ?? null;
        linkedCustomerIdRef.current = customerId;
      }

      const body = {
        branchId,
        ...(customerId ? { customerId } : {}),
        lines: cart.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        payments,
        clientSoldAt: new Date().toISOString(),
      };

      try {
        const sale = await createSale(api, body);
        setLastSale(sale);
        clearCart();
        navigation.replace('Receipt');
      } catch (networkError) {
        const idempotencyKey = generateIdempotencyKey();
        await outbox.enqueue({
          id: idempotencyKey,
          method: 'POST',
          path: '/api/v1/sales',
          body,
          idempotencyKey,
        });
        Alert.alert(
          'Saved offline',
          'Sale queued and will sync when connection returns.',
          [{ text: 'OK', onPress: () => navigation.navigate('Pos') }]
        );
        clearCart();
      }
    } catch (e) {
      Alert.alert('Payment failed', e instanceof Error ? e.message : 'Could not complete sale');
    } finally {
      setLoading(false);
    }
  };

  const payCash = () => completeSale([{ method: 'cash', amount: total }]);

  const payMpesa = async () => {
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Enter customer M-Pesa number');
      return;
    }
    setLoading(true);
    try {
      // Link by number in the background — do not await before STK.
      void ensureCustomerByPhone(api, phone.trim()).then((linked) => {
        if (linked) linkedCustomerIdRef.current = linked.id;
      });

      const stk = await initiateStkPush(api, {
        phoneNumber: phone.trim(),
        amount: total,
      });
      if (!stk.checkoutRequestId) {
        Alert.alert('STK failed', stk.message ?? 'Could not send prompt');
        return;
      }
      const result = await pollUntilComplete(api, stk.checkoutRequestId);
      if (result.status !== 'completed') {
        Alert.alert('Payment failed', result.message ?? 'Customer did not complete payment');
        return;
      }
      await completeSale([
        { method: 'mpesa', amount: total, reference: stk.checkoutRequestId },
      ]);
    } catch (e) {
      Alert.alert('M-Pesa error', e instanceof Error ? e.message : 'STK push failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="h1">Payment</Text>
      <Text variant="h2">Total: {total.toFixed(2)}</Text>

      <View style={styles.methods}>
        <Button
          title="Cash"
          variant={method === 'cash' ? 'primary' : 'secondary'}
          onPress={() => setMethod('cash')}
        />
        <Button
          title="M-Pesa"
          variant={method === 'mpesa' ? 'primary' : 'secondary'}
          onPress={() => setMethod('mpesa')}
        />
      </View>

      {method === 'mpesa' && (
        <TextInput
          style={styles.input}
          placeholder="M-Pesa phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          accessibilityLabel="M-Pesa phone number"
        />
      )}

      <Button
        title={loading ? 'Processing...' : 'Complete payment'}
        onPress={method === 'cash' ? payCash : payMpesa}
        disabled={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  methods: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginVertical: theme.spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    minHeight: 48,
  },
});
