import React, { useCallback, useState } from 'react';
import { StyleSheet, View, FlatList, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { fetchPendingGroceryInvoices, payGroceryInvoice, type GroceryInvoice } from '../api/pos-api';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'GroceryInvoices'> & {
  api: ApiClient;
};

export function GroceryInvoicesScreen({ api }: Props) {
  const [invoices, setInvoices] = useState<GroceryInvoice[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInvoices(await fetchPendingGroceryInvoices(api));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load invoices');
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const payInvoice = async (invoice: GroceryInvoice) => {
    try {
      await payGroceryInvoice(api, invoice.id, [
        { method: 'cash', amount: invoice.grandTotal ?? 0 },
      ]);
      Alert.alert('Paid', `Invoice ${invoice.invoiceNumber ?? invoice.id} completed`);
      void load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Payment failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="h1">Pending grocery invoices</Text>
      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={load}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text variant="body">{item.invoiceNumber ?? item.id}</Text>
            <Text variant="caption">{item.customerName ?? 'Walk-in'}</Text>
            <Text variant="h2">{item.grandTotal?.toFixed(2) ?? '0.00'}</Text>
            <Button title="Pay cash" onPress={() => payInvoice(item)} />
          </Card>
        )}
        ListEmptyComponent={<Text variant="muted">No pending invoices</Text>}
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
  card: { marginBottom: theme.spacing.md },
});
