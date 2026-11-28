import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  GUTTER,
  MART,
  RADIUS,
  SPACE,
  tint,
  useKept,
  MartText,
  onFill,
  zoneFor,
} from '@kiosk/staff';
import { fetchItemCounts } from '../api/stock-api';
import { useStockSession } from '../lib/session';
import { heldBy, progressOf } from '../lib/stock-take';
import { heldWords, signOutWords } from '../lib/take-words';
import { takeKeeperFor, unsentCount } from '../lib/take-store';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'Dashboard'>;

type Counts = { low: number | null; out: number | null };

type Action = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  tone?: 'warn' | 'danger';
};

/** One tappable action: an icon in a soft zone-tinted chip, a title, a quiet subtitle, a chevron. */
function ActionRow({ action, first }: { action: Action; first: boolean }) {
  const accent =
    action.tone === 'danger' ? MART.danger : action.tone === 'warn' ? MART.warning : zoneFor(action.key);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${action.title}. ${action.subtitle}`}
      onPress={action.onPress}
      style={({ pressed }) => [styles.action, !first && styles.actionRule, pressed && styles.actionPressed]}
    >
      <View style={[styles.actionIcon, { backgroundColor: tint(accent, 0.16) }]}>
        <Ionicons name={action.icon} size={18} color={accent} />
      </View>
      <View style={styles.actionBody}>
        <MartText variant="heading" numberOfLines={1}>
          {action.title}
        </MartText>
        <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
          {action.subtitle}
        </MartText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={MART.inkQuiet} />
    </Pressable>
  );
}

/** A metric tile: a label, a big number, a quiet caption, a zone dot. Taps through to the matching item list. */
function CountTile({
  label,
  value,
  caption,
  zoneKey,
  tone,
  onPress,
}: {
  label: string;
  value: string;
  caption: string;
  zoneKey: string;
  tone: 'normal' | 'warn' | 'danger';
  onPress: () => void;
}) {
  const accent = tone === 'danger' ? MART.danger : tone === 'warn' ? MART.warning : zoneFor(zoneKey);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.countTile, pressed && styles.actionPressed]}
    >
      <View style={styles.countHead}>
        <View style={[styles.countDot, { backgroundColor: accent }]} />
        <MartText variant="shelf" color={MART.inkQuiet} numberOfLines={1} style={{ flex: 1 }}>
          {label.toUpperCase()}
        </MartText>
      </View>
      <View style={styles.countFigures}>
        <MartText variant="title" style={styles.countValue}>
          {value}
        </MartText>
        <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1} style={{ flex: 1 }}>
          {caption}
        </MartText>
      </View>
    </Pressable>
  );
}

/** The same job as a row, as a tile: icon, title, one quiet line — two to a row, so the shelf of jobs reads at a glance. */
function ActionTile({ action }: { action: Action }) {
  const accent =
    action.tone === 'danger' ? MART.danger : action.tone === 'warn' ? MART.warning : zoneFor(action.key);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${action.title}. ${action.subtitle}`}
      onPress={action.onPress}
      style={({ pressed }) => [styles.actionTile, pressed && styles.actionPressed]}
    >
      <View style={[styles.actionIcon, { backgroundColor: tint(accent, 0.16) }]}>
        <Ionicons name={action.icon} size={18} color={accent} />
      </View>
      <MartText variant="label" numberOfLines={2} style={styles.actionTitle}>
        {action.title}
      </MartText>
    </Pressable>
  );
}

