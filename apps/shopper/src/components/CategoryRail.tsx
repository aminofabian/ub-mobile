import React from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@kiosk/ui';
import { phase_15_storefront_public } from '@kiosk/types';

type Category = phase_15_storefront_public.components['schemas']['PublicCategoryResponse'];

interface CategoryRailProps {
  categories: Category[];
  onSelect: (category: Category) => void;
}

export function CategoryRail({ categories, onSelect }: CategoryRailProps) {
  return (
    <View style={styles.container}>
      <Text variant="h2" style={styles.title}>
        Categories
      </Text>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id ?? item.slug ?? item.name ?? ''}
        horizontal
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chip}
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
          >
            <Text style={styles.chipText}>{item.icon ? `${item.icon} ` : ''}{item.name}</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 12,
  },
  chip: {
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#dee2e6',
    minHeight: 44,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
