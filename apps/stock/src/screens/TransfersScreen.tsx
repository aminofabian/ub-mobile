import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Button, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { createTransfer, searchItems, type StockItem } from '../api/stock-api';

function itemLabel(item: StockItem): string {
  const name = item.name?.trim() || 'Product';
  return item.variantName?.trim() ? `${name} · ${item.variantName.trim()}` : name;
}

function itemMeta(item: StockItem): string {
  const parts: string[] = [];
  if (item.sku?.trim()) parts.push(`SKU ${item.sku.trim()}`);
  if (item.barcode?.trim()) parts.push(item.barcode.trim());
  return parts.join(' · ') || 'No SKU';
}

export function TransfersScreen({ api, branchId }: { api: ApiClient; branchId: string }) {
  const [destBranchId, setDestBranchId] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<StockItem | null>(null);
  const [results, setResults] = useState<StockItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const searchGen = useRef(0);

  useEffect(() => {
    if (selected) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    const gen = ++searchGen.current;
    setSearching(true);
    const t = setTimeout(() => {
      void searchItems(api, { search: q, size: 8 })
        .then((items) => {
          if (gen !== searchGen.current) return;
          setResults(items);
          setSearched(true);
        })
        .catch(() => {
          if (gen !== searchGen.current) return;
          setResults([]);
          setSearched(true);
        })
        .finally(() => {
          if (gen === searchGen.current) setSearching(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [api, query, selected]);

  const clearSelection = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  const submit = async () => {
    const toBranchId = destBranchId.trim();
    const qty = Number(quantity);
    if (!toBranchId) {
      Alert.alert('Missing branch', 'Enter a destination branch ID');
      return;
    }
    if (!selected?.id) {
      Alert.alert('Missing product', 'Search and select a product to transfer');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Invalid quantity', 'Enter a quantity greater than zero');
      return;
    }
    if (toBranchId === branchId) {
      Alert.alert('Same branch', 'Destination must differ from the source branch');
      return;
    }

    setLoading(true);
    try {
      await createTransfer(api, {
        fromBranchId: branchId,
        toBranchId,
        lines: [{ itemId: selected.id, quantity: qty }],
      });
      Alert.alert('Transfer created');
      setDestBranchId('');
      clearSelection();
      setQuantity('1');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="h1">Create transfer</Text>

      <TextInput
        style={styles.input}
        placeholder="Destination branch ID"
        value={destBranchId}
        onChangeText={setDestBranchId}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Destination branch ID"
      />

      {selected ? (
        <View style={styles.selectedRow}>
          <View style={styles.selectedText}>
            <Text variant="body">{itemLabel(selected)}</Text>
            <Text variant="muted">{itemMeta(selected)}</Text>
          </View>
          <Pressable
            onPress={clearSelection}
            accessibilityRole="button"
            accessibilityLabel="Change product"
            style={styles.clearBtn}
          >
            <Text variant="body">Change</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.searchBlock}>
          <TextInput
            style={styles.input}
            placeholder="Search by name, SKU or barcode"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search products by name, SKU or barcode"
          />
          {searching ? (
            <View style={styles.searchStatus}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text variant="muted">Searching…</Text>
            </View>
          ) : null}
          {!searching && query.trim().length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.results}
              ListEmptyComponent={
                searched ? (
                  <Text variant="muted" style={styles.empty}>
                    No matching products.
                  </Text>
                ) : null
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.resultRow}
                  onPress={() => {
                    setSelected(item);
                    setQuery('');
                    setResults([]);
                    setSearched(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${itemLabel(item)}`}
                >
                  <Text variant="body">{itemLabel(item)}</Text>
                  <Text variant="muted">{itemMeta(item)}</Text>
                </Pressable>
              )}
            />
          ) : null}
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="Quantity"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
        accessibilityLabel="Quantity"
      />
      <Button title={loading ? 'Saving...' : 'Create transfer'} onPress={submit} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background, gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
    backgroundColor: theme.colors.surface,
  },
  searchBlock: { gap: 8 },
  searchStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  results: {
    maxHeight: 220,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },
  resultRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    gap: 2,
  },
  empty: { padding: 12 },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: theme.colors.surface,
  },
  selectedText: { flex: 1, gap: 2 },
  clearBtn: { paddingVertical: 4, paddingHorizontal: 8 },
});
