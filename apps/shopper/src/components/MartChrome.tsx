import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { GUTTER, MART, RADIUS, SPACE, TYPE, type MartPalette } from '../theme/mart';

/**
 * Identity only. Cart and account live in the tab bar, so repeating them here
 * gave the page two competing navigations for the same destinations.
 *
 * In the generic app the shop's name is also the way to change shops: a chip that opens the shops this
 * phone knows (plan §5.12.4 row 8). A shop's own app has one shop and no chip.
 */
export function MartHomeHeader({ mart, onPressShop }: { mart: MartPalette; onPressShop?: () => void }) {
  const identity = (
    <>
      {mart.logoUrl ? (
        <Image source={{ uri: mart.logoUrl }} style={styles.logo} resizeMode="contain" />
      ) : (
        <View style={[styles.logoFallback, { backgroundColor: mart.primary }]}>
          <Text style={styles.logoMonogram}>{mart.displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.brandCopy}>
        <Text numberOfLines={1} style={styles.brandName}>
          {mart.displayName}
        </Text>
        <Text numberOfLines={1} style={styles.tag}>
          Everyday essentials, close to you
        </Text>
      </View>
    </>
  );

  if (!onPressShop) {
    return <View style={styles.header}>{identity}</View>;
  }
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onPressShop}
        accessibilityRole="button"
        accessibilityLabel={`${mart.displayName}. Change shop`}
        accessibilityHint="Shows the shops on this phone"
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      >
        {identity}
        <Ionicons name="chevron-down" size={18} color={MART.inkMuted} />
      </Pressable>
    </View>
  );
}

export function MartSearchField({
  primary,
  onPress,
}: {
  primary: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel="Search products"
      style={({ pressed }) => [styles.searchWrap, pressed && styles.searchPressed]}
    >
      <Ionicons name="search" size={18} color={MART.inkQuiet} />
      <Text style={styles.searchPlaceholder}>Search or scan a barcode</Text>
      <Ionicons name="barcode-outline" size={18} color={primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.md,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 44,
    borderRadius: RADIUS.md,
  },
  chipPressed: {
    backgroundColor: MART.paperSunken,
  },
  logo: {
    width: 38,
    height: 38,
  },
  logoFallback: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMonogram: {
    ...TYPE.heading,
    color: '#ffffff',
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    ...TYPE.heading,
    color: MART.ink,
  },
  tag: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
  searchWrap: {
    marginHorizontal: GUTTER,
    marginBottom: SPACE.md,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderColor: MART.border,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paper,
  },
  searchPressed: {
    backgroundColor: MART.paperSunken,
  },
  searchPlaceholder: {
    ...TYPE.body,
    flex: 1,
    color: MART.inkQuiet,
  },
});
