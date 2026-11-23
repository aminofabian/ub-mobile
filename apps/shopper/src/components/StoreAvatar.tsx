import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { MART, RADIUS } from '../theme/mart';
import { readableTextOn, type StoreCardView } from '../lib/store-card';

/** A shop's logo, or a tile with its first letter when it has none or the logo will not load. */
export function StoreAvatar({ card, size = 44 }: { card: StoreCardView; size?: number }) {
  const [failed, setFailed] = useState(false);
  const radius = size >= 56 ? RADIUS.lg : RADIUS.md;

  if (card.logoUrl && !failed) {
    return (
      <View style={[styles.logoFrame, { width: size, height: size, borderRadius: radius }]}>
        <Image
          source={{ uri: card.logoUrl }}
          style={{ width: size - 8, height: size - 8 }}
          resizeMode="contain"
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  const background = card.color ?? MART.fallbackPrimary;
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: radius, backgroundColor: background }]}>
      <Text
        style={{ fontSize: Math.round(size * 0.42), fontWeight: '700', color: readableTextOn(background) }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {card.monogram}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logoFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
