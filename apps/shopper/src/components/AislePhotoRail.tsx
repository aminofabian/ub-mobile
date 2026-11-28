import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { phase_15_storefront_public } from '@kiosk/types';
import { aisleIcon, titleCase } from '../lib/aisle-icon';
import { categoryIconImageUrl, itemCountLabel } from '../lib/media';
import { GUTTER, MART, SPACE, TYPE, zoneFor } from '../theme/mart';
import { PressScale } from './Capsule';
import { Lobe, LobeFrame, lobeIndex } from './Coast';

type Category = phase_15_storefront_public.components['schemas']['PublicCategoryResponse'] & {
  itemCount?: number;
};

const LOBE = 92;

function rootAisles(categories: Category[]): Category[] {
  const roots = categories.filter((c) => !c.parentId?.trim());
  return (roots.length > 0 ? roots : categories).slice().sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? '')
  );
}

/**
 * The aisles, drawn the way a guide map draws its areas: each one a lobe in its own zone colour. An
 * aisle keeps that colour and outline on every screen. A photograph, where the shop has one, is cropped
 * to the lobe.
 */
export function AislePhotoRail({
  categories,
  onSelect,
  ground = MART.paper,
}: {
  categories: Category[];
  onSelect: (category: Category) => void;
  /** The colour behind the rail, which photographs are cropped against. */
  ground?: string;
  /** Kept so callers written for the old rail still compile. Aisles take zone colours now. */
  primary?: string;
  accent?: string;
}) {
  const aisles = rootAisles(categories);
  if (aisles.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {aisles.map((aisle) => {
        const key = aisle.id ?? aisle.slug ?? aisle.name ?? '';
        const image = categoryIconImageUrl(aisle.icon);
        const name = titleCase(aisle.name ?? 'Category');
        const shape = lobeIndex(key);
        return (
          <PressScale
            key={key}
            to={0.94}
            onPress={() => onSelect(aisle)}
            accessibilityRole="button"
            accessibilityLabel={`${name}${aisle.itemCount != null ? `, ${itemCountLabel(aisle.itemCount)}` : ''}`}
            style={styles.aisle}
          >
            <Lobe color={zoneFor(key)} size={LOBE} shape={shape}>
              {image ? (
                <>
                  <Image source={{ uri: image }} style={styles.photo} contentFit="cover" transition={180} />
                  <LobeFrame size={LOBE} shape={shape} ground={ground} />
                </>
              ) : (
                <Ionicons name={aisleIcon(name)} size={34} color={MART.ink} />
              )}
            </Lobe>
            <Text numberOfLines={2} style={styles.name}>
              {name}
            </Text>
          </PressScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: GUTTER,
    gap: SPACE.md,
  },
  aisle: {
    width: LOBE,
    alignItems: 'center',
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  name: {
    ...TYPE.label,
    marginTop: SPACE.sm,
    textAlign: 'center',
    color: MART.ink,
  },
});
