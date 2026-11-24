import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ApiClient } from '@kiosk/core';
import { fetchOwnerSummary, fetchSalesRegister, type SalesRegisterDay } from '../../api/admin-api';
import { Message, Panel, ScreenHeader, SectionHead, SkeletonRows } from '../../components/owner-ui';
import { kesOrDash, signedCents } from '../../lib/owner-money';
import { useLoaded } from '../../lib/use-loaded';
import { HAIRLINE, MART, RADIUS, SHADOW, SPACE, tint, zoneFor } from '../../theme/mart';
import { Appear, MartText, MiniTile } from '../../theme/mart-ui';

const REFRESH_MS = 120_000;
const DAYS = 10;

type Props = { api: ApiClient };

type Report = {
  days: { label: string; revenueCents: number | null; profitCents: number | null }[];
  totalRevenueCents: number | null;
  totalProfitCents: number | null;
  /** How many items left the shelf over the window. */
  itemsSold: number | null;
  /** The best single day's takings in the window. */
  bestDayCents: number | null;
  /** Profit as a share of revenue, as a whole percent. */
  marginPct: number | null;
  topSkus: { name: string; revenueCents: number | null }[];
};

/** "Mon", "Tue" for a yyyy-mm-dd day, in the shop's week. */
function dayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-KE', { weekday: 'short' }).slice(0, 2);
}

async function load(api: ApiClient): Promise<Report> {
  const [register, summary] = await Promise.all([
    fetchSalesRegister(api, DAYS),
    fetchOwnerSummary(api).catch(() => ({ topSkusLast30Days: [] })),
  ]);
  const rows: SalesRegisterDay[] = register.days ?? [];
  const days = rows.map((d) => ({
    label: dayLabel(d.day),
    revenueCents: signedCents(d.revenue),
    profitCents: signedCents(d.profit),
  }));
  const totalRevenueCents = signedCents(register.totalRevenue) ?? sum(days.map((d) => d.revenueCents));
  const totalProfitCents = signedCents(register.totalProfit) ?? sum(days.map((d) => d.profitCents));
  const itemsSold = rows.length ? rows.reduce((n, d) => n + (typeof d.qty === 'number' && d.qty > 0 ? Math.round(d.qty) : 0), 0) : null;
  const bestDayCents = days.length ? Math.max(0, ...days.map((d) => d.revenueCents ?? 0)) : null;
  const marginPct =
    totalRevenueCents !== null && totalRevenueCents > 0 && totalProfitCents !== null
      ? Math.round((totalProfitCents / totalRevenueCents) * 100)
      : null;
  return {
    days,
    totalRevenueCents,
    totalProfitCents,
    itemsSold,
    bestDayCents,
    marginPct,
    topSkus: (summary.topSkusLast30Days ?? [])
      .slice(0, 5)
      .map((s) => ({ name: (s.itemName ?? 'Item').trim(), revenueCents: signedCents(s.revenueLast30Days) })),
  };
}

