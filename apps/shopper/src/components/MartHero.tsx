import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GUTTER, ON_BRAND, RADIUS, SPACE, TYPE, type MartPalette } from '../theme/mart';

export function MartHero({
  mart,
  onShopNow,
}: {
  mart: MartPalette;
  onShopNow: () => void;
}) {
  const headline =
    mart.tagline?.replace(/^Palmart\s*[|—–-]\s*/i, '').trim() ||
    'Your everyday mini mart, now in your pocket';
  const body =
    mart.description?.trim() ||
    'Fresh products, fair prices, and fast delivery from your neighbourhood store.';

  return (
    <View style={[styles.hero, { backgroundColor: mart.primary }]}>
      <Text style={styles.headline}>{headline}</Text>
      <Text numberOfLines={3} style={styles.body}>
        {body}
      </Text>
      <View style={[styles.rule, { backgroundColor: mart.gold }]} />
      <Pressable
        onPress={onShopNow}
        accessibilityRole="button"
        accessibilityLabel="Start shopping"
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: mart.accent },
          pressed && styles.ctaPressed,
        ]}
      >
        <Text style={styles.ctaLabel}>Start shopping</Text>
        <Ionicons name="arrow-forward" size={14} color="#1a1204" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: GUTTER,
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.xl,
    borderRadius: RADIUS.md,
  },
  headline: {
    ...TYPE.display,
    fontSize: 27,
    lineHeight: 32,
    color: ON_BRAND.primary,
  },
  body: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: ON_BRAND.secondary,
    maxWidth: 340,
  },
  rule: {
    marginTop: SPACE.lg,
    width: 44,
    height: 2,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: SPACE.lg,
    minHeight: 44,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    borderRadius: RADIUS.md,
  },
  ctaPressed: {
    opacity: 0.88,
  },
  ctaLabel: {
    ...TYPE.label,
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1204',
  },
});
