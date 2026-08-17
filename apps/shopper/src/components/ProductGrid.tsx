import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Text } from '@kiosk/ui';
import { phase_15_storefront_public } from '@kiosk/types';
import { ProductCard } from './ProductCard';

type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];

interface ProductGridProps {
  title: string;
  items: Item[];
  currency?: string;
  onItemPress: (item: Item) => void;
}

export function ProductGrid({ title, items, currency = 'KES', onItemPress }: ProductGridProps) {
  return (
    <View style={styles.container}>
      <Text variant="h2" style={styles.title}>
        {title}
      </Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id ?? item.name ?? ''}
        numColumns={2}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.itemWrapper}>
            <ProductCard item={item} currency={currency} onPress={onItemPress} />
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  title: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 10,
  },
  itemWrapper: {
    width: '50%',
  },
});
