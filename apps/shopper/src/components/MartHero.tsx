import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GUTTER, MART, RADIUS, SPACE, TYPE, ZONE, type MartPalette } from '../theme/mart';
import { Capsule } from './Capsule';

/** The shop's own words about itself, on a field of sun yellow: the first area below the coast. */
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
    <View style={styles.hero}>
      <Text style={styles.headline}>{headline}</Text>
      <Text numberOfLines={3} style={styles.body}>
        {body}
      </Text>
      <Capsule
        label="Start shopping"
        chip="arrow-down"
        size="md"
        fill={MART.ink}
        stretch={false}
        onPress={onShopNow}
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: GUTTER,
    padding: SPACE.xl,
    paddingTop: SPACE.xl + SPACE.xs,
    borderRadius: RADIUS.xl,
    backgroundColor: ZONE.sun,
  },
  headline: {
    ...TYPE.display,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: MART.ink,
  },
  body: {
    ...TYPE.body,
    marginTop: SPACE.md,
    color: MART.ink,
    maxWidth: 320,
  },
  cta: {
    marginTop: SPACE.xl,
  },
});
