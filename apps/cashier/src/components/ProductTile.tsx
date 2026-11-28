import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CardGloss, FONT, MART, MOTION, RADIUS, SPACE, tint, zoneFor, MartText, onFill, WEIGHT } from '@kiosk/staff';
import type { CartItem } from '../lib/cart';
import { itemWords } from '../lib/item-words';

import { CARD_SURFACE, TABULAR_NUMS } from './CashierPrimitives';
import { feel } from '../lib/feel';
import { stockTap } from '../lib/stock-tap';

type Props = {
  item: CartItem & { imageUrl?: string | null };
  /** How many of this item are in the basket now (0 when none). For weighed items this is kilograms. */
  quantity: number;
  /** Sold by weight: the tile taps through to the weigh prompt rather than showing a unit stepper. */
  weighed: boolean;
  /**
   * The shop allows an empty shelf to be sold from: one tap puts the product in, with no "sell anyway?" step. The
   * tile still shows it is out, because the cashier should know what they are selling.
   */
  oneTapWhenOut?: boolean;
  /** How many tiles share a row on this screen — the tile takes its share and no more. */
  columns?: number;
  /** Put one in the basket (or open the weigh prompt). */
  onAdd: () => void;
  /** Set the exact number in the basket; 0 takes it out. Only for unit items. */
  onSetQuantity: (quantity: number) => void;
  /**
   * Where the tile was when it was pressed, in window coordinates, with what it looks like. Used to fly a
   * ghost of it to the basket — measured on press-in so the tap itself is never delayed.
   */
  onPressRect?: (hit: { x: number; y: number; w: number; h: number; initials: string; colour: string }) => void;
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

function ProductTileInner({ item, quantity, weighed, oneTapWhenOut = false, columns = 3, onAdd, onSetQuantity, onPressRect }: Props) {
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
  /** Pressed: the surface catches the light. 0 at rest, 1 under the finger. */
  const lit = useRef(new Animated.Value(0)).current;
  const lightUp = (on: boolean) => {
    Animated.timing(lit, {
      toValue: on ? 1 : 0,
      duration: on ? 130 : 260,
      easing: MOTION.easeOut,
      useNativeDriver: true,
    }).start();
  };
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
    // Out of stock is a warning worth a second look — unless the shop has said it may be sold, and then it is one tap.
    if (stockTap({ out, armed, allowOutOfStock: oneTapWhenOut }) === 'arm') {
      feel.warn();
      setArmed(true);
      return;
    }
    setArmed(false);
    feel.tap();
    onAdd();
  };

  const shell = useRef<View>(null);
  const tellRect = () => {
    if (!onPressRect) return;
    shell.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) onPressRect({ x, y, w, h, initials: initials(item.name), colour: accent });
    });
  };

  return (
    <Animated.View
      ref={shell}
      style={[
        styles.tile,
        { maxWidth: `${Math.floor(100 / columns) - 1.5}%` },
        blocked && styles.dim,
        out && !armed && styles.dim,
        armed && styles.armed,
        {
          transform: [
            // perspective first, so the tilt below reads as depth rather than a skew
            { perspective: 900 },
            { translateY: lit.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
            { rotateX: lit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-7deg'] }) },
            { rotateY: lit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '4deg'] }) },
            { scale: pop },
            { scale: lit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) },
          ],
        },
      ]}
    >
      {/* The gloss of the tile itself: clipped to the card's radius, painted under the content so no letter
          sits under it. What you see is the white of the card catching light, not a wash over the words. */}
      <CardGloss />
      <View style={styles.gloss} pointerEvents="none">
        <Animated.View
          style={[styles.pressStreak, { opacity: lit.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }]}
        />
        <Animated.View
          style={[styles.pressRim, { opacity: lit.interpolate({ inputRange: [0, 1], outputRange: [0, 0.95] }) }]}
        />
      </View>

      <Pressable
        onPressIn={() => {
          tellRect();
          lightUp(true);
        }}
        onPressOut={() => lightUp(false)}
        onPress={tapsToAdd ? onTap : undefined}
        disabled={blocked}
        accessibilityRole="button"
        accessibilityLabel={[item.name, words.price, words.stock, words.blocked].filter(Boolean).join(', ')}
        style={styles.body}
      >
        <View style={[styles.well, { backgroundColor: tint(accent, 0.16) }]}>
          {/* the same view-based light as the card, so the well shines identically at any tile size */}
          <View style={styles.wellLight} pointerEvents="none" />
          <View style={styles.wellRim} pointerEvents="none" />
          <Animated.Image
            source={SHEEN}
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: lit.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                transform: [{ translateY: lit.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
              },
            ]}
            resizeMode="stretch"
          />
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <MartText variant="title" color={tint(MART.ink, 0.62)}>
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

        <View style={styles.info}>
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
          // Pinned to the foot of the tile, so the price sits on one line across a row however long the
          // names above it run.
          <View style={styles.foot}>
            <View style={styles.priceRow}>
              {words.price === '-' ? (
                <MartText variant="price" color={MART.inkQuiet}>
                  —
                </MartText>
              ) : (
                <>
                  <MartText variant="shelf" color={MART.inkQuiet} style={styles.currency}>
                    KES
                  </MartText>
                  <MartText variant="price" color={MART.ink} style={[TABULAR_NUMS, styles.price]}>
                    {words.byWeight ? words.price.replace(/\s+per kg$/i, '') : words.price}
                  </MartText>
                  {words.byWeight ? (
                    <MartText variant="shelf" color={MART.inkQuiet} style={styles.currency}>
                      /kg
                    </MartText>
                  ) : null}
                </>
              )}
            </View>
            {words.blocked ? (
              <MartText variant="meta" color={MART.danger} numberOfLines={1}>
                {words.blocked}
              </MartText>
            ) : words.stock && !out && !inCart ? (
              // Amber when stock is low, quiet otherwise — a glance tells the cashier what to reorder.
              <View style={styles.stockRow}>
                {words.stockLevel === 'low' ? <View style={styles.lowDot} /> : null}
                <MartText
                  variant="meta"
                  color={words.stockLevel === 'low' ? MART.warning : MART.inkQuiet}
                  numberOfLines={1}
                >
                  {words.stock}
                </MartText>
              </View>
            ) : null}
          </View>
        )}
        </View>
      </Pressable>

      {/* Unit stepper: shown only once a unit item is in the basket. */}
      {inCart && !weighed ? (
        <View style={styles.stepper}>
          <Pressable
            onPress={() => {
              feel.select();
              onSetQuantity(quantity - 1);
            }}
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
            onPress={() => {
              feel.select();
              onSetQuantity(quantity + 1);
            }}
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

const SHEEN = require('../../assets/gloss-sheen.png');

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    // A tile has to look like it is above the shelf, not printed on it: a real drop shadow, not the token's whisper.
    ...CARD_SURFACE,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 9,
    padding: 0,
  },
  // The body fills what the stepper leaves, so a long name pushes down inside its own tile and every
  // price sits on the same line across a row.
  body: { flex: 1 },
  dim: { opacity: 0.55 },
  // Armed to sell an out-of-stock item: full opacity with an amber edge, so the override is obvious.
  armed: { borderColor: MART.warning, borderWidth: 1.5 },
  gloss: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  // Pressed: a hard white sweep across the card and a lit top edge — the surface catching the light as it lifts.
  pressStreak: {
    position: 'absolute',
    top: '-16%',
    left: '-30%',
    right: '-30%',
    height: '46%',
    backgroundColor: '#ffffff',
    transform: [{ rotate: '-14deg' }],
  },
  pressRim: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#ffffff' },
  thumbGloss: { opacity: 0.95 },
  // The product takes the whole top of the card, edge to edge and under its own rounded corners: the card is the
  // product, not a white box with a picture inside it.
  well: {
    width: '100%',
    aspectRatio: 1.42,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  wellLight: {
    position: 'absolute',
    top: '-30%',
    left: '-30%',
    right: '-30%',
    height: '95%',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    transform: [{ rotate: '-13deg' }],
  },
  wellRim: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255, 255, 255, 0.55)' },
  // Everything the cashier reads, on the card below the product.
  info: { flex: 1, paddingHorizontal: SPACE.sm, paddingTop: SPACE.xs, paddingBottom: SPACE.sm, gap: SPACE.xs },
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
    backgroundColor: tint(MART.paperElevated, 0.78),
  },
  outVeilArmed: { backgroundColor: 'rgba(253,242,196,0.82)' },
  // Room for up to three lines of name, so a variant ("…First & last days blue-16") is read, not cut.
  // It grows to fill the tile, so the price and the stepper sit on one line across a row of tiles.
  // A shelf tag, not a headline: small enough that the price and the shelf count still lead.
  name: { minHeight: 48, flex: 1, fontSize: 12.5, lineHeight: 18, letterSpacing: -0.1 },
  foot: { marginTop: 'auto', gap: 3 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, flexWrap: 'wrap' },
  // Money: the currency is a mark beside the figure, on the same line box — no nested leading to clip.
  price: { lineHeight: 22 },
  currency: { fontSize: 10.5, letterSpacing: 0.5 },
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
    fontWeight: WEIGHT.semibold,
    fontSize: 15,
    color: MART.ink,
    minHeight: 36,
    paddingVertical: 0,
  },
});
