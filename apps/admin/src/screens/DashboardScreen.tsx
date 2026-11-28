import React, { useCallback, useState } from 'react';
import { StyleSheet, View, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ApiClient } from '@kiosk/core';
import {
  fetchOwnerSummary,
  fetchSalesRegister,
  type OwnerSummary,
  type SalesRegister,
} from '../api/admin-api';
import type { AdminStackParamList } from '../navigation/AppNavigator';
import { MART, GUTTER, SPACE, ZONE } from '../theme/mart';
import {
  HeroMetric,
  MartButton,
  MartText,
  MiniTile,
  Screen,
  SectionHead,
} from '../theme/mart-ui';

interface Props {
  api: ApiClient;
  branchId: string;
  onLogout: () => void;
}

const money = (value: number | null | undefined) =>
  value == null ? '—' : `KSh ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

/** Percentage change of the last day vs the one before it, as a signed label. */
function trendFrom(series: number[]): { delta: string; up: boolean } | null {
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  if (prev <= 0) return null;
  const pct = ((last - prev) / prev) * 100;
  if (!Number.isFinite(pct)) return null;
  return { delta: `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`, up: pct >= 0 };
}

export function DashboardScreen({ api, branchId, onLogout }: Props) {
  const [summary, setSummary] = useState<OwnerSummary | null>(null);
  const [register, setRegister] = useState<SalesRegister | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList>>();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [sum, reg] = await Promise.all([
        fetchOwnerSummary(api).catch(() => null),
        fetchSalesRegister(api, 10).catch(() => null),
      ]);
      if (sum) setSummary(sum);
      if (reg) setRegister(reg);
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const pulse = summary?.pulseToday;
  const revenueSeries = (register?.days ?? [])
    .map((d) => d.revenue ?? 0)
    .filter((n) => Number.isFinite(n));
  const trend = trendFrom(revenueSeries);
  const avgOrder =
    pulse?.salesCount && pulse?.revenue ? pulse.revenue / pulse.salesCount : null;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACE.xxxl }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={MART.inkQuiet} />
        }
      >
        <MartText variant="display" style={styles.heading}>
          Business pulse
        </MartText>
        <MartText variant="body" color={MART.inkMuted} style={styles.subhead}>
          How the shop is doing today.
        </MartText>

        <HeroMetric
          label="Revenue today"
          value={money(pulse?.revenue)}
          delta={trend?.delta}
          trendUp={trend?.up ?? true}
          spark={revenueSeries.length >= 2 ? revenueSeries : undefined}
          accent={ZONE.leaf}
        />

        <View style={styles.grid}>
          <MiniTile
            icon="receipt-outline"
            label="Orders today"
            value={`${pulse?.salesCount ?? '—'}`}
            accent={ZONE.pond}
          />
          <MiniTile
            icon="trending-up-outline"
            label="Profit today"
            value={money(pulse?.grossProfit)}
            accent={ZONE.leaf}
          />
          <MiniTile
            icon="people-outline"
            label="Open shifts"
            value={`${pulse?.openShifts ?? '—'}`}
            accent={ZONE.coral}
          />
          <MiniTile
            icon="pricetags-outline"
            label="Avg. order"
            value={money(avgOrder)}
            accent={ZONE.sun}
          />
        </View>

        <View style={styles.actions}>
          <SectionHead>Quick actions</SectionHead>
          <MartButton label="Place order" onPress={() => navigation.navigate('OrderPortal')} />
          <MartButton
            label="Receive orders"
            kind="quiet"
            style={styles.softAction}
            onPress={() => navigation.navigate('ReceiveOrders')}
          />
          <View style={styles.signOutRow}>
            <MartButton label="Sign out" kind="quiet" onPress={onLogout} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xl,
  },
  heading: {
    marginBottom: SPACE.xs,
  },
  subhead: {
    marginBottom: SPACE.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
    marginTop: SPACE.md,
  },
  actions: {
    marginTop: SPACE.xxxl,
    gap: SPACE.sm,
  },
  softAction: {
    backgroundColor: MART.paperSunken,
  },
  signOutRow: {
    marginTop: SPACE.md,
    alignItems: 'center',
  },
});
