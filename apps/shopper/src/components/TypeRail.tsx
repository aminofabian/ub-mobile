import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CatalogType } from '../api/storefront';
import { categoryIconImageUrl, itemCountLabel } from '../lib/media';
import { MART } from '../theme/mart';

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
              selected && { borderColor: `${primary}4D`, backgroundColor: `${primary}12` },
            ]}
          >
            <View
              style={[
                styles.iconWell,
                { backgroundColor: selected ? `${primary}1F` : `${primary}17` },
              ]}
            >
              {image ? (
                <Image source={{ uri: image }} style={styles.iconImage} resizeMode="contain" />
              ) : (
                <Ionicons name={iconForLabel(label)} size={22} color={primary} />
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
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
    borderRadius: MART.radius,
    maxWidth: 168,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: MART.radius,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: {
    width: 32,
    height: 32,
  },
  copy: {
    minWidth: 0,
    paddingRight: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: MART.ink,
  },
  count: {
    marginTop: 2,
    fontSize: 10,
    color: MART.inkQuiet,
  },
});
