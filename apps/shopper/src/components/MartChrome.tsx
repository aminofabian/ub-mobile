import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { phase_15_storefront_public } from '@kiosk/types';
import { MART, type MartPalette } from '../theme/mart';

type Category = phase_15_storefront_public.components['schemas']['PublicCategoryResponse'];

export function MartHomeHeader({
  mart,
  cartCount,
  onCart,
  onAccount,
}: {
  mart: MartPalette;
  cartCount: number;
  onCart: () => void;
  onAccount: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        {mart.logoUrl ? (
          <Image source={{ uri: mart.logoUrl }} style={styles.logo} resizeMode="contain" />
        ) : (
          <View style={[styles.logoFallback, { backgroundColor: mart.primary }]}>
            <Text style={styles.logoMonogram}>pm</Text>
          </View>
        )}
        <View style={styles.brandCopy}>
          <Text numberOfLines={1} style={styles.brandName}>
            {mart.displayName}
          </Text>
          <Text numberOfLines={1} style={styles.tag}>
            Everyday essentials, close to you.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onAccount}
          accessibilityRole="button"
          accessibilityLabel="Account"
          style={styles.iconHit}
        >
          <Ionicons name="log-in-outline" size={22} color={MART.inkMuted} />
        </Pressable>
        <Pressable
          onPress={onCart}
          accessibilityRole="button"
          accessibilityLabel={cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart'}
          style={styles.iconHit}
        >
          <Ionicons name="bag-handle-outline" size={22} color={MART.inkMuted} />
          {cartCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: mart.primary }]}>
              <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

export function MartSearchField({
  primary,
  onPress,
}: {
  primary: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel="Search products"
      style={styles.searchWrap}
    >
      <TextInput
        editable={false}
        pointerEvents="none"
        placeholder="Search products..."
        placeholderTextColor={MART.inkQuiet}
        style={styles.searchInput}
      />
      <View style={[styles.searchBtn, { backgroundColor: primary }]}>
        <Ionicons name="search" size={18} color="#fff" />
      </View>
    </Pressable>
  );
}

export function AisleDealsBar({
  primary,
  categories,
  onSelectCategory,
  onDeals,
}: {
  primary: string;
  categories: Category[];
  onSelectCategory: (category: Category) => void;
  onDeals: () => void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const roots = categories
    .filter((c) => !c.parentId?.trim())
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  const list = roots.length > 0 ? roots : categories;

  return (
    <>
      <View style={[styles.aisleBar, { backgroundColor: primary }]}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Shop by aisle"
          style={styles.aisleBtn}
        >
          <Ionicons name="grid-outline" size={14} color="#fff" />
          <Text style={styles.aisleLabel}>Aisles</Text>
          <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.85)" />
        </Pressable>
        <Pressable
          onPress={onDeals}
          accessibilityRole="button"
          accessibilityLabel="Deals"
          style={styles.dealsBtn}
        >
          <Ionicons name="pricetag-outline" size={14} color="#fff" />
          <Text style={styles.aisleLabel}>Deals</Text>
        </Pressable>
      </View>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
            onPress={() => undefined}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Shop by aisle</Text>
            <ScrollView style={styles.sheetList}>
              {list.map((category) => (
                <Pressable
                  key={category.id ?? category.slug ?? category.name}
                  onPress={() => {
                    setOpen(false);
                    onSelectCategory(category);
                  }}
                  style={styles.sheetRow}
                >
                  <Text style={styles.sheetRowText}>{category.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={MART.inkQuiet} />
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  brand: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 36,
    height: 36,
  },
  logoFallback: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMonogram: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '800',
    color: MART.ink,
  },
  tag: {
    marginTop: 1,
    fontSize: 11,
    color: MART.inkQuiet,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  searchWrap: {
    marginHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: MART.border,
    borderRadius: MART.radius,
    overflow: 'hidden',
    backgroundColor: MART.paperElevated,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    fontSize: 15,
    color: MART.ink,
  },
  searchBtn: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aisleBar: {
    marginTop: 10,
    paddingHorizontal: 12,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aisleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
  },
  aisleLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  dealsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    minHeight: 28,
    borderRadius: MART.radius,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20,24,22,0.4)',
  },
  sheet: {
    maxHeight: '72%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingTop: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: MART.border,
    marginBottom: 12,
  },
  sheetTitle: {
    paddingHorizontal: 16,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '700',
    color: MART.ink,
  },
  sheetList: {
    paddingHorizontal: 8,
  },
  sheetRow: {
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetRowText: {
    fontSize: 15,
    color: MART.ink,
  },
});
