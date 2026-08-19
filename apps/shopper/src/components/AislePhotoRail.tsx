import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { phase_15_storefront_public } from '@kiosk/types';
import { categoryIconImageUrl, itemCountLabel } from '../lib/media';
import { GUTTER, MART, RADIUS, SPACE, TYPE, tint } from '../theme/mart';

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
        const shade = index % 2 === 0 ? primary : accent;
        const image = categoryIconImageUrl(aisle.icon);
        const name = aisle.name ?? 'Aisle';
        return (
          <Pressable
            key={aisle.id ?? aisle.slug ?? name}
            onPress={() => onSelect(aisle)}
            accessibilityRole="button"
            accessibilityLabel={`${name}${aisle.itemCount != null ? `, ${itemCountLabel(aisle.itemCount)}` : ''}`}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          >
            <View style={[styles.fill, { backgroundColor: tint(shade, 0.85) }]}>
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
    paddingHorizontal: GUTTER,
    gap: SPACE.sm,
  },
  tile: {
    width: 116,
    height: 116,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: MART.border,
  },
  pressed: {
    opacity: 0.86,
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
    height: 62,
    backgroundColor: 'rgba(9,14,11,0.68)',
  },
  caption: {
    position: 'absolute',
    left: SPACE.sm,
    right: SPACE.sm,
    bottom: SPACE.sm,
  },
  name: {
    ...TYPE.shelf,
    color: '#ffffff',
  },
  count: {
    ...TYPE.shelf,
    marginTop: SPACE.xxs,
    fontWeight: '500',
    letterSpacing: 0.2,
    color: 'rgba(255,255,255,0.82)',
  },
});
