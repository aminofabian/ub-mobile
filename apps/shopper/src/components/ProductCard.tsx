import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { phase_15_storefront_public } from '@kiosk/types';
import { FONT, MART, RADIUS, SPACE, TYPE } from '../theme/mart';
import { formatMoney } from '../lib/media';
import { PressScale } from './Capsule';
import { QuickAddButton } from './QuickAddButton';

type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];

interface ProductCardProps {
  item: Item;
  currency?: string;
  /** The shop's colour, for the add control. */
  accent?: string;
  onPress: (item: Item) => void;
}

/**
 * A product on the shelf: its photograph on a white tile, with the add control riding the tile's corner,
 * then the name and the price set straight on the page. No box around the words.
 */
export function ProductCard({
  item,
  currency = 'KES',
  accent = MART.fallbackPrimary,
  onPress,
}: ProductCardProps) {
  const price = item.price ?? 0;
  const name = item.name ?? 'Product';

  return (
    <PressScale
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatMoney(currency, price)}`}
      style={styles.card}
    >
      <View style={styles.tile}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.image}
            contentFit="contain"
            transition={180}
            recyclingKey={item.id ?? item.imageUrl}
            accessible={false}
          />
        ) : (
          <Text style={styles.placeholderLetter}>{name.slice(0, 1).toUpperCase()}</Text>
        )}
        {item.id ? (
          <View style={styles.add}>
            <QuickAddButton
              itemId={item.id}
              name={name}
              accent={accent}
              price={item.price}
              imageUrl={item.imageUrl}
              variantName={item.variantName}
            />
          </View>
        ) : null}
      </View>
      {item.variantName ? (
        <Text numberOfLines={2} style={styles.name}>
          {name}
        </Text>
      ) : (
        <Text numberOfLines={3} style={styles.name}>
          {name}
        </Text>
      )}
      {item.variantName ? (
        <Text numberOfLines={1} style={styles.variant}>
          {item.variantName}
        </Text>
      ) : null}
      <Text style={styles.price}>{formatMoney(currency, price)}</Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '78%',
    height: '78%',
  },
  placeholderLetter: {
    ...TYPE.display,
    fontSize: 44,
    lineHeight: 48,
    color: MART.paperSunken,
  },
  add: {
    position: 'absolute',
    right: SPACE.sm,
    bottom: SPACE.sm,
  },
  name: {
    ...TYPE.label,
    fontFamily: FONT.medium,
    marginTop: SPACE.sm + 2,
    paddingHorizontal: SPACE.xs,
    color: MART.ink,
  },
  // The size/variant, set small and quiet under the name, so "500g" or "Large" is read at a glance.
  variant: {
    ...TYPE.meta,
    marginTop: 1,
    paddingHorizontal: SPACE.xs,
    color: MART.inkQuiet,
  },
  price: {
    ...TYPE.price,
    marginTop: SPACE.xxs,
    marginBottom: SPACE.sm,
    paddingHorizontal: SPACE.xs,
    color: MART.ink,
  },
});
