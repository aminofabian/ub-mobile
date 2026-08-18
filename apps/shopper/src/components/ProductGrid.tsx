import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { phase_15_storefront_public } from '@kiosk/types';
import { MART } from '../theme/mart';
import { ProductCard } from './ProductCard';

type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];

interface ProductGridProps {
  title?: string;
  items: Item[];
  currency?: string;
  accent?: string;
  shownCount?: number;
  totalCount?: number | null;
  onItemPress: (item: Item) => void;
}

export function ProductGrid({
  title = 'Featured',
  items,
  currency = 'KES',
  accent,
  shownCount,
  totalCount,
  onItemPress,
}: ProductGridProps) {
  const shown = shownCount ?? items.length;
  const total = totalCount ?? shown;

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.sort}>{title}</Text>
        <Text style={styles.count}>
          {shown} of {total}
        </Text>
      </View>
      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.id ?? item.name ?? ''} style={styles.itemWrapper}>
            <ProductCard
              item={item}
              currency={currency}
              accent={accent}
              onPress={onItemPress}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  toolbar: {
    marginHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sort: {
    fontSize: 14,
    fontWeight: '600',
    color: MART.ink,
  },
  count: {
    fontSize: 12,
    color: MART.inkQuiet,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  itemWrapper: {
    width: '50%',
    padding: 4,
  },
});
