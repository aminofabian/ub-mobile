import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { ApiClient } from '@kiosk/core';
import { Notice, NumberTile, RecentSalesFeed, Row, SectionHead } from '../../components/owner-ui';
import { mapLoaded } from '../../lib/loaded';
import type { OwnerAccess } from '../../lib/owner-access';
import { fetchBreakdown, fetchCreditSummary, fetchOrders, fetchPulse, fetchStockCounts, fetchSupplierBills } from '../../lib/owner-api';
import { fetchRecentSales } from '../../lib/sales-intelligence';
import { kesOrDash } from '../../lib/owner-money';
import { onLiveRefresh } from '../../lib/live-refresh';
import type { Breakdown } from '../../lib/payments';
import { dayBefore, dayWords, type Pulse } from '../../lib/pulse';
import { breakdownLines, creditView, ordersView, shiftsView, stockView, suppliersView, takingsView } from '../../lib/today';
import { useLoaded } from '../../lib/use-loaded';
import { GUTTER, MART, SPACE } from '../../theme/mart';
import { Appear, MartText } from '../../theme/mart-ui';

/** The figures are looked at again this often while the screen is open. */
const REFRESH_MS = 60_000;
/** The recent-sales feed is read more often than the figures, so new sales show up quickly. */
const FEED_REFRESH_MS = 20_000;

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

  const pulse = useLoaded<{ today: Pulse; yesterday: Pulse | null; breakdown: Breakdown | null }>(
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
      let breakdown: Breakdown | null = null;
      try {
        breakdown = await fetchBreakdown(api, today.date);
      } catch {
        // The split is an extra; a figure for takings never waits on it.
        breakdown = null;
      }
      return { today, yesterday, breakdown };
    },
    REFRESH_MS,
    access.takings
  );
  const orders = useLoaded(() => fetchOrders(api), REFRESH_MS, access.orders);
  const stock = useLoaded(() => fetchStockCounts(api, branchId), REFRESH_MS, access.stock);
  const credit = useLoaded(() => fetchCreditSummary(api), REFRESH_MS, access.credit);
  const bills = useLoaded(() => fetchSupplierBills(api), REFRESH_MS, access.receive);
  // The sales tape is the closest thing to live: it is read more often than the figures above.
  const recent = useLoaded(() => fetchRecentSales(api), FEED_REFRESH_MS, access.takings);

  const pull = async () => {
    setPulling(true);
    try {
      await Promise.all([pulse.reload(), orders.reload(), stock.reload(), credit.reload(), bills.reload(), recent.reload()]);
    } finally {
      setPulling(false);
    }
  };

  // Live: when a sale or a supplier change arrives over the WebSocket, re-read just the figures it touches,
  // so takings, the sales feed and what is owed to suppliers update without waiting for the next poll.
  useEffect(
    () =>
      onLiveRefresh((topic) => {
        if (topic === 'sales') {
          if (access.takings) {
            void pulse.reload();
            void recent.reload();
          }
        } else if (topic === 'suppliers') {
          if (access.receive) void bills.reload();
        }
      }),
    // The loaders' reload identities are stable for a given screen instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [access.takings, access.receive]
  );

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
          <NumberTile
            wide
            label="Takings today"
            state={mapLoaded(pulse.loaded, (p) => ({ ...takingsView(p.today, p.yesterday), breakdown: breakdownLines(p.breakdown) }))}
            onRetry={pulse.reload}
          />
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
        {access.receive ? (
          <NumberTile label="Owed to suppliers" zoneKey="suppliers" state={mapLoaded(bills.loaded, suppliersView)} onRetry={bills.reload} />
        ) : null}
      </Appear>

      {access.takings && recent.loaded.state === 'ok' ? (
        <Appear delay={210} style={{ gap: SPACE.md }}>
          <SectionHead>Recent sales</SectionHead>
          <RecentSalesFeed
            sales={recent.loaded.value.map((s) => ({
              id: s.id,
              soldAt: s.soldAt,
              itemName: s.itemName,
              quantity: s.quantity,
              amount: kesOrDash(s.totalCents),
              cashierName: s.cashierName,
              method: s.method,
            }))}
          />
        </Appear>
      ) : null}

      {access.receive ? (
        <Appear delay={280} style={{ gap: SPACE.md }}>
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