function sum(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

/** The shop's last ten days: what it took and what it kept, a day at a time, and its best sellers. */
export function OwnerReportsScreen({ api }: Props) {
  const report = useLoaded(() => load(api), REFRESH_MS);
  const loaded = report.loaded;
  const brand = MART.fallbackPrimary;

  const head = (
    <Appear delay={0} style={{ paddingBottom: SPACE.lg }}>
      <ScreenHeader eyebrow="Last 10 days" title="Reports" />
    </Appear>
  );

  if (loaded.state === 'loading') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {head}
        <View style={styles.heroSkeleton} />
        <SkeletonRows count={3} />
      </ScrollView>
    );
  }

  if (loaded.state === 'denied' || loaded.state === 'failed') {
    return (
      <View style={styles.screen}>
        <View style={{ padding: SPACE.xl }}>{head}</View>
        <Message
          icon={loaded.state === 'denied' ? 'lock-closed-outline' : 'cloud-offline-outline'}
          title={loaded.state === 'denied' ? 'Not allowed' : 'Could not load reports'}
          body={loaded.words}
          {...(loaded.state === 'failed' ? { action: { label: 'Try again', onPress: () => void report.reload() } } : {})}
        />
      </View>
    );
  }

  const r = loaded.value;
  const maxRev = Math.max(1, ...r.days.map((d) => d.revenueCents ?? 0));
  const maxSku = Math.max(1, ...r.topSkus.map((s) => s.revenueCents ?? 0));
  const hasSales = r.days.some((d) => (d.revenueCents ?? 0) > 0);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={report.refreshing} onRefresh={() => void report.refresh()} />}
    >
      {head}

      {/* The headline: money in over the window, on a clean white card. */}
      <Appear delay={70} style={styles.hero}>
        <View style={styles.heroHead}>
          <View style={styles.heroHeadLeft}>
            <View style={[styles.heroMark, { backgroundColor: tint(brand, 0.1) }]}>
              <Ionicons name="bar-chart-outline" size={16} color={brand} />
            </View>
            <MartText variant="shelf" color={MART.inkQuiet}>
              REVENUE · 10 DAYS
            </MartText>
          </View>
        </View>
        <MartText variant="display" color={MART.ink} numberOfLines={1} adjustsFontSizeToFit style={styles.heroValue}>
          {kesOrDash(r.totalRevenueCents)}
        </MartText>

        {/* The daily bars, drawn from Views so no native chart module is needed. With no sales in the window there is
            nothing to plot, so a quiet line stands in rather than a row of invisible stubs leaving a void. */}
        {hasSales ? (
          <View style={styles.chart}>
            {r.days.map((d, i) => {
              const h = Math.max(4, Math.round(((d.revenueCents ?? 0) / maxRev) * 64));
              const last = i === r.days.length - 1;
              return (
                <View key={i} style={styles.chartCol}>
                  <View style={[styles.bar, { height: h, backgroundColor: last ? brand : tint(brand, 0.18) }]} />
                  <MartText variant="shelf" color={MART.inkQuiet} style={styles.barLabel}>
                    {d.label}
                  </MartText>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.chartEmpty}>
            <Ionicons name="pulse-outline" size={18} color={MART.inkQuiet} />
            <MartText variant="meta" color={MART.inkQuiet}>
              No sales in the last 10 days yet.
            </MartText>
          </View>
        )}

        <View style={[styles.heroProfit, { borderTopColor: MART.border }]}>
          <MartText variant="meta" color={MART.inkMuted}>
            Profit kept
          </MartText>
          <MartText variant="heading" color={MART.ink}>
            {kesOrDash(r.totalProfitCents)}
          </MartText>
        </View>
      </Appear>

      <Appear delay={120} style={styles.stats}>
        <View style={styles.statCell}>
          <MiniTile icon="bag-handle-outline" label="Items sold" value={r.itemsSold === null ? '—' : String(r.itemsSold)} accent={zoneFor('items')} />
        </View>
        <View style={styles.statCell}>
          <MiniTile icon="trophy-outline" label="Best day" value={kesOrDash(r.bestDayCents)} accent={zoneFor('best')} />
        </View>
        <View style={styles.statCell}>
          <MiniTile icon="pie-chart-outline" label="Margin" value={r.marginPct === null ? '—' : `${r.marginPct}%`} accent={zoneFor('margin')} />
        </View>
      </Appear>

      {r.topSkus.length > 0 ? (
        <Appear delay={160} style={{ gap: SPACE.md }}>
          <SectionHead>Best sellers</SectionHead>
          <Panel style={{ gap: SPACE.lg }}>
            {r.topSkus.map((s, i) => {
              const accent = zoneFor(s.name);
              const w = Math.max(6, Math.round(((s.revenueCents ?? 0) / maxSku) * 100));
              return (
                <View key={`${s.name}-${i}`} style={{ gap: SPACE.sm }}>
                  <View style={styles.skuRow}>
                    <MartText variant="label" numberOfLines={1} style={{ flex: 1 }}>
                      {i + 1}. {s.name}
                    </MartText>
                    <MartText variant="price">{kesOrDash(s.revenueCents)}</MartText>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.trackFill, { width: `${w}%`, backgroundColor: accent }]} />
                  </View>
                </View>
              );
            })}
          </Panel>
          <MartText variant="meta" color={MART.inkQuiet} style={{ marginLeft: SPACE.xs }}>
            Revenue over the last 30 days.
          </MartText>
        </Appear>
      ) : null}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper },
  content: { padding: SPACE.xl, paddingBottom: SPACE.xxxl, gap: SPACE.lg },
  heroSkeleton: {
    height: 230,
    borderRadius: RADIUS.xl,
    backgroundColor: MART.paperSunken,
  },
  hero: {
    padding: SPACE.xl,
    borderRadius: RADIUS.xl,
    gap: SPACE.lg,
    backgroundColor: MART.paperElevated,
    ...HAIRLINE,
    ...SHADOW.card,
  },
  heroHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md },
  heroHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexShrink: 1 },
  heroMark: { width: 32, height: 32, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  heroValue: { fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: SPACE.xs,
    height: 92,
    paddingTop: SPACE.sm,
  },
  chartCol: { flex: 1, alignItems: 'center', gap: SPACE.xs, justifyContent: 'flex-end' },
  bar: { width: '68%', borderRadius: RADIUS.sm, minHeight: 4 },
  barLabel: { fontSize: 10 },
  chartEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.md,
  },
  heroProfit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACE.md,
    borderTopWidth: 1,
  },
  stats: { flexDirection: 'row', gap: SPACE.sm },
  statCell: { flex: 1, minWidth: 0 },
  skuRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  track: { height: 8, borderRadius: RADIUS.pill, backgroundColor: MART.paperSunken, overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: RADIUS.pill },
});
