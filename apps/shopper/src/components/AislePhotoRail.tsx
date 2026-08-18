import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { phase_15_storefront_public } from '@kiosk/types';
import { categoryIconImageUrl, itemCountLabel } from '../lib/media';
import { MART } from '../theme/mart';

type Category = phase_15_storefront_public.components['schemas']['PublicCategoryResponse'] & {
  itemCount?: number;
};

function rootAisles(categories: Category[]): Category[] {
  const roots = categories.filter((c) => !c.parentId?.trim());
  return (roots.length > 0 ? roots : categories).slice().sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '')
  );
}

export function AislePhotoRail({
  categories,
  primary,
  accent,
  onSelect,
}: {
  categories: Category[];
  primary: string;
  accent: string;
  onSelect: (category: Category) => void;
}) {
  const aisles = rootAisles(categories);
  if (aisles.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {aisles.map((aisle, index) => {
        const tint = index % 2 === 0 ? primary : accent;
        const image = categoryIconImageUrl(aisle.icon);
        const name = aisle.name ?? 'Aisle';
        return (
          <Pressable
            key={aisle.id ?? aisle.slug ?? name}
            onPress={() => onSelect(aisle)}
            accessibilityRole="button"
            accessibilityLabel={`${name}${aisle.itemCount != null ? `, ${itemCountLabel(aisle.itemCount)}` : ''}`}
            style={styles.tile}
          >
            <View style={[styles.fill, { backgroundColor: `${tint}99` }]}>
              {image ? (
                <Image source={{ uri: image }} style={styles.photo} resizeMode="cover" />
              ) : null}
              <View style={styles.scrim} />
              <View style={styles.caption}>
                <Text numberOfLines={2} style={styles.name}>
                  {name.toUpperCase()}
                </Text>
                {typeof aisle.itemCount === 'number' ? (
                  <Text style={styles.count}>{itemCountLabel(aisle.itemCount)}</Text>
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    gap: 6,
  },
  tile: {
    width: 108,
    height: 108,
    borderRadius: MART.radius,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: MART.border,
  },
  fill: {
    flex: 1,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 58,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  caption: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
  },
  name: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  count: {
    marginTop: 1,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
  },
});
