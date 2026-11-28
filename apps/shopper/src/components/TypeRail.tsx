import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { CatalogType } from '../api/storefront';
import { titleCase } from '../lib/aisle-icon';
import { stepFeel } from '../lib/haptics';
import { itemCountLabel } from '../lib/media';
import { FONT, GUTTER, MART, onFill, RADIUS, SPACE, TYPE } from '../theme/mart';

/**
 * Departments, as a row of filter capsules above the shelf they filter. The chosen one fills with the
 * shop's colour; tapping it again clears it.
 */
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
  const on = onFill(primary);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {types.map((type) => {
        const selected = selectedId === type.id;
        const label = titleCase(type.label);
        return (
          <Pressable
            key={type.id}
            onPress={() => {
              stepFeel();
              onSelect(type);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label}, ${itemCountLabel(type.itemCount)}`}
            style={({ pressed }) => [
              styles.chip,
              selected && { backgroundColor: primary, borderColor: primary },
              pressed && styles.pressed,
            ]}
          >
            <Text numberOfLines={1} style={[styles.label, selected && { color: on.primary }]}>
              {label}
            </Text>
            <Text style={[styles.count, selected && { color: on.secondary }]}>{type.itemCount}</Text>
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
    minHeight: 44,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: MART.ink,
    maxWidth: 220,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...TYPE.label,
    flexShrink: 1,
    color: MART.ink,
  },
  count: {
    ...TYPE.meta,
    fontFamily: FONT.medium,
    color: MART.inkQuiet,
  },
});
