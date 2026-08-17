import React, { useState } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { createInvoice, lockInvoice } from '../api/grocery-api';
import { useInvoiceStore } from '../store/invoice-store';
import type { GroceryStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<GroceryStackParamList, 'Finalize'> & {
  api: ApiClient;
  branchId: string;
};

export function FinalizeScreen({ navigation, api, branchId }: Props) {
  const { lines, total, clear } = useInvoiceStore();
  const [loading, setLoading] = useState(false);

  const finalize = async (lock: boolean) => {
    setLoading(true);
    try {
      const invoice = await createInvoice(api, {
        branchId,
        lines: lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity, unitPrice: l.unitPrice })),
      });
      if (lock && invoice.id) await lockInvoice(api, invoice.id);
      clear();
      Alert.alert('Invoice forwarded', `Invoice ${invoice.invoiceNumber ?? invoice.id} sent to cashier`, [
        { text: 'OK', onPress: () => navigation.navigate('Builder') },
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="h1">Review invoice</Text>
      {lines.map((l) => (
        <Text key={l.itemId} variant="body">
          {l.name} × {l.quantity} = {(l.quantity * l.unitPrice).toFixed(2)}
        </Text>
      ))}
      <Text variant="h2">Total: {total().toFixed(2)}</Text>
      <Button title={loading ? 'Saving...' : 'Forward to cashier'} onPress={() => finalize(true)} disabled={loading} />
      <Button title="Forward without lock" variant="secondary" onPress={() => finalize(false)} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: theme.colors.background, gap: 12 },
});
