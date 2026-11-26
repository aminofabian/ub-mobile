import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Text, theme } from '@kiosk/ui';
import { isApiError, type ApiClient } from '@kiosk/core';
import {
  fetchPurchaseOrders,
  fetchSuppliers,
  type PurchaseOrderListRow,
  type SupplierRecord,
} from '../api/purchasing';
import { formatQty, toNum } from '../lib/format';

type Props = {
  api: ApiClient;
  /** Called when the user taps an open purchase order. */
  onOpenOrder: (purchaseOrderId: string) => void;
};

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  sent: { bg: '#e0f2fe', fg: '#0369a1' },
  draft: { bg: '#fef3c7', fg: '#92400e' },
  completed: { bg: '#dcfce7', fg: '#166534' },
  cancelled: { bg: '#fee2e2', fg: '#991b1b' },
};

export function ReceiveScreen({ api, onOpenOrder }: Props) {
  const [orders, setOrders] = useState<PurchaseOrderListRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [loading, setLoading] = useState(true);
  /** Why the last load failed, in words for the person. Null when it worked. */
  const [failed, setFailed] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [sent, draft, supplierRows] = await Promise.all([
        fetchPurchaseOrders(api, { status: 'sent' }),
        fetchPurchaseOrders(api, { status: 'draft' }),
        fetchSuppliers(api),
      ]);
      const open = [...sent, ...draft].filter((o) => toNum(o.totalOrdered) > toNum(o.totalReceived));
      open.sort((a, b) => b.poNumber.localeCompare(a.poNumber));
      setOrders(open);
      setSuppliers(supplierRows);
      setFailed(null);
    } catch (error) {
      // The previous list stays on a failed refresh. A first load that failed is not "no open orders": it says so, and
      // offers to try again, because a person who is told nothing is due does not look any further.
      console.warn('Failed to load orders', error);
      setFailed(
        isApiError(error) && error.status === 403
          ? 'Your role is not allowed to see supplier orders. Ask the owner of the shop to allow it.'
          : 'Could not load the orders. Check the signal and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const supplierName = (supplierId: string) =>
    suppliers.find((s) => s.id === supplierId)?.name ?? 'Supplier';

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : orders.length === 0 && failed ? (
        <View style={styles.center}>
          <Text variant="muted" style={styles.emptyHint}>
            {failed}
          </Text>
          <Button title="Try again" onPress={() => void refresh()} style={styles.retry} />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Text variant="muted">No open orders.</Text>
          <Text variant="muted" style={styles.emptyHint}>
            Place an order first, then confirm here when goods arrive.
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          onRefresh={() => void refresh()}
          refreshing={false}
          ListHeaderComponent={
            failed ? (
              <Text variant="muted" style={styles.staleHint}>
                Could not refresh. These are the last orders read.
              </Text>
            ) : null
          }
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const tone = STATUS_TONE[item.status] ?? { bg: theme.colors.surface, fg: theme.colors.textMuted };
            const remaining = toNum(item.totalOrdered) - toNum(item.totalReceived);
            return (
              <Pressable
                onPress={() => onOpenOrder(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Open order ${item.poNumber}`}
              >
                <Card style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text variant="body" style={styles.poNumber}>
                      {item.poNumber}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                      <Text
                        variant="caption"
                        style={{ ...styles.statusText, color: tone.fg }}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>
                  <Text variant="body">{supplierName(item.supplierId)}</Text>
                  <View style={styles.cardMeta}>
                    <Text variant="muted">{item.lineCount} lines</Text>
                    <Text variant="muted">
                      {formatQty(item.totalOrdered)} ordered · {formatQty(remaining)} to receive
                    </Text>
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyHint: { marginTop: 8, textAlign: 'center' },
  retry: { marginTop: 16 },
  staleHint: { marginBottom: 12 },
  listContent: { padding: 16, paddingBottom: 24 },
  card: { marginBottom: 12 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  poNumber: { fontWeight: '700' },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontWeight: '600', textTransform: 'capitalize' },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, flexWrap: 'wrap', gap: 8 },
});
