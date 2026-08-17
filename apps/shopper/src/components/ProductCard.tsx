import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@kiosk/ui';
import { phase_15_storefront_public } from '@kiosk/types';

type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];

interface ProductCardProps {
  item: Item;
  currency?: string;
  onPress: (item: Item) => void;
}

export function ProductCard({ item, currency = 'KES', onPress }: ProductCardProps) {
  const price = item.price ?? 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${currency} ${price}`}
    >
      <Image
        source={{ uri: item.imageUrl ?? undefined }}
        style={styles.image}
        resizeMode="cover"
        accessibilityLabel={item.name ?? 'Product image'}
      />
      <View style={styles.content}>
        <Text numberOfLines={2} style={styles.name}>
          {item.name}
        </Text>
        <Text style={styles.price}>
          {currency} {price.toFixed(2)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#dee2e6',
    margin: 6,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    minHeight: 40,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#28a745',
  },
});
