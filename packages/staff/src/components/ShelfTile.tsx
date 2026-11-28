import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatQty } from '@kiosk/core';
import { FONT, MART, MOTION, RADIUS, SHADOW, SPACE, WEIGHT, onFill, tint, zoneFor } from '../theme/mart';
import { MartText } from '../theme/mart-ui';

/** What a shelf tile needs to know about a product — the same few facts the till's tiles show. */
export type ShelfTileItem = {
  name: string;
  /** Whole shillings, or null when the shop has not priced it yet. */
  priceCents: number | null;
  /** Ten-thousandths on hand at this branch, or null when the server did not say. */
  onHandUnits: number | null;
  weighed: boolean;
  /** A photograph, when the catalogue has one. */
  imageUrl?: string | null;
  /** How many are already in the basket. */
  inBasket?: number;
};

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? words[0]?.[1] ?? '')).toUpperCase();
}

function money(cents: number): string {
  return `KES ${(cents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Retail POS product tile: compact media, strong name/price, −/qty/+, clear selected vs out-of-stock.
 * Selection = brand border + check + stepper count. Stock = quiet “Out” under the price — never the same mark.
 */
export function ShelfTile({
  item,
  onPress,
  onAdd,
  onRemove,
  onPressRect,
  disabled = false,
  columns = 3,
  nameLines = 2,
  frame = 'grid',
}: {
  item: ShelfTileItem;
  onPress: () => void;
  onAdd?: () => void;
  onRemove?: () => void;
  onPressRect?: (rect: { x: number; y: number; w: number; h: number }) => void;
  disabled?: boolean;
  columns?: 2 | 3;
  /** How many lines the name may use. The rest wraps instead of ending in an ellipsis sooner than this. */
  nameLines?: number;
  /** `rail` fills a fixed-width card in a horizontal row. `grid` shares a column. */
  frame?: 'grid' | 'rail';
}) {
  const press = useRef(new Animated.Value(0)).current;
  const size = useRef({ w: 0, h: 0 });
  const photo = item.imageUrl?.trim() ? item.imageUrl : null;
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => {
    setPhotoFailed(false);
  }, [photo]);
  const poster = frame === 'rail' || columns === 2;
  const report = (pageX?: number, pageY?: number) => {
    if (!onPressRect || pageX === undefined || pageY === undefined) return;
    const { w, h } = size.current;
    if (w === 0 || h === 0) return;
    onPressRect({ x: pageX - w / 2, y: pageY - h / 2, w, h });
  };
  const lift = (to: number) => {
    Animated.timing(press, {
      toValue: to,
      duration: to ? MOTION.feedback : MOTION.state,
      easing: MOTION.easeOut,
      useNativeDriver: true,
    }).start();
  };
  const out = item.onHandUnits !== null && item.onHandUnits <= 0;
  const count = item.inBasket ?? 0;
  const selected = count > 0;
  const accent = zoneFor(item.name);
  const add = onAdd ?? onPress;

  return (
    <Animated.View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        size.current = { w: width, h: height };
      }}
      style={[
        styles.tile,
        frame === 'rail' ? styles.tileRail : columns === 2 ? styles.tileTwo : styles.tileThree,
        selected && styles.tileSelected,
        disabled && styles.off,
        { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) }] },
      ]}
    >
      <Pressable
        onPressIn={(event) => {
          lift(1);
          report(event.nativeEvent.pageX, event.nativeEvent.pageY);
        }}
        onPressOut={() => lift(0)}
        onPress={add}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={[
          item.name,
          item.priceCents === null ? 'no price' : money(item.priceCents),
          out ? 'out of stock' : item.onHandUnits === null ? null : `${formatQty(item.onHandUnits)} on hand`,
          selected ? `${count} in basket` : null,
        ]
          .filter(Boolean)
          .join(', ')}
      >
        <View style={poster ? undefined : styles.wellPad}>
          <View style={[poster ? styles.poster : styles.well, { backgroundColor: tint(accent, out ? 0.08 : 0.12) }]}>
            {photo && !photoFailed ? (
              <Image
                source={{ uri: photo }}
                style={[styles.image, out && styles.imageOut]}
                resizeMode="cover"
                onError={() => setPhotoFailed(true)}
              />
            ) : (
              <MartText variant={poster ? 'title' : 'label'} color={tint(MART.ink, out ? 0.28 : 0.5)} style={styles.mark}>
                {initialsOf(item.name)}
              </MartText>
            )}
            {selected ? (
              <View style={styles.check} accessibilityElementsHidden>
                <Ionicons name="checkmark" size={12} color={onFill(MART.fallbackPrimary).primary} />
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.info}>
          <MartText variant="heading" {...(nameLines > 0 ? { numberOfLines: nameLines } : {})} style={[styles.name, poster && styles.namePoster]}>
            {item.name}
          </MartText>
          {item.priceCents === null ? (
            <MartText variant="price" color={MART.inkQuiet} style={styles.price}>
              No price
            </MartText>
          ) : (
            <MartText variant="price" color={MART.ink} style={styles.price}>
              {money(item.priceCents)}
            </MartText>
          )}
          {out ? (
            <MartText variant="meta" color={MART.danger} style={styles.stockOut}>
              Out of stock
            </MartText>
          ) : item.onHandUnits !== null ? (
            <MartText variant="meta" color={MART.inkQuiet} style={styles.stock}>
              {`${formatQty(item.onHandUnits)} on hand`}
            </MartText>
          ) : item.weighed ? (
            <MartText variant="meta" color={MART.inkQuiet} style={styles.stock}>
              by weight
            </MartText>
          ) : (
            <View style={styles.stockSpacer} />
          )}
        </View>
      </Pressable>

      <View style={[styles.stepper, selected && styles.stepperOn]}>
        <Pressable
          onPress={onRemove}
          disabled={disabled || !selected || !onRemove}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={selected ? `One fewer ${item.name}` : undefined}
          style={({ pressed }) => [styles.stepHit, (!selected || !onRemove) && styles.stepDim, pressed && styles.stepPressed]}
        >
          <Ionicons name="remove" size={16} color={selected ? MART.ink : MART.inkQuiet} />
        </Pressable>
        <MartText variant="heading" color={MART.ink} style={styles.stepCount}>
          {count}
        </MartText>
        <Pressable
          onPress={add}
          disabled={disabled}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`Add ${item.name}`}
          style={({ pressed }) => [styles.stepPlus, pressed && styles.stepPressed]}
        >
          <Ionicons name="add" size={16} color={onFill(MART.fallbackPrimary).primary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    overflow: 'hidden',
    paddingBottom: SPACE.xs,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...SHADOW.card,
  },
  tileTwo: { maxWidth: '48.5%' },
  tileThree: { maxWidth: '31.5%' },
  tileRail: { width: '100%', maxWidth: '100%', flexGrow: 0 },
  tileSelected: {
    borderColor: MART.fallbackPrimary,
  },
  off: { opacity: 0.5 },
  wellPad: { paddingHorizontal: SPACE.xs, paddingTop: SPACE.xs },
  well: {
    width: '100%',
    height: 52,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // The product is the card: a square photo, edge to edge, with the name underneath.
  poster: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { ...StyleSheet.absoluteFillObject },
  imageOut: { opacity: 0.45 },
  mark: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold, letterSpacing: -0.3 },
  check: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { paddingHorizontal: SPACE.sm, paddingTop: SPACE.xs, paddingBottom: 2, gap: 1 },
  name: {
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: -0.15,
  },
  namePoster: { fontSize: 15, lineHeight: 19 },
  price: {
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  stock: { fontSize: 11, lineHeight: 14 },
  stockOut: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium, fontSize: 11, lineHeight: 14 },
  stockSpacer: { height: 14 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: SPACE.xs,
    marginTop: SPACE.xs,
    minHeight: 34,
    paddingLeft: 2,
    paddingRight: 2,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
  },
  stepperOn: {
    backgroundColor: tint(MART.fallbackPrimary, 0.12),
  },
  stepHit: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDim: { opacity: 0.35 },
  stepPressed: { opacity: 0.7 },
  stepCount: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  stepPlus: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
