import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { ApiClient } from '@kiosk/core';
import { Notice, NumberTile, Row } from '../../components/owner-ui';
import { mapLoaded } from '../../lib/loaded';
import type { OwnerAccess } from '../../lib/owner-access';
import { fetchCreditSummary, fetchOrders, fetchPulse, fetchStockCounts } from '../../lib/owner-api';
import { dayBefore, dayWords, type Pulse } from '../../lib/pulse';
import { creditView, ordersView, shiftsView, stockView, takingsView } from '../../lib/today';
import { useLoaded } from '../../lib/use-loaded';
import { GUTTER, MART, SPACE } from '../../theme/mart';
import { Appear, MartText } from '../../theme/mart-ui';

/** The figures are looked at again this often while the screen is open. */
const REFRESH_MS = 60_000;

type Props = {
  api: ApiClient;
  shopName: string;
  branchId: string;
  branchName: string | null;
  /** The shop runs without shifts: there is no count of open tills to show. */
  shiftsDisabled: boolean;
  access: OwnerAccess;
  onOpenTab: (tab: 'Orders' | 'Stock' | 'Credit') => void;
  onReceive: () => void;
};

/**
 * What the owner wants first: today's takings, the tills that are open, web orders waiting for them, stock that needs
 * buying and what customers owe. Every figure is read on its own, so one that cannot be had never hides the others,
 * and a role that may not see a figure is told so on that figure alone.
 */
export function TodayScreen({ api, shopName, branchId, shiftsDisabled, access, onOpenTab, onReceive }: Props) {
  const [pulling, setPulling] = useState(false);

  const pulse = useLoaded<{ today: Pulse; yesterday: Pulse | null }>(
    async () => {
      const today = await fetchPulse(api);
      if (today === null) return null;
      const before = dayBefore(today.date);
      let yesterday: Pulse | null = null;
      if (before !== null) {
        try {
          yesterday = await fetchPulse(api, before);
        } catch {
          // Yesterday is only a comparison. Not having it never takes today's figure away.
          yesterday = null;
        }
      }
      return { today, yesterday };
    },
    REFRESH_MS,
    access.takings
  );
  const orders = useLoaded(() => fetchOrders(api), REFRESH_MS, access.orders);
  const stock = useLoaded(() => fetchStockCounts(api, branchId), REFRESH_MS, access.stock);
  const credit = useLoaded(() => fetchCreditSummary(api), REFRESH_MS, access.credit);

  const pull = async () => {
    setPulling(true);
    try {
      await Promise.all([pulse.reload(), orders.reload(), stock.reload(), credit.reload()]);
    } finally {
      setPulling(false);
    }
  };

  const day = pulse.loaded.state === 'ok' ? dayWords(pulse.loaded.value.today.date) : '';
  const anything = access.takings || access.orders || access.stock || access.credit;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void pull()} />}
    >
      <Appear delay={0} style={{ gap: SPACE.xs }}>
        <MartText variant="meta" color={MART.inkQuiet}>
          {day || 'Today'}
        </MartText>
        <MartText variant="display" numberOfLines={2}>
          {shopName}
        </MartText>
      </Appear>

      {!anything ? (
        <Notice tone="info">Your role does not include any of these figures. Ask the owner of the shop to allow them.</Notice>
      ) : null}

      {access.takings ? (
        <Appear delay={70}>
          <NumberTile wide label="Takings today" state={mapLoaded(pulse.loaded, (p) => takingsView(p.today, p.yesterday))} onRetry={pulse.reload} />
        </Appear>
      ) : null}

      <Appear delay={140} style={styles.grid}>
        {access.takings && !shiftsDisabled ? (
          <NumberTile label="Open tills" state={mapLoaded(pulse.loaded, (p) => shiftsView(p.today))} onRetry={pulse.reload} />
        ) : null}
        {access.orders ? (
          <NumberTile label="Web orders" state={mapLoaded(orders.loaded, ordersView)} onPress={() => onOpenTab('Orders')} onRetry={orders.reload} />
        ) : null}
        {access.stock ? (
          <NumberTile
            label="Stock"
            zoneKey="stock"
            state={mapLoaded(stock.loaded, stockView)}
            onPress={() => onOpenTab('Stock')}
            onRetry={stock.reload}
          />
        ) : null}
        {access.credit ? (
          <NumberTile label="Owed on credit" state={mapLoaded(credit.loaded, creditView)} onPress={() => onOpenTab('Credit')} onRetry={credit.reload} />
        ) : null}
      </Appear>

      {access.receive ? (
        <Appear delay={210} style={{ gap: SPACE.md }}>
          <Row icon="cube-outline" title="Receive a delivery" subtitle="Check a supplier's order in against what arrived" onPress={onReceive} />
        </Appear>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  content: {
    padding: GUTTER,
    paddingBottom: SPACE.xxxl,
    gap: SPACE.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.md,
  },
});
