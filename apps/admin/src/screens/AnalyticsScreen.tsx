import React, { useCallback, useState } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { fetchFinancePulse, fetchInventoryReport, fetchSalesReport } from '../api/admin-api';

export function AnalyticsScreen({ api }: { api: ApiClient }) {
  const [sales, setSales] = useState<unknown>(null);
  const [inventory, setInventory] = useState<unknown>(null);
  const [pulse, setPulse] = useState<unknown>(null);

  const load = useCallback(async () => {
    const [s, i, p] = await Promise.all([
      fetchSalesReport(api).catch(() => null),
      fetchInventoryReport(api).catch(() => null),
      fetchFinancePulse(api).catch(() => null),
    ]);
    setSales(s);
    setInventory(i);
    setPulse(p);
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Text variant="h2">Sales report</Text>
        <Text variant="caption">{sales ? JSON.stringify(sales, null, 2).slice(0, 500) : 'Loading...'}</Text>
      </Card>
      <Card style={styles.card}>
        <Text variant="h2">Inventory report</Text>
        <Text variant="caption">{inventory ? JSON.stringify(inventory, null, 2).slice(0, 500) : 'Loading...'}</Text>
      </Card>
      <Card style={styles.card}>
        <Text variant="h2">Finance pulse</Text>
        <Text variant="caption">{pulse ? JSON.stringify(pulse, null, 2).slice(0, 500) : 'Loading...'}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  card: { marginBottom: 16 },
});
