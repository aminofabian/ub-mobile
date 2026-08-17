import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from '@kiosk/ui';
import { useTenant } from '../lib/TenantContext';
import { useOrderHistory } from '../hooks/useOrderHistory';
import { AccountAuthPanel } from '../components/AccountAuthPanel';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function formatDate(iso: string) {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${amount.toFixed(2)}`;
}

export function AccountScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<NavigationProp>();
  const { data: orders, isLoading, error, refetch } = useOrderHistory(tenant.slug);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#28a745" />
      </View>
    );
  }

  return (
    <FlatList
      data={orders ?? []}
      keyExtractor={(item) => item.orderId}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      ListHeaderComponent={
        <View>
          <AccountAuthPanel />
          <View style={styles.header}>
            <Text variant="h1">My Orders</Text>
            <Text variant="muted">Recent orders for {tenant.displayName}</Text>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.orderCard}
          onPress={() => navigation.navigate('OrderDetail', { orderId: item.orderId })}
          accessibilityRole="button"
          accessibilityLabel={`Order ${item.orderId}, ${formatCurrency(item.grandTotal, item.currency)}`}
        >
          <View style={styles.orderRow}>
            <Text variant="body" style={styles.orderId}>
              #{item.orderId.slice(-8).toUpperCase()}
            </Text>
            <Text variant="muted">{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.total}>{formatCurrency(item.grandTotal, item.currency)}</Text>
          <Text variant="muted">Tap to track status</Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text variant="body" style={styles.emptyText}>
            No orders yet.
          </Text>
          <Text variant="muted">Completed orders will appear here.</Text>
        </View>
      }
      ListFooterComponent={
        error ? (
          <Text style={styles.error}>
            {error instanceof Error ? error.message : 'Failed to load orders'}
          </Text>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 16,
    paddingTop: 24,
  },
  listContent: {
    paddingBottom: 32,
  },
  orderCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontWeight: '600',
  },
  total: {
    fontSize: 18,
    fontWeight: '700',
    color: '#28a745',
    marginBottom: 4,
  },
  empty: {
    padding: 24,
    alignItems: 'center',
    marginTop: 48,
  },
  emptyText: {
    marginBottom: 8,
  },
  error: {
    color: '#dc3545',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 24,
  },
});
