import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ApiClient } from '@kiosk/core';
import { formatKes, formatQty, itemLabel, readFailureWords, type StockItem } from '@kiosk/core';
import { fetchFreshItem, MartText, MART, RADIUS, SPACE, tint, onFill, zoneFor } from '@kiosk/staff';

type Loaded =
  | { state: 'loading' }
  | { state: 'failed'; words: string }
  | { state: 'ready'; item: StockItem };

type Props = {
  api: ApiClient;
  branchId: string;
  itemId: string;
  mayWrite: boolean;
  onSetStock: (item: StockItem) => void;
  onWriteOff: (item: StockItem) => void;
};

/**
 * One item, laid over the shelf it came from.
 *
 * This is what the list opens: the product's own mark, what the shelf holds, and the two things that can be done to it.
 * Deliberately not a page — the list stays visible above it, so the next item is a swipe away.
 */
export function ItemDrawer({ api, branchId, itemId, mayWrite, onSetStock, onWriteOff }: Props) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });

  useEffect(() => {
    let live = true;
    setLoaded({ state: 'loading' });
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
  }, [api, branchId, itemId]);

  if (loaded.state === 'loading') {
    return (
      <MartText variant="meta" color={MART.inkQuiet} style={styles.waiting}>
        Reading this item…
      </MartText>
    );
  }

  if (loaded.state === 'failed') {
    return (
      <View style={[styles.note, { backgroundColor: tint(MART.danger, 0.08) }]}>
        <Ionicons name="alert-circle" size={15} color={MART.danger} />
        <MartText variant="meta" color={MART.danger} style={{ flex: 1 }}>
          {loaded.words}
        </MartText>
      </View>
    );
  }

  const item = loaded.item;
  const zone = zoneFor(item.name);
  const initials = (itemLabel(item).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('') || '?').toUpperCase();

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.head}>
        <View style={[styles.mark, { backgroundColor: tint(zone, 0.18) }]}>
          <MartText variant="label" color={tint(MART.ink, 0.66)}>
            {initials}
          </MartText>
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <MartText variant="title" numberOfLines={2}>
            {itemLabel(item)}
          </MartText>
          <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
            {item.sku ?? 'No code'}
          </MartText>
        </View>
      </View>

      <View style={styles.shelfCard}>
        <MartText variant="shelf" color={MART.inkQuiet} style={styles.eyebrow}>
          ON THE SHELF
        </MartText>
        <View style={styles.shelfFigures}>
          <MartText variant="display">{item.onHandUnits === null ? '—' : formatQty(item.onHandUnits)}</MartText>
          <MartText variant="meta" color={MART.inkQuiet} style={{ flex: 1 }}>
            {item.weighed ? 'sold by weight' : 'in the shop'}
          </MartText>
        </View>
      </View>

      {item.sellingCents !== null || item.barcode ? (
        <View style={styles.facts}>
          {item.sellingCents !== null ? <Fact label="Selling price" value={formatKes(item.sellingCents)} /> : null}
          {item.barcode ? <Fact label="Barcode" value={item.barcode} /> : null}
        </View>
      ) : null}

      {mayWrite ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => onSetStock(item)}
            disabled={item.packageVariant}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, item.packageVariant && styles.off, pressed && styles.pressed]}
          >
            <MartText variant="label" color={item.packageVariant ? MART.inkQuiet : onFill(MART.fallbackPrimary).primary}>
              Set stock
            </MartText>
          </Pressable>
          <Pressable
            onPress={() => onWriteOff(item)}
            disabled={item.packageVariant}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, item.packageVariant && styles.off, pressed && styles.pressed]}
          >
            <MartText variant="label" color={item.packageVariant ? MART.inkQuiet : MART.ink}>
              Write off
            </MartText>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <MartText variant="meta" color={MART.inkQuiet}>
        {label}
      </MartText>
      <MartText variant="meta" numberOfLines={1}>
        {value}
      </MartText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flexGrow: 0 },
  body: { gap: SPACE.sm, paddingBottom: SPACE.sm },
  waiting: { paddingVertical: SPACE.lg, textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  mark: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  shelfCard: {
    gap: 4,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  eyebrow: { letterSpacing: 1.1 },
  shelfFigures: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.sm },
  facts: {
    gap: 2,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md, paddingVertical: 4 },
  actions: { flexDirection: 'row', gap: SPACE.sm, paddingTop: SPACE.xs },
  primary: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: MART.fallbackPrimary },
  secondary: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.borderStrong,
  },
  off: { backgroundColor: tint(MART.ink, 0.06), borderColor: MART.border },
  pressed: { opacity: 0.85 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: RADIUS.md },
});
