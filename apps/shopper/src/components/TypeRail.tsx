import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CatalogType } from '../api/storefront';
import { categoryIconImageUrl, itemCountLabel } from '../lib/media';
import { ELEVATION, GUTTER, MART, RADIUS, SPACE, TYPE, tint } from '../theme/mart';

function titleCase(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .map((word) =>
      word.length <= 2 && word === word.toUpperCase()
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(' ');
}

function iconForLabel(label: string): React.ComponentProps<typeof Ionicons>['name'] {
  if (/drink|beverage|water|juice|soda|dairy/i.test(label)) return 'cafe-outline';
  if (/house|clean|essent|hygiene|home|household/i.test(label)) return 'sparkles-outline';
  if (/station|office|paper|pen|electronic/i.test(label)) return 'create-outline';
  if (/snack|bite|cookie|candy|bakery|cereal/i.test(label)) return 'fast-food-outline';
  if (/liquor|wine|spirit|alcohol/i.test(label)) return 'wine-outline';
  if (/cloth|fashion|wear|appar|beauty|care|baby/i.test(label)) return 'shirt-outline';
  if (/grocery|general|retail/i.test(label)) return 'basket-outline';
  return 'cube-outline';
}

export function TypeRail({
  types,
  primary,
  selectedId,
  onSelect,
}: {
  types: CatalogType[];
  primary: string;
  selectedId: string | null;
  onSelect: (type: CatalogType) => void;
}) {
  if (types.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {types.map((type) => {
        const selected = selectedId === type.id;
        const image = categoryIconImageUrl(type.icon);
        const label = titleCase(type.label);
        return (
          <Pressable
            key={type.id}
            onPress={() => onSelect(type)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label}, ${itemCountLabel(type.itemCount)}`}
            style={[
              styles.chip,
              selected && { borderColor: primary, backgroundColor: tint(primary, 0.07) },
            ]}
          >
            <View style={[styles.iconWell, { backgroundColor: tint(primary, 0.1) }]}>
              {image ? (
                <Image source={{ uri: image }} style={styles.iconImage} resizeMode="contain" />
              ) : (
                <Ionicons name={iconForLabel(label)} size={20} color={primary} />
              )}
            </View>
            <View style={styles.copy}>
              <Text numberOfLines={1} style={styles.label}>
                {label}
              </Text>
              <Text style={styles.count}>{itemCountLabel(type.itemCount)}</Text>
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 56,
    paddingVertical: SPACE.sm,
    paddingLeft: SPACE.sm,
    paddingRight: SPACE.md,
    borderRadius: RADIUS.md,
    maxWidth: 190,
    ...ELEVATION.ruled,
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: {
    width: 30,
    height: 30,
  },
  copy: {
    minWidth: 0,
    flexShrink: 1,
  },
  label: {
    ...TYPE.label,
    color: MART.ink,
  },
  count: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
});
