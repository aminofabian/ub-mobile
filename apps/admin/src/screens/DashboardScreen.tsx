import React, { useCallback, useState } from 'react';
import { StyleSheet, View, RefreshControl, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { fetchOwnerSummary, type OwnerSummary } from '../api/admin-api';
import type { AdminStackParamList } from '../navigation/AppNavigator';

interface Props {
  api: ApiClient;
  branchId: string;
  onLogout: () => void;
}

export function DashboardScreen({ api, branchId, onLogout }: Props) {
  const [summary, setSummary] = useState<OwnerSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setSummary(await fetchOwnerSummary(api));
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
    >
      <Text variant="h1">Business pulse</Text>
      <View style={styles.grid}>
        <Card style={styles.card}>
          <Text variant="caption">Revenue today</Text>
          <Text variant="h2">{summary?.revenueToday?.toFixed(2) ?? '—'}</Text>
        </Card>
        <Card style={styles.card}>
          <Text variant="caption">Orders today</Text>
          <Text variant="h2">{summary?.ordersToday ?? '—'}</Text>
        </Card>
        <Card style={styles.card}>
          <Text variant="caption">Profit today</Text>
          <Text variant="h2">{summary?.profitToday?.toFixed(2) ?? '—'}</Text>
        </Card>
        <Card style={styles.card}>
          <Text variant="caption">Open shifts</Text>
          <Text variant="h2">{summary?.openShifts ?? '—'}</Text>
        </Card>
      </View>
      <Button
        title="Place order"
        onPress={() => navigation.navigate('OrderPortal')}
        style={styles.logout}
      />
      <Button
        title="Receive orders"
        variant="secondary"
        onPress={() => navigation.navigate('ReceiveOrders')}
        style={styles.receive}
      />
      <Button title="Sign out" variant="secondary" onPress={onLogout} style={styles.logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47%', minHeight: 100 },
  receive: { marginTop: 12, marginBottom: 0 },
  logout: { marginTop: 24, marginBottom: 32 },
});
