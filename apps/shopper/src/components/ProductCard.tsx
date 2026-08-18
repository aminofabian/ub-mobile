import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { phase_15_storefront_public } from '@kiosk/types';
import { MART } from '../theme/mart';
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
          <View style={styles.placeholder}>
            <Text style={styles.placeholderLetter}>{name.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text numberOfLines={2} style={styles.name}>
          {name}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.price}>{formatMoney(currency, price)}</Text>
          {item.id ? (
            <QuickAddButton itemId={item.id} name={name} accent={accent} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: MART.paperElevated,
    borderRadius: MART.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: MART.border,
  },
  pressed: {
    opacity: 0.92,
  },
  imageWell: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: MART.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '88%',
    height: '88%',
  },
  placeholder: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: MART.inkQuiet,
  },
  content: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
  },
  name: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: MART.ink,
    minHeight: 36,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  price: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: MART.ink,
  },
});
