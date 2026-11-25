import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT, MART, RADIUS, SPACE, tint, zoneFor, MartText, onFill } from '@kiosk/staff';
import type { CartItem } from '../lib/cart';
import { itemWords } from '../lib/item-words';
import { CARD_SURFACE, TABULAR_NUMS } from './CashierPrimitives';

type Props = {
  item: CartItem & { imageUrl?: string | null };
  /** How many of this item are in the basket now (0 when none). For weighed items this is kilograms. */
  quantity: number;
  /** Sold by weight: the tile taps through to the weigh prompt rather than showing a unit stepper. */
  weighed: boolean;
  /** Put one in the basket (or open the weigh prompt). */
  onAdd: () => void;
  /** Set the exact number in the basket; 0 takes it out. Only for unit items. */
  onSetQuantity: (quantity: number) => void;
};

/** The first letter or two of a product name, for the placeholder when there is no photo. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * One product in the grid. When it is not in the basket it is a single tap to add. Once it is in, the tile grows a
 * −/＋ stepper with the count in the middle — tap the count to type an exact number — so the cashier changes amounts
 * without a cart list covering the grid. Weighed items always tap through to the scale.
 */
export const ProductTile = React.memo(ProductTileInner);

function ProductTileInner({ item, quantity, weighed, onAdd, onSetQuantity }: Props) {
  const words = itemWords(item);
  const accent = zoneFor(item.name);
  const blocked = Boolean(words.blocked);
  const out = words.stock === 'Out of stock';
  const inCart = quantity > 0;
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState('');
  // Out-of-stock items can still be rung up (the shop may allow negative stock), but the first tap
  // only arms a "sell anyway?" state so a cashier never sells an empty shelf by a slip of the finger.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!inCart && editing) setEditing(false);
  }, [inCart, editing]);
  useEffect(() => {
    if (!out && armed) setArmed(false);
  }, [out, armed]);

  // The one authored moment: when the count climbs (a tap landed in the basket), the tile gives a
  // quick spring — a physical "got it" the cashier feels without looking at the cart. Only on an
  // increase, so lowering a quantity stays quiet.
  const pop = useRef(new Animated.Value(1)).current;
  const prevQty = useRef(quantity);
  useEffect(() => {
    if (quantity > prevQty.current) {
      pop.setValue(0.92);
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }).start();
    }
    prevQty.current = quantity;
  }, [quantity, pop]);

  const commit = () => {
    const n = Math.max(0, Math.trunc(Number(typed.replace(/[^0-9]/g, '')) || 0));
    onSetQuantity(n);
    setEditing(false);
    setTyped('');
  };

  // Tapping the tile body: add when there's no unit stepper (weighed, or not yet in cart as a unit item).
  const tapsToAdd = weighed || !inCart;

  const onTap = () => {
    if (out && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    onAdd();
  };

  return (
    <Animated.View
      style={[styles.tile, blocked && styles.dim, out && !armed && styles.dim, armed && styles.armed, inCart && !weighed && styles.inCart, { transform: [{ scale: pop }] }]}
    >
      <Pressable
        onPress={tapsToAdd ? onTap : undefined}
        disabled={blocked}
        accessibilityRole="button"
        accessibilityLabel={[item.name, words.price, words.stock, words.blocked].filter(Boolean).join(', ')}
        style={({ pressed }) => [pressed && tapsToAdd && !blocked && styles.pressed]}
      >
        <View style={[styles.thumb, { backgroundColor: tint(accent, 0.16) }]}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <MartText variant="title" color={accent}>
              {initials(item.name)}
            </MartText>
          )}
          {weighed ? (
            <View style={styles.badge}>
              <Ionicons name="scale-outline" size={13} color={MART.inkMuted} />
            </View>
          ) : null}
          {inCart ? (
            <View style={styles.cartBadge}>
              <MartText variant="shelf" color={onFill(MART.fallbackPrimary).primary} style={TABULAR_NUMS}>
                {weighed ? '✓' : `${quantity}`}
              </MartText>
            </View>
          ) : null}
          {out ? (
            <View style={[styles.outVeil, armed && styles.outVeilArmed]}>
              <MartText variant="shelf" color={armed ? MART.warning : MART.danger}>
                {armed ? 'SELL ANYWAY?' : 'OUT'}
              </MartText>
            </View>
          ) : null}
        </View>

        <MartText variant="label" numberOfLines={3} style={styles.name}>
          {item.name}
        </MartText>
        {item.variantParent ? (
          // A family parent: no price of its own — tap to choose a size.
          <View style={styles.sizesPill}>
            <MartText variant="shelf" color={MART.fallbackPrimary}>
              CHOOSE SIZE
            </MartText>
            <Ionicons name="chevron-forward" size={12} color={MART.fallbackPrimary} />
          </View>
        ) : (
          <>
            <MartText variant="price" color={words.price === '-' ? MART.inkQuiet : MART.ink} style={TABULAR_NUMS}>
              {words.price === '-' ? '—' : `KES ${words.price}`}
            </MartText>
            {words.blocked ? (
          <MartText variant="meta" color={MART.danger} numberOfLines={1}>
            {words.blocked}
          </MartText>
        ) : words.stock && !out && !inCart ? (
          // Amber when stock is low, quiet otherwise — a glance tells the cashier what to reorder.
          <View style={styles.stockRow}>
            {words.stockLevel === 'low' ? (
              <View style={styles.lowDot} />
            ) : null}
            <MartText
              variant="meta"
              color={words.stockLevel === 'low' ? MART.warning : MART.inkQuiet}
              numberOfLines={1}
            >
              {words.stock}
            </MartText>
          </View>
            ) : null}
          </>
        )}
      </Pressable>

      {/* Unit stepper: shown only once a unit item is in the basket. */}
      {inCart && !weighed ? (
        <View style={styles.stepper}>
          <Pressable
            onPress={() => onSetQuantity(quantity - 1)}
            style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
            accessibilityLabel={`One fewer ${item.name}`}
            hitSlop={6}
          >
            <Ionicons name={quantity <= 1 ? 'trash-outline' : 'remove'} size={16} color={quantity <= 1 ? MART.danger : MART.ink} />
          </Pressable>
          {editing ? (
            <TextInput
              value={typed}
              onChangeText={setTyped}
              keyboardType="number-pad"
              autoFocus
              placeholder={String(quantity)}
              placeholderTextColor={MART.inkQuiet}
              style={[styles.qtyInput, TABULAR_NUMS]}
              onBlur={commit}
              onSubmitEditing={commit}
              returnKeyType="done"
            />
          ) : (
            <Pressable
              onPress={() => { setEditing(true); setTyped(String(quantity)); }}
              style={styles.qtyTap}
              hitSlop={4}
              accessibilityLabel={`${quantity}, tap to type`}
            >
              <MartText variant="heading" style={TABULAR_NUMS}>{quantity}</MartText>
            </Pressable>
          )}
          <Pressable
            onPress={() => onSetQuantity(quantity + 1)}
            style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
            accessibilityLabel={`One more ${item.name}`}
            hitSlop={6}
          >
            <Ionicons name="add" size={16} color={MART.ink} />
          </Pressable>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    ...CARD_SURFACE,
    padding: SPACE.sm,
    gap: SPACE.xs,
  },
  inCart: { borderColor: MART.fallbackPrimary, borderWidth: 1.5 },
  dim: { opacity: 0.55 },
  // Armed to sell an out-of-stock item: full opacity with an amber edge, so the override is obvious.
  armed: { borderColor: MART.warning, borderWidth: 1.5 },
  pressed: { opacity: 0.86 },
  thumb: {
    // Shorter than it is wide, so the image takes less of the card and the name + price get room —
    // three to a row, names that run long, and a dense grid a fast cashier can scan.
    width: '100%',
    aspectRatio: 1.7,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: SPACE.xs,
    left: SPACE.xs,
    width: 24,
    height: 24,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: SPACE.xs,
    right: SPACE.xs,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outVeil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250,248,243,0.66)',
  },
  outVeilArmed: { backgroundColor: 'rgba(253,242,196,0.82)' },
  // Room for up to three lines of name, so a variant ("…First & last days blue-16") is read, not cut.
  name: { minHeight: 48 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: MART.warning },
  sizesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACE.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.fallbackPrimary, 0.12),
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACE.xxs,
    backgroundColor: tint(MART.fallbackPrimary, 0.08),
    borderRadius: RADIUS.pill,
    padding: 3,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPressed: {
    backgroundColor: MART.paperSunken,
  },
  qtyTap: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 36 },
  qtyInput: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONT.semibold,
    fontSize: 15,
    color: MART.ink,
    minHeight: 36,
    paddingVertical: 0,
  },
});
