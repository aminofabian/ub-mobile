import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatKes, formatQty, itemLabel, readFailureWords, type StockItem } from '@kiosk/core';
import { fetchFreshItem, GUTTER, MartText, MART, RADIUS, SPACE, tint, onFill, zoneFor } from '@kiosk/staff';
import { useStockSession } from '../lib/session';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'Item'>;

type Loaded = { state: 'loading' } | { state: 'failed'; words: string } | { state: 'ready'; item: StockItem };

/**
 * One item as it stands now: its mark, the count on this shelf, and the two things a stockkeeper can do about it.
 *
 * Read again every time the screen comes back, so a change made on another phone shows here at once.
 */
export function ItemScreen({ navigation, route }: Props) {
  const { api, branchId, mayWrite } = useStockSession();
  const { itemId } = route.params;
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        try {
          const item = await fetchFreshItem(api, branchId, itemId);
          if (!live) return;
          setLoaded(item ? { state: 'ready', item } : { state: 'failed', words: 'The server sent something the app could not read.' });
        } catch (error) {
          if (live) setLoaded({ state: 'failed', words: readFailureWords(error) });
        }
      })();
      return () => {
        live = false;
      };
    }, [api, branchId, itemId, attempt])
  );

  if (loaded.state === 'loading') {
    return (
      <View style={styles.center}>
        <MartText variant="meta" color={MART.inkQuiet}>
          Reading this item…
        </MartText>
      </View>
    );
  }

  if (loaded.state === 'failed') {
    return (
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, styles.problem]}>
          <Ionicons name="alert-circle-outline" size={16} color={MART.danger} />
          <MartText variant="meta" color={MART.danger} style={styles.problemText}>
            {loaded.words}
          </MartText>
        </View>
        <Pressable
          onPress={() => {
            setLoaded({ state: 'loading' });
            setAttempt((n) => n + 1);
          }}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
            Try again
          </MartText>
        </Pressable>
      </ScrollView>
    );
  }

  const { item } = loaded;
  const out = item.onHandUnits !== null && item.onHandUnits <= 0;
  const initials =
    (item.name.trim().split(/\s+/)[0]?.[0] ?? '?').toUpperCase() +
    (item.name.trim().split(/\s+/)[1]?.[0] ?? '').toUpperCase();

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {/* What it is, and how much of it is here: the two facts a stockkeeper came for. */}
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={[styles.mark, { backgroundColor: tint(zoneFor(item.name), 0.18) }]}>
            <MartText variant="label" color={tint(MART.ink, 0.66)}>
              {initials}
            </MartText>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <MartText variant="title" numberOfLines={2}>
              {itemLabel(item)}
            </MartText>
            <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
              {[item.sku, item.weighed ? 'sold by weight' : null].filter(Boolean).join(' · ') || 'No code'}
            </MartText>
          </View>
        </View>

        <View style={styles.countBlock}>
          <MartText variant="shelf" color={MART.inkQuiet} style={styles.eyebrow}>
            ON THIS SHELF
          </MartText>
          <MartText variant="display" color={out ? MART.danger : MART.ink}>
            {item.onHandUnits === null ? '—' : formatQty(item.onHandUnits)}
          </MartText>
          {item.onHandUnits === null ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              The server did not say how many there are.
            </MartText>
          ) : out ? (
            <MartText variant="meta" color={MART.danger}>
              Nothing on the shelf. It still sells if the shop allows it.
            </MartText>
          ) : null}
        </View>
      </View>

      {!item.active || !item.sellable ? (
        <View style={[styles.card, styles.note]}>
          <Ionicons name="information-circle-outline" size={16} color={MART.warning} />
          <MartText variant="meta" color={MART.warning} style={styles.problemText}>
            This item is not for sale at the moment.
          </MartText>
        </View>
      ) : null}

      {item.sellingCents !== null || item.barcode ? (
        <View style={styles.card}>
          {item.sellingCents !== null ? <Fact label="Selling price" value={formatKes(item.sellingCents)} /> : null}
          {item.barcode ? <Fact label="Barcode" value={item.barcode} /> : null}
          <Fact label="Sold by" value={item.weighed ? `weight${item.unitType ? ` (${item.unitType})` : ''}` : 'the piece'} />
        </View>
      ) : null}

      {mayWrite ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => navigation.navigate('SetStock', { itemId: item.id })}
            disabled={item.packageVariant}
            style={({ pressed }) => [styles.primary, item.packageVariant && styles.off, pressed && styles.pressed]}
          >
            <MartText variant="label" color={item.packageVariant ? MART.inkQuiet : onFill(MART.fallbackPrimary).primary}>
              Set stock
            </MartText>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('WriteOff', { item })}
            disabled={item.packageVariant}
            style={({ pressed }) => [styles.secondary, item.packageVariant && styles.off, pressed && styles.pressed]}
          >
            <MartText variant="label" color={item.packageVariant ? MART.inkQuiet : MART.ink}>
              Write off
            </MartText>
          </Pressable>
          {item.packageVariant ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              This is a pack. Change the stock of its main item instead.
            </MartText>
          ) : null}
        </View>
      ) : null}

    </ScrollView>
  );
}

/** One line of fact: what it is called, and what it is. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <MartText variant="meta" color={MART.inkQuiet}>
        {label}
      </MartText>
      <MartText variant="label" numberOfLines={1} style={styles.factValue}>
        {value}
      </MartText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: GUTTER, gap: SPACE.md, paddingBottom: SPACE.xxxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: MART.paper },
  card: {
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  mark: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  countBlock: { gap: 2, paddingTop: SPACE.xs },
  eyebrow: { letterSpacing: 1.1 },
  fact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm, paddingVertical: 3 },
  factValue: { flexShrink: 1, textAlign: 'right' },
  note: { flexDirection: 'row', alignItems: 'center', backgroundColor: tint(MART.warning, 0.08) },
  problem: { flexDirection: 'row', alignItems: 'center', backgroundColor: tint(MART.danger, 0.06) },
  problemText: { flex: 1 },
  actions: { gap: SPACE.sm },
  primary: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
  },
  secondary: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.borderStrong,
  },
  off: { backgroundColor: tint(MART.fallbackPrimary, 0.35), borderColor: MART.border },
  pressed: { opacity: 0.85 },
});
