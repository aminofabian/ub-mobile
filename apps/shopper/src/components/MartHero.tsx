import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MartPalette } from '../theme/mart';

export function MartHero({
  mart,
  onShopNow,
}: {
  mart: MartPalette;
  onShopNow: () => void;
}) {
  const headline =
    mart.tagline?.replace(/^Palmart\s*[|—–-]\s*/i, '').trim() ||
    'Your Everyday Mini Mart for Groceries, Snacks & Essentials';
  const body =
    mart.description?.trim() ||
    'Fresh products, fair prices, and fast delivery — from your neighborhood store, now in your pocket.';

  return (
    <View style={[styles.hero, { backgroundColor: mart.primary }]}>
      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.subhead}>Right to your door.</Text>
      <Text numberOfLines={3} style={styles.body}>
        {body}
      </Text>
      <Pressable
        onPress={onShopNow}
        accessibilityRole="button"
        accessibilityLabel="Shop now"
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: mart.accent },
          pressed && styles.ctaPressed,
        ]}
      >
        <Text style={styles.ctaLabel}>Shop now</Text>
        <Ionicons name="arrow-forward" size={14} color="#0f172a" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 4,
  },
  headline: {
    color: '#fff',
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  },
  subhead: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 16,
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  },
  body: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.58)',
    fontSize: 12,
    lineHeight: 17,
    maxWidth: 340,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 14,
    minHeight: 36,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 3,
  },
  ctaPressed: {
    transform: [{ scale: 0.98 }],
  },
  ctaLabel: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
});
