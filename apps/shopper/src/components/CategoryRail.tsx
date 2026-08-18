import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { phase_15_storefront_public } from '@kiosk/types';
import { categoryIconImageUrl } from '../lib/media';
import { MART } from '../theme/mart';

type Category = phase_15_storefront_public.components['schemas']['PublicCategoryResponse'];

interface CategoryRailProps {
  categories: Category[];
  onSelect: (category: Category) => void;
}

export function CategoryRail({ categories, onSelect }: CategoryRailProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Categories</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {categories.map((item) => {
          const image = categoryIconImageUrl(item.icon);
          const emoji = !image && item.icon?.trim() ? item.icon.trim() : null;
          return (
            <Pressable
              key={item.id ?? item.slug ?? item.name ?? ''}
              style={styles.chip}
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={item.name}
            >
              {image ? (
                <Image source={{ uri: image }} style={styles.icon} resizeMode="cover" />
              ) : emoji ? (
                <Text style={styles.emoji}>{emoji}</Text>
              ) : (
                <Ionicons name="grid-outline" size={16} color={MART.inkMuted} />
              )}
              <Text style={styles.chipText}>{item.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
    fontSize: 18,
    fontWeight: '700',
    color: MART.ink,
  },
  listContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: MART.paper,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: MART.border,
    minHeight: 44,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  emoji: {
    fontSize: 16,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: MART.ink,
  },
});
