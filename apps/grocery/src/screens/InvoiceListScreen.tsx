import React, { useCallback, useState } from 'react';
import { StyleSheet, View, FlatList, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { cancelInvoice, listInvoices, type GroceryInvoice } from '../api/grocery-api';
import type { GroceryStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<GroceryStackParamList, 'Invoices'> & { api: ApiClient };

export function InvoiceListScreen({ api }: Props) {
  const [invoices, setInvoices] = useState<GroceryInvoice[]>([]);

  const load = useCallback(async () => {
    try {
      setInvoices(await listInvoices(api));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load invoices');
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <FlatList
        data={invoices}
        keyExtractor={(i) => i.id}
        onRefresh={load}
        refreshing={false}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text variant="body">{item.invoiceNumber ?? item.id}</Text>
            <Text variant="caption">Status: {item.status}</Text>
            <Text variant="h2">{item.grandTotal?.toFixed(2)}</Text>
            {item.status === 'PENDING' && (
              <Button title="Cancel" variant="danger" onPress={() => cancelInvoice(api, item.id).then(load)} />
            )}
          </Card>
        )}
        ListEmptyComponent={<Text variant="muted">No invoices</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  card: { marginBottom: 12 },
});
