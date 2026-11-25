import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SPACE } from '@kiosk/staff';
import type { Category } from '../api/pos-api';
import { CashierChip } from './CashierPrimitives';

type Props = {
  categories: Category[];
  /** The chosen category id, or null for "All". */
  selected: string | null;
  onSelect: (id: string | null) => void;
};

/**
 * A horizontal strip of category chips above the product grid. "All" clears the filter; tapping a category reads the
 * grid again showing only that category (and anything filed under it). It scrolls sideways so a long category list
 * never pushes the grid down.
 */
export function CategoryFilter({ categories, selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.strip}
      keyboardShouldPersistTaps="handled"
    >
      <CashierChip label="All" selected={selected === null} onPress={() => onSelect(null)} />
      {categories.map((c) => (
        <CashierChip key={c.id} label={c.name} selected={selected === c.id} onPress={() => onSelect(c.id)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // A fixed height so the strip never grows vertically or reflows when a chip is tapped.
  strip: { flexGrow: 0, flexShrink: 0, height: 60 },
  row: { alignItems: 'center', paddingHorizontal: SPACE.md, gap: SPACE.sm },
});
