import React, { useCallback, useState } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiClient } from '@kiosk/core';
import { fetchFinancePulse, fetchInventoryReport, fetchSalesReport } from '../api/admin-api';
import { MART, GUTTER, SPACE } from '../theme/mart';
import { MartText, Screen, Tile } from '../theme/mart-ui';

function ReportTile({ title, data }: { title: string; data: unknown }) {
  return (
    <Tile style={styles.card}>
      <MartText variant="heading" style={styles.cardTitle}>
        {title}
      </MartText>
      <MartText variant="meta" color={MART.inkQuiet}>
        {data ? JSON.stringify(data, null, 2).slice(0, 500) : 'Loading…'}
      </MartText>
    </Tile>
  );
}

export function AnalyticsScreen({ api }: { api: ApiClient }) {
  const [sales, setSales] = useState<unknown>(null);
  const [inventory, setInventory] = useState<unknown>(null);
  const [pulse, setPulse] = useState<unknown>(null);
  const insets = useSafeAreaInsets();

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
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xxl }]}
      >
        <MartText variant="display" style={styles.heading}>
          Reports
        </MartText>
        <ReportTile title="Sales report" data={sales} />
        <ReportTile title="Inventory report" data={inventory} />
        <ReportTile title="Finance pulse" data={pulse} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xl,
    gap: SPACE.sm,
  },
  heading: {
    marginBottom: SPACE.md,
  },
  card: {
    gap: SPACE.sm,
  },
  cardTitle: {
    marginBottom: SPACE.xs,
  },
});