/** The two letters that stand for the shop, as the plaque shows them elsewhere. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? 'S') + (words[1]?.[0] ?? words[0]?.[1] ?? '')).toUpperCase();
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <MartText variant="shelf" color={MART.inkQuiet} style={styles.sectionLabel}>
      {children}
    </MartText>
  );
}

export function DashboardScreen({ navigation }: Props) {
  const { api, branchId, branchName, tenantId, userId, shopName, signOut, mayWrite, mayCount, mayClose, mayMove } =
    useStockSession();
  const keeper = useMemo(() => takeKeeperFor(tenantId), [tenantId]);
  const kept = useKept(keeper);
  const [counts, setCounts] = useState<Counts | null>(null);

  // Read again each time the screen comes back into view: stock changes while the person works elsewhere in the app.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      void fetchItemCounts(api, branchId).then((result) => {
        if (live) setCounts(result);
      });
      return () => {
        live = false;
      };
    }, [api, branchId])
  );

  const copy = kept.ready ? kept.value : null;
  const held = heldBy(copy, branchId, userId);
  const unsent = held ? 0 : unsentCount(copy);
  const mine = copy && copy.take.branchId === branchId && copy.take.open ? copy : null;
  const progress = mine ? progressOf(mine) : null;
  const takeWords = progress
    ? `${progress.counted} of ${progress.total} counted${progress.unsent > 0 && !held ? ` · ${progress.unsent} not sent` : ''}`
    : 'The quick daily count';

  const confirmSignOut = useCallback(() => {
    if (unsent === 0) {
      void signOut();
      return;
    }
    Alert.alert('Counts not sent', signOutWords(unsent), [
      { text: 'Stay signed in', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }, [unsent, signOut]);

  const lowCount = counts?.low ?? null;
  const outCount = counts?.out ?? null;

  const countActions: Action[] = [];
  if (mayCount || mayClose) {
    countActions.push({
      key: 'full-count',
      icon: 'albums-outline',
      title: 'Full count',
      subtitle: 'Count the whole shop, a batch at a time',
      onPress: () => openCount('FullCount'),
    });
    countActions.push({
      key: 'stock-take',
      icon: 'clipboard-outline',
      title: 'Stock take',
      subtitle: takeWords,
      onPress: () => openCount('StockTake'),
    });
  }
  if (mayWrite) {
    countActions.push({
      key: 'set-stock',
      icon: 'create-outline',
      title: 'Set stock',
      subtitle: 'Say how many are on the shelf',
      onPress: () => navigation.navigate('SetStock'),
    });
    countActions.push({
      key: 'write-off',
      icon: 'trash-outline',
      title: 'Write off',
      subtitle: 'Spoiled, expired or broken stock',
      onPress: () => navigation.navigate('WriteOff'),
    });
  }
  if (mayMove) {
    countActions.push({
      key: 'transfers',
      icon: 'swap-horizontal-outline',
      title: 'Transfers',
      subtitle: 'Stock moving between branches',
      onPress: () => goTo('TransfersTab'),
    });
  }
  countActions.push({
    key: 'supply-batches',
    icon: 'cube-outline',
    title: 'Supply batches',
    subtitle: 'What came in, and what is left',
    onPress: () => goTo('DeliveriesTab'),
  });

  const supplierActions: Action[] = [
    {
      key: 'orders',
      icon: 'storefront-outline',
      title: 'Order portal',
      subtitle: 'Order from suppliers',
      onPress: () => goTo('DeliveriesTab'),
    },
    {
      key: 'receive',
      icon: 'download-outline',
      title: 'Receive orders',
      subtitle: 'Check a delivery in',
      onPress: () => goTo('DeliveriesTab'),
    },
  ];

  const onBrand = onFill(MART.fallbackPrimary);

  /** The room behind a job, when that job lives in another tab. */
  const goTo = (tab: 'ItemsTab' | 'DeliveriesTab' | 'TransfersTab') =>
    (navigation.getParent() as unknown as { navigate: (name: string) => void } | undefined)?.navigate(tab);

  const openCount = (screen: 'StockTake' | 'FullCount') =>
    (navigation.getParent() as unknown as { navigate: (name: string, params: { screen: string }) => void } | undefined)?.navigate(
      'CountTab',
      { screen }
    );

  /** Low and out together: the one number that says whether this shelf needs a walk today. */
  const attention =
    lowCount === null || outCount === null ? null : lowCount + outCount;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* The head: which shelf this is, and the one figure worth acting on. */}
      <View style={styles.hero}>
        <View style={styles.heroRings} pointerEvents="none">
          <View style={[styles.ring, styles.ringOuter]} />
          <View style={[styles.ring, styles.ringInner]} />
        </View>
        <View style={styles.heroTop}>
          <View style={styles.heroPlaque}>
            <MartText variant="label" color={MART.fallbackPrimaryLift}>
              {initialsOf(shopName ?? 'Stock')}
            </MartText>
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <MartText variant="shelf" color={onBrand.secondary} style={styles.heroEyebrow}>
              {branchName ? `STOCK · ${branchName.toUpperCase()}` : 'STOCK'}
            </MartText>
            <MartText variant="title" color={onBrand.primary} numberOfLines={1}>
              {shopName ?? 'Your shop'}
            </MartText>
          </View>
        </View>
        <View style={styles.heroFigures}>
          <MartText variant="display" color={onBrand.primary} style={styles.heroCount}>
            {attention}
          </MartText>
          <MartText variant="meta" color={onBrand.secondary} style={styles.heroWords}>
            {attention === null
              ? 'reading the shelf…'
              : attention === 0
                ? 'nothing needs attention'
                : `${attention === 1 ? 'item needs' : 'items need'} attention`}
          </MartText>
        </View>
      </View>

      {held ? (
        <View style={[styles.banner, { backgroundColor: MART.warningSurface }]}>
          <MartText variant="label" color={MART.warning}>
            {heldWords(held, unsentCount(copy)).short}
          </MartText>
        </View>
      ) : null}
      {unsent > 0 ? (
        <View style={[styles.banner, { backgroundColor: MART.warningSurface }]}>
          <MartText variant="label" color={MART.warning}>
            {`${unsent} ${unsent === 1 ? 'count is' : 'counts are'} waiting to be sent. Open Stock take with a signal to send ${unsent === 1 ? 'it' : 'them'}.`}
          </MartText>
        </View>
      ) : null}

      {/* Low / out tiles — the attention figure, split into why */}
      <View style={styles.tileRow}>
        <CountTile
          label="Low stock"
          value={lowCount === null ? '—' : String(lowCount)}
          caption="Items running low"
          zoneKey="low"
          tone={lowCount ? 'warn' : 'normal'}
          onPress={() => goTo('ItemsTab')}
        />
        <CountTile
          label="Out of stock"
          value={outCount === null ? '—' : String(outCount)}
          caption="None on the shelf"
          zoneKey="out"
          tone={outCount ? 'danger' : 'normal'}
          onPress={() => goTo('ItemsTab')}
        />
      </View>

      {/* Find an item, and the back room */}
      <View style={styles.card}>
        <ActionRow
          first
          action={{
            key: 'find',
            icon: 'search-outline',
            title: 'Find an item',
            subtitle: 'By name, code or barcode',
            onPress: () => goTo('ItemsTab'),
          }}
        />
        <ActionRow
          first={false}
          action={{
            key: 'store',
            icon: 'archive-outline',
            title: 'Store room',
            subtitle: "What's in the back",
            onPress: () => navigation.navigate('StoreRoom'),
          }}
        />
      </View>

      <SectionLabel>COUNTING & STOCK</SectionLabel>
      <View style={styles.grid}>
        {countActions.map((action) => (
          <ActionTile key={action.key} action={action} />
        ))}
      </View>

      <SectionLabel>SUPPLIERS</SectionLabel>
      <View style={styles.grid}>
        {supplierActions.map((action) => (
          <ActionTile key={action.key} action={action} />
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={confirmSignOut}
        style={({ pressed }) => [styles.signOut, pressed && styles.actionPressed]}
      >
        <MartText variant="label" color={MART.danger}>
          Sign out
        </MartText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper },
  content: { paddingBottom: 96, gap: SPACE.lg },
  hero: {
    backgroundColor: MART.fallbackPrimary,
    paddingHorizontal: GUTTER,
    // Clears the status bar / Dynamic Island (the staff screens use the same fixed inset; no SafeAreaProvider here).
    paddingTop: 62,
    paddingBottom: SPACE.lg,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    gap: SPACE.xs,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  heroPlaque: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paper,
  },
  heroEyebrow: { letterSpacing: 1.1 },
  heroFigures: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.sm, marginTop: SPACE.md },
  heroCount: { letterSpacing: -1 },
  heroWords: { flex: 1 },
  heroRings: { ...StyleSheet.absoluteFillObject, alignItems: 'flex-end' },
  ring: { position: 'absolute', borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.06)' },
  ringOuter: { width: 320, height: 320, top: -140, right: -120 },
  ringInner: { width: 190, height: 190, top: -40, right: -40, backgroundColor: 'rgba(255,255,255,0.05)' },
  heroTitle: { marginTop: SPACE.xxs },
  banner: {
    marginHorizontal: GUTTER,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
  },
  tileRow: {
    flexDirection: 'row',
    gap: SPACE.md,
    paddingHorizontal: GUTTER,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  actionTile: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: SPACE.sm,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  actionTitle: { fontSize: 12.5, lineHeight: 16 },
  countTile: {
    flex: 1,
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    gap: 4,
  },
  countFigures: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.sm },
  countHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  countDot: { width: 8, height: 8, borderRadius: RADIUS.pill },
  countValue: { marginTop: 0 },
  sectionLabel: { paddingHorizontal: GUTTER, marginBottom: -SPACE.sm, marginTop: SPACE.xs },
  card: {
    marginHorizontal: GUTTER,
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    overflow: 'hidden',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
  },
  actionRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: MART.border },
  actionPressed: { opacity: 0.6 },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBody: { flex: 1, gap: 1 },
  signOut: {
    marginHorizontal: GUTTER,
    marginTop: SPACE.sm,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.border,
    alignItems: 'center',
  },
});
