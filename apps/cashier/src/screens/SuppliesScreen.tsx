import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ApiClient } from '@kiosk/core';
import { GUTTER, MART, RADIUS, SPACE, tint, MartText } from '@kiosk/staff';
import { fetchSupplierProducts, fetchSuppliers, type Supplier } from '../api/pos-api';
import { realSuppliers } from '../lib/supplier-words';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Supplies'> & {
  api: ApiClient;
  branchId: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Start a supply: find the supplier who brought it. The search matches a supplier's name, and — because a cashier
 * often knows the goods, not the company — also the names of the products a supplier is linked to. Picking one opens
 * the supply entry for their products.
 */
export function SuppliesScreen({ api, branchId, navigation }: Props) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState<Supplier[] | null>(null);
  const [byProduct, setByProduct] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  // The full supplier list, read once; the name filter runs over it on the phone for an instant feel.
  useEffect(() => {
    let alive = true;
    fetchSuppliers(api).then((list) => alive && setAll(realSuppliers(list)), () => alive && setAll([]));
    return () => {
      alive = false;
    };
  }, [api]);

  // When the typed text matches no supplier by name, look for suppliers whose products match it, so searching by the
  // goods ("milk", "soda") finds the company. Debounced, and only when a name match is thin.
  useEffect(() => {
    const term = query.trim().toLowerCase();
    if (!term || !all) {
      setByProduct(new Set());
      return;
    }
    const nameHits = all.filter((s) => s.name.toLowerCase().includes(term)).length;
    if (nameHits >= 3) {
      setByProduct(new Set());
      return;
    }
    const mine = ++seq.current;
    setSearching(true);
    const timer = setTimeout(() => {
      void (async () => {
        const matched = new Set<string>();
        // Look across suppliers' products in small parallel batches so a long list does not block.
        await Promise.all(
          all.map(async (s) => {
            try {
              const products = await fetchSupplierProducts(api, s.id);
              if (products.some((p) => p.itemName.toLowerCase().includes(term))) matched.add(s.id);
            } catch {
              // A supplier whose products cannot be read just does not match by product.
            }
          })
        );
        if (mine === seq.current) {
          setByProduct(matched);
          setSearching(false);
        }
      })();
    }, 350);
    return () => clearTimeout(timer);
  }, [query, all, api]);

  const shown = useMemo(() => {
    if (!all) return [];
    const term = query.trim().toLowerCase();
    if (!term) return all;
    return all.filter((s) => s.name.toLowerCase().includes(term) || byProduct.has(s.id));
  }, [all, query, byProduct]);

  const open = useCallback(
    (supplier: Supplier) => navigation.navigate('SupplyEntry', { supplierId: supplier.id, supplierName: supplier.name }),
    [navigation]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={MART.inkQuiet} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Supplier name, or what they supply"
          placeholderTextColor={MART.inkQuiet}
          autoCapitalize="none"
          style={styles.searchInput}
          accessibilityLabel="Search suppliers"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={MART.inkQuiet} />
          </Pressable>
        ) : null}
      </View>
      {searching ? (
        <MartText variant="meta" color={MART.inkQuiet} style={styles.searchingNote}>
          Looking for suppliers of “{query.trim()}”…
        </MartText>
      ) : null}

      <FlatList
        data={shown}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          all === null ? (
            <View style={styles.center}>
              <ActivityIndicator color={MART.fallbackPrimary} />
            </View>
          ) : (
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={26} color={MART.inkQuiet} />
              </View>
              <MartText variant="heading" style={styles.centerText}>
                {query ? 'No supplier found' : 'No suppliers yet'}
              </MartText>
              <MartText variant="meta" color={MART.inkQuiet} style={styles.centerText}>
                {query ? 'Try the company name, or add the supplier from Add product.' : 'Suppliers you add show here.'}
              </MartText>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={[styles.avatar, { backgroundColor: tint(MART.fallbackPrimary, 0.12) }]}>
              <MartText variant="label" color={MART.fallbackPrimary}>
                {initials(item.name)}
              </MartText>
            </View>
            <View style={{ flex: 1 }}>
              <MartText variant="heading" numberOfLines={1}>
                {item.name}
              </MartText>
              {byProduct.has(item.id) ? (
                <MartText variant="meta" color={MART.fallbackPrimary} numberOfLines={1}>
                  supplies “{query.trim()}”
                </MartText>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={MART.inkQuiet} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    margin: GUTTER,
    marginBottom: SPACE.sm,
    paddingHorizontal: SPACE.md,
    minHeight: 50,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
  },
  searchInput: { flex: 1, fontSize: 15, color: MART.ink },
  searchingNote: { paddingHorizontal: GUTTER, marginBottom: SPACE.sm },
  list: { paddingHorizontal: GUTTER, paddingBottom: SPACE.xxxl, gap: SPACE.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  rowPressed: { backgroundColor: MART.paperSunken },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.xxxl, gap: SPACE.sm },
  centerText: { textAlign: 'center' },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.xs,
  },
});
