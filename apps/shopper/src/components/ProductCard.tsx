import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { phase_15_storefront_public } from '@kiosk/types';
import { ELEVATION, MART, RADIUS, SPACE, TYPE } from '../theme/mart';
import { formatMoney } from '../lib/media';
import { QuickAddButton } from './QuickAddButton';

type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];

interface ProductCardProps {
  item: Item;
  currency?: string;
  accent?: string;
  onPress: (item: Item) => void;
}

export function ProductCard({
  item,
  currency = 'KES',
  accent = MART.fallbackAccent,
  onPress,
}: ProductCardProps) {
  const price = item.price ?? 0;
  const name = item.name ?? 'Product';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatMoney(currency, price)}`}
    >
      <View style={styles.imageWell}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.image}
            resizeMode="contain"
            accessibilityLabel={name}
          />
        ) : (
          <Text style={styles.placeholderLetter}>{name.slice(0, 1).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.content}>
        <Text numberOfLines={2} style={styles.name}>
          {name}
        </Text>
        <Text style={styles.price}>{formatMoney(currency, price)}</Text>
        {item.id ? (
          <View style={styles.addRow}>
            <QuickAddButton itemId={item.id} name={name} accent={accent} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
  },
  pressed: {
    borderColor: MART.borderStrong,
  },
  imageWell: {
    width: '100%',
    aspectRatio: 1,
    overflow: 'hidden',
    borderTopLeftRadius: RADIUS.md,
    borderTopRightRadius: RADIUS.md,
    backgroundColor: MART.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '84%',
    height: '84%',
  },
  placeholderLetter: {
    ...TYPE.title,
    color: MART.inkQuiet,
  },
  content: {
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.md,
    gap: SPACE.sm,
  },
  name: {
    ...TYPE.label,
    fontWeight: '500',
    color: MART.ink,
    minHeight: 36,
  },
  price: {
    ...TYPE.heading,
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
    color: MART.ink,
  },
  addRow: {
    alignItems: 'flex-end',
  },
});
