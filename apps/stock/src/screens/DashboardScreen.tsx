import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { fetchInventoryValuation, fetchLowStockItems } from '../api/stock-api';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'Dashboard'> & {
  api: ApiClient;
  onLogout: () => void;
};

export function DashboardScreen({ navigation, api, onLogout }: Props) {
  const [valuation, setValuation] = useState<number | null>(null);
  const [lowStockCount, setLowStockCount] = useState(0);

  const load = useCallback(async () => {
    const [val, items] = await Promise.all([
      fetchInventoryValuation(api),
      fetchLowStockItems(api),
    ]);
    setValuation(val.totalValue ?? null);
    setLowStockCount(items.length);
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Text variant="h1">Stock dashboard</Text>
      <Card style={styles.card}>
        <Text variant="caption">Stock value</Text>
        <Text variant="h2">{valuation?.toFixed(2) ?? '—'}</Text>
      </Card>
      <Card style={styles.card}>
        <Text variant="caption">Low / out of stock</Text>
        <Text variant="h2">{lowStockCount}</Text>
      </Card>
      <Button title="Start stock take" onPress={() => navigation.navigate('StockTake')} />
      <Button title="Place order" onPress={() => navigation.navigate('Orders')} style={styles.action} />
      <Button title="Receive orders" variant="secondary" onPress={() => navigation.navigate('Receive')} style={styles.action} />
      <Button title="Supply batches" variant="secondary" onPress={() => navigation.navigate('Batches')} style={styles.action} />
      <Button title="Transfers" variant="secondary" onPress={() => navigation.navigate('Transfers')} style={styles.action} />
      <Button title="Sign out" variant="secondary" onPress={onLogout} style={styles.action} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  card: { marginBottom: 12 },
  action: { marginTop: 8 },
});
