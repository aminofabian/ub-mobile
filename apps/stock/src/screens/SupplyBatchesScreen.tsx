import React, { useCallback, useState } from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { fetchSupplyBatches, type SupplyBatch } from '../api/stock-api';

export function SupplyBatchesScreen({ api }: { api: ApiClient }) {
  const [batches, setBatches] = useState<SupplyBatch[]>([]);

  const load = useCallback(async () => {
    setBatches(await fetchSupplyBatches(api));
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <FlatList
        data={batches}
        keyExtractor={(b) => b.id}
        onRefresh={load}
        refreshing={false}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text variant="body">{item.batchNumber ?? item.id}</Text>
            <Text variant="caption">Expiry: {item.expiryDate ?? '—'}</Text>
            <Text variant="body">Qty: {item.remainingQty ?? 0}</Text>
          </Card>
        )}
        ListEmptyComponent={<Text variant="muted">No batches</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  card: { marginBottom: 12 },
});
