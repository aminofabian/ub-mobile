import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ApiClient } from '@kiosk/core';
import { MART, RADIUS, SPACE, tint, MartText } from '@kiosk/staff';
import { fetchItemVariants, type PosItem } from '../api/pos-api';
import { itemWords } from '../lib/item-words';
import type { CartItem } from '../lib/cart';
import { BottomSheet } from './BottomSheet';

/**
 * The size picker for a family product. A cashier taps a parent tile ("Soda", "Sugar") and this
 * sheet lists its sizes/variants with each one's own price and stock, newest server truth. Tapping a
 * size adds it to the basket, the same as tapping a plain product — so a shop with grouped SKUs rings
 * up the right size without the family cluttering the grid as separate tiles. Mirrors the web till's
 * variant picker.
 */
export function VariantPicker({
  api,
  parent,
  onClose,
  onPick,
}: {
  api: ApiClient;
  /** The family parent that was tapped. Null while the sheet is closed. */
  parent: CartItem | null;
  onClose: () => void;
  /** A size was chosen: add it to the basket. */
  onPick: (variant: PosItem) => void;
}) {
  const [variants, setVariants] = useState<PosItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVariants(null);
    setError(null);
    if (!parent) return;
    let alive = true;
    fetchItemVariants(api, parent.id).then(
      (list) => alive && setVariants(list),
      () => {
        if (alive) {
          setVariants([]);
          setError("Couldn't load the sizes. Check the connection and try again.");
        }
      }
    );
    return () => {
      alive = false;
    };
  }, [api, parent]);

  return (
    <BottomSheet visible={parent !== null} onClose={onClose}>
      {parent ? (
          <View style={styles.content}>
            <View style={styles.head}>
              <View style={styles.icon}>
                <Ionicons name="pricetags-outline" size={18} color={MART.fallbackPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <MartText variant="shelf" color={MART.inkQuiet}>
                  PICK A SIZE
                </MartText>
                <MartText variant="heading" numberOfLines={1}>
                  {parent.name}
                </MartText>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.list}>
              {variants === null ? (
                <ActivityIndicator color={MART.fallbackPrimary} style={{ marginVertical: SPACE.xl }} />
              ) : variants.length === 0 ? (
                <MartText variant="meta" color={MART.inkQuiet} style={styles.empty}>
                  {error ?? 'No sizes found for this product.'}
                </MartText>
              ) : (
                variants.map((v) => {
                  const words = itemWords(v);
                  const out = words.stock === 'Out of stock';
                  const blocked = Boolean(words.blocked);
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => onPick(v)}
                      disabled={blocked || out}
                      style={({ pressed }) => [styles.row, (blocked || out) && styles.rowOff, pressed && styles.rowPressed]}
                    >
                      <View style={{ flex: 1 }}>
                        <MartText variant="heading" numberOfLines={1}>
                          {v.name}
                        </MartText>
                        {words.stock ? (
                          <MartText variant="meta" color={words.stockLevel === 'low' ? MART.warning : MART.inkQuiet}>
                            {words.blocked ?? words.stock}
                          </MartText>
                        ) : null}
                      </View>
                      <MartText variant="price" color={words.price === '-' ? MART.inkQuiet : MART.ink}>
                        {words.price === '-' ? '—' : `KES ${words.price}`}
                      </MartText>
                      {!out && !blocked ? (
                        <View style={styles.add}>
                          <Ionicons name="add" size={18} color={MART.fallbackPrimary} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(22,24,15,0.4)', justifyContent: 'flex-end' },
  // A native page sheet fills the card the system hands it; its own scrim, grip and top radius are gone.
  // The shell owns the ground, the padding and the grabber; this is just the column inside it.
  content: { gap: SPACE.xs },

  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: tint(MART.fallbackPrimary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: SPACE.sm, paddingBottom: SPACE.md },
  empty: { textAlign: 'center', paddingVertical: SPACE.xxxl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  rowPressed: { backgroundColor: MART.paperSunken },
  rowOff: { opacity: 0.5 },
  add: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.fallbackPrimary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
