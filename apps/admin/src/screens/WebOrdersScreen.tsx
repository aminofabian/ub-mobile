import React, { useCallback, useState } from 'react';
import { StyleSheet, View, FlatList, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiClient } from '@kiosk/core';
import { fetchWebOrders, updateOrderStatus, type WebOrder } from '../api/admin-api';
import { MART, GUTTER, RADIUS, SPACE, TYPE, tint, zoneFor } from '../theme/mart';
import { MartButton, MartText, Screen, Tile } from '../theme/mart-ui';

const money = (value: number | null | undefined) =>
  value == null ? '—' : `KSh ${value.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;

function StatusChip({ status }: { status: string }) {
  const accent = zoneFor(status);
  return (
    <View style={[styles.chip, { backgroundColor: tint(accent, 0.18) }]}>
      <View style={[styles.chipDot, { backgroundColor: accent }]} />
      <MartText variant="shelf" color={MART.inkMuted}>
        {status.toUpperCase()}
      </MartText>
    </View>
  );
}

export function WebOrdersScreen({ api }: { api: ApiClient }) {
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const insets = useSafeAreaInsets();

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
    <Screen>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        onRefresh={load}
        refreshing={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xxl }]}
        renderItem={({ item }) => (
          <Tile style={styles.card}>
            <View style={styles.cardTop}>
              <MartText variant="heading" style={styles.name}>
                {item.customerName ?? item.id}
              </MartText>
              <StatusChip status={item.status ?? 'NEW'} />
            </View>
            <MartText variant="price" style={styles.total}>
              {money(item.grandTotal)}
            </MartText>
            <View style={styles.actions}>
              <MartButton
                label="Preparing"
                kind="quiet"
                style={[styles.action, styles.actionSoft]}
                onPress={() => setStatus(item.id, 'PREPARING')}
              />
              <MartButton
                label="Ready"
                style={styles.action}
                onPress={() => setStatus(item.id, 'READY')}
              />
              <MartButton
                label="Delivered"
                kind="quiet"
                style={[styles.action, styles.actionSoft]}
                onPress={() => setStatus(item.id, 'DELIVERED')}
              />
            </View>
          </Tile>
        )}
        ListEmptyComponent={
          <MartText variant="body" color={MART.inkQuiet} style={styles.empty}>
            No web orders yet.
          </MartText>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xl,
    gap: SPACE.sm,
  },
  card: {
    gap: SPACE.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.sm,
  },
  name: {
    flex: 1,
  },
  total: {
    ...TYPE.title,
    color: MART.ink,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: RADIUS.pill,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
    marginTop: SPACE.xs,
  },
  action: {
    flexGrow: 1,
    flexBasis: '28%',
    minHeight: 44,
    paddingHorizontal: SPACE.md,
  },
  actionSoft: {
    backgroundColor: MART.paperSunken,
  },
  empty: {
    marginTop: SPACE.xxl,
    textAlign: 'center',
  },
});
