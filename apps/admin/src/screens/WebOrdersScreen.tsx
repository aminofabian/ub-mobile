import React, { useCallback, useState } from 'react';
import { StyleSheet, View, FlatList, Alert } from 'react-native';
import { Button, Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { fetchWebOrders, updateOrderStatus, type WebOrder } from '../api/admin-api';

export function WebOrdersScreen({ api }: { api: ApiClient }) {
  const [orders, setOrders] = useState<WebOrder[]>([]);

  const load = useCallback(async () => {
    try {
      setOrders(await fetchWebOrders(api));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load orders');
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (orderId: string, status: string) => {
    try {
      await updateOrderStatus(api, orderId, status);
      void load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        onRefresh={load}
        refreshing={false}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text variant="body">{item.customerName ?? item.id}</Text>
            <Text variant="caption">Status: {item.status}</Text>
            <Text variant="h2">{item.grandTotal?.toFixed(2)}</Text>
            <View style={styles.actions}>
              <Button title="Preparing" variant="secondary" onPress={() => setStatus(item.id, 'PREPARING')} />
              <Button title="Ready" onPress={() => setStatus(item.id, 'READY')} />
              <Button title="Delivered" variant="secondary" onPress={() => setStatus(item.id, 'DELIVERED')} />
            </View>
          </Card>
        )}
        ListEmptyComponent={<Text variant="muted">No web orders</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  card: { marginBottom: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
});
