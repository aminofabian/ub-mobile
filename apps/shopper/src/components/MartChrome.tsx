import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Coast, COAST_SWELL } from './Coast';
import { GUTTER, MART, RADIUS, SPACE, TYPE, type MartPalette } from '../theme/mart';

const IDENTITY = 48;
const SEARCH = 52;
const TOP = SPACE.sm;
const BETWEEN = SPACE.md;
const SHORE = SPACE.lg;
/** How far the page scrolls before the header has finished folding. */
const FOLD = IDENTITY + BETWEEN;

/** Room the open header takes below the status bar, coast included. Lists start under this. */
export const HOME_HEADER_OPEN = TOP + IDENTITY + BETWEEN + SEARCH + SHORE + COAST_SWELL;

/**
 * The top of the shop: a lobe in the shop's colour that runs off both sides of the screen, holding who
 * the shop is and the way to search it. As the page scrolls the shop's name folds away, the search
 * capsule stays, and the coast underneath redraws.
 *
 * In the generic app the shop's name is also the way to change shops (plan §5.12.4 row 8). A shop's own
 * app has one shop, so the name is not a button there.
 */
export function MartHomeHeader({
  mart,
  scrollY,
  onPressShop,
  onSearch,
  onScan,
}: {
  mart: MartPalette;
  scrollY: SharedValue<number>;
  onPressShop?: () => void;
  onSearch: () => void;
  onScan?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const on = mart.onPrimary;
  const open = insets.top + TOP + IDENTITY + BETWEEN + SEARCH + SHORE;

  const fold = useDerivedValue(() =>
    interpolate(scrollY.value, [0, FOLD], [0, 1], Extrapolation.CLAMP)
  );
  const coast = useDerivedValue(() => open - fold.value * FOLD);
  const drift = useDerivedValue(() =>
    interpolate(scrollY.value, [-80, 0, 360], [-0.35, 0, 1], Extrapolation.CLAMP)
  );
  const identityStyle = useAnimatedStyle(() => ({
    opacity: 1 - fold.value * 1.6,
    transform: [{ translateY: -fold.value * 14 }],
  }));
  const searchStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -fold.value * FOLD }],
  }));

  const identity = (
    <>
      <View style={[styles.logoWell, { backgroundColor: on.primary }]}>
        {mart.logoUrl ? (
          <Image source={{ uri: mart.logoUrl }} style={styles.logo} contentFit="contain" />
        ) : (
          <Text style={[styles.monogram, { color: mart.primary }]}>
            {mart.displayName.slice(0, 1).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.brandCopy}>
        <Text numberOfLines={1} style={[styles.brandName, { color: on.primary }]}>
          {mart.displayName}
        </Text>
        <Text numberOfLines={1} style={[styles.tag, { color: on.secondary }]}>
          Everyday essentials, close to you
        </Text>
      </View>
    </>
  );

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Coast color={mart.primary} height={coast} drift={drift} />
      <View pointerEvents="box-none" style={{ paddingTop: insets.top + TOP }}>
        <Animated.View style={[styles.identity, identityStyle]}>
          {onPressShop ? (
            <Pressable
              onPress={onPressShop}
              accessibilityRole="button"
              accessibilityLabel={`${mart.displayName}. Change shop`}
              accessibilityHint="Shows the shops on this phone"
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              {identity}
              <View style={[styles.switch, { backgroundColor: on.wash }]}>
                <Ionicons name="chevron-down" size={18} color={on.primary} />
              </View>
            </Pressable>
          ) : (
            <View style={styles.chip}>{identity}</View>
          )}
        </Animated.View>

        <Animated.View style={[styles.searchRow, searchStyle]}>
          <Pressable
            onPress={onSearch}
            accessibilityRole="search"
            accessibilityLabel="Search products"
            style={({ pressed }) => [styles.search, pressed && styles.pressed]}
          >
            <Ionicons name="search" size={20} color={MART.ink} />
            <Text numberOfLines={1} style={styles.searchPlaceholder}>
              Search the shop
            </Text>
          </Pressable>
          {onScan ? (
            <Pressable
              onPress={onScan}
              accessibilityRole="button"
              accessibilityLabel="Scan a barcode"
              style={({ pressed }) => [
                styles.scan,
                { backgroundColor: mart.accent },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="barcode-outline" size={24} color={mart.onAccent.primary} />
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  identity: {
    height: IDENTITY,
    marginBottom: BETWEEN,
    paddingHorizontal: GUTTER,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  pressed: {
    opacity: 0.8,
  },
  logoWell: {
    width: IDENTITY,
    height: IDENTITY,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: IDENTITY - 12,
    height: IDENTITY - 12,
  },
  monogram: {
    ...TYPE.title,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    ...TYPE.title,
  },
  tag: {
    ...TYPE.meta,
  },
  switch: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    gap: SPACE.sm,
    paddingHorizontal: GUTTER,
  },
  search: {
    flex: 1,
    height: SEARCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paper,
  },
  searchPlaceholder: {
    ...TYPE.body,
    flex: 1,
    color: MART.inkMuted,
  },
  scan: {
    width: SEARCH,
    height: SEARCH,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
