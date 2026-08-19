import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Button, Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { cache } from '@kiosk/offline';
import {
  addPurchaseOrderLine,
  createPurchaseOrder,
  fetchSupplierItemLinks,
  fetchSuppliers,
  sendPurchaseOrder,
  sendPurchaseOrderToSupplier,
  type SupplierItemLinkRecord,
  type SupplierRecord,
} from '../api/purchasing';
import { formatMoney, toNum } from '../lib/format';

type CartQty = Record<string, number>;

function unitCost(link: SupplierItemLinkRecord): number {
  const candidates = [link.lastCostPrice, link.defaultCostPrice, link.catalogBuyingPrice];
  for (const c of candidates) {
    const n = toNum(c);
    if (n > 0) return n;
  }
  return 0;
}

function linkParentId(link: SupplierItemLinkRecord): string {
  const variantOf = link.variantOfItemId?.trim();
  if (variantOf) return variantOf;
  const parentName = link.parentItemName?.trim();
  if (parentName) return `name:${parentName.toLowerCase().trim()}`;
  const name = link.itemName?.trim() || '';
  const sep = name.indexOf(' · ');
  if (sep > 0) return `name:${name.slice(0, sep).toLowerCase().trim()}`;
  if (name) return `name:${name.toLowerCase().trim()}`;
  return link.itemId;
}

function linkParentLabel(link: SupplierItemLinkRecord): string {
  const parent = link.parentItemName?.trim();
  if (parent) return parent;
  const name = link.itemName?.trim() || link.sku?.trim() || 'Product';
  const sep = name.indexOf(' · ');
  return sep > 0 ? name.slice(0, sep) : name;
}

type Family = {
  id: string;
  label: string;
  links: SupplierItemLinkRecord[];
  lowStockCount: number;
};

export function OrdersScreen({ api, branchId }: { api: ApiClient; branchId: string }) {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [links, setLinks] = useState<SupplierItemLinkRecord[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [filter, setFilter] = useState('');
  const [parentFilterId, setParentFilterId] = useState<string | null>(null);
  const [cartsBySupplier, setCartsBySupplier] = useState<Record<string, CartQty>>({});
  const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // The active cart is always the selected supplier's entry in the shared map,
  // so switching suppliers can never leak or clobber another supplier's draft.
  const cart = cartsBySupplier[supplierId ?? ''] ?? {};

  const draftKey = useMemo(() => `stock/order-carts/${branchId}`, [branchId]);

  // Restore draft carts per supplier.
  useEffect(() => {
    let cancelled = false;
    void cache
      .get<Record<string, CartQty>>(draftKey)
      .then((draft) => {
        if (cancelled) return;
        setCartsBySupplier(draft ?? {});
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [draftKey]);

  // Load suppliers (active only, mirroring the web workspace).
  useEffect(() => {
    let cancelled = false;
    setLoadingSuppliers(true);
    void fetchSuppliers(api)
      .then((rows) => {
        if (cancelled) return;
        const active = rows.filter(
          (s) => s.status?.toLowerCase() === 'active' && !s.deletedAt
        );
        setSuppliers(active);
        setSupplierId((current) => {
          if (current && active.some((s) => s.id === current)) return current;
          return active[0]?.id ?? null;
        });
      })
      .catch((error) => {
        if (!cancelled) {
          Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load suppliers');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSuppliers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  // Load item links for the selected supplier.
  useEffect(() => {
    if (!supplierId) {
      setLinks([]);
      return;
    }
    let cancelled = false;
    setLoadingLinks(true);
    void fetchSupplierItemLinks(api, supplierId, { branchId })
      .then((rows) => {
        if (!cancelled) setLinks(rows.filter((r) => r.active));
      })
      .catch((error) => {
        if (!cancelled) {
          setLinks([]);
          Alert.alert('Error', error instanceof Error ? error.message : 'Failed to load products');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLinks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId, api, branchId]);

  useEffect(() => {
    setParentFilterId(null);
  }, [supplierId]);

  // Persist draft carts whenever they change.
  useEffect(() => {
    if (!hydrated) return;
    void cache.set(draftKey, cartsBySupplier).catch(() => {});
  }, [cartsBySupplier, hydrated, draftKey]);

  const selectSupplier = (nextId: string) => {
    if (nextId === supplierId) {
      setSupplierPickerOpen(false);
      return;
    }
    setSupplierId(nextId);
    setSupplierPickerOpen(false);
  };

  const activeSupplier = suppliers.find((s) => s.id === supplierId) ?? null;

  const filteredSuppliers = useMemo(() => {
    const q = supplierQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => s.name.toLowerCase().includes(q));
  }, [suppliers, supplierQuery]);

  const families = useMemo(() => {
    const map = new Map<string, Family>();
    for (const link of links) {
      const id = linkParentId(link);
      const existing = map.get(id);
      const stock = toNum(link.currentStock);
      const reorder = toNum(link.reorderLevel);
      const low = reorder > 0 && stock <= reorder;
      if (existing) {
        existing.links.push(link);
        if (low) existing.lowStockCount += 1;
      } else {
        map.set(id, {
          id,
          label: linkParentLabel(link),
          links: [link],
          lowStockCount: low ? 1 : 0,
        });
      }
    }
    return [...map.values()];
  }, [links]);

  const visibleFamilies = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let rows = families;
    if (q) {
      rows = families
        .map((f) => ({
          ...f,
          links: f.links.filter(
            (l) =>
              l.itemName.toLowerCase().includes(q) ||
              l.sku.toLowerCase().includes(q) ||
              (l.barcode ?? '').toLowerCase().includes(q)
          ),
        }))
        .filter((f) => f.links.length > 0);
    }
    if (parentFilterId) {
      rows = rows.filter((f) => f.id === parentFilterId);
    }
    return rows;
  }, [families, filter, parentFilterId]);

  const sections = useMemo(
    () => visibleFamilies.map((f) => ({ title: f.label, data: f.links })),
    [visibleFamilies]
  );

  const cartLines = useMemo(
    () =>
      links
        .filter((l) => (cart[l.itemId] ?? 0) > 0)
        .map((l) => ({ link: l, qty: cart[l.itemId] ?? 0 })),
    [links, cart]
  );

  const cartUnits = cartLines.reduce((sum, line) => sum + line.qty, 0);
  const cartTotal = cartLines.reduce((sum, line) => sum + unitCost(line.link) * line.qty, 0);

  const setQty = (itemId: string, qty: number) => {
    setCartsBySupplier((prevMap) => {
      const current = { ...(prevMap[supplierId ?? ''] ?? {}) };
      if (qty <= 0) delete current[itemId];
      else current[itemId] = qty;
      const next = { ...prevMap };
      if (Object.keys(current).length === 0) delete next[supplierId ?? ''];
      else next[supplierId ?? ''] = current;
      return next;
    });
  };

  const placeOrder = async () => {
    if (!supplierId || !activeSupplier) {
      Alert.alert('Missing supplier', 'Pick a supplier first.');
      return;
    }
    if (!branchId.trim()) {
      Alert.alert('Missing branch', 'Select a branch before ordering.');
      return;
    }
    if (cartLines.length === 0) {
      Alert.alert('Empty order', 'Add products to the order.');
      return;
    }
    setPlacing(true);
    try {
      const po = await createPurchaseOrder(api, {
        supplierId,
        branchId: branchId.trim(),
        notes: notes.trim() || 'Created from Order mobile',
      });
      for (const line of cartLines) {
        await addPurchaseOrderLine(api, po.id, {
          itemId: line.link.itemId,
          qtyOrdered: line.qty,
          unitEstimatedCost: unitCost(line.link),
        });
      }
      try {
        await sendPurchaseOrderToSupplier(api, po.id);
      } catch {
        await sendPurchaseOrder(api, po.id);
      }
      setCartsBySupplier((prevMap) => {
        const next = { ...prevMap };
        delete next[supplierId];
        return next;
      });
      setCartOpen(false);
      Alert.alert(
        'Order placed',
        `Order ${po.poNumber} placed — confirm when goods arrive.`
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not place order');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Supplier selector */}
      <Pressable
        style={styles.supplierBar}
        onPress={() => setSupplierPickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Choose supplier"
      >
        <View style={styles.supplierBarText}>
          <Text variant="caption" style={styles.supplierLabel}>
            Supplier
          </Text>
          <Text variant="body" style={styles.supplierName}>
            {activeSupplier?.name ?? (loadingSuppliers ? 'Loading…' : 'No suppliers')}
          </Text>
        </View>
        <Text variant="body" style={styles.supplierCaret}>
          ▾
        </Text>
      </Pressable>

      {/* Search + family chips */}
      <TextInput
        style={styles.search}
        placeholder="Search products or SKU"
        value={filter}
        onChangeText={setFilter}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {families.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chips}
          contentContainerStyle={styles.chipsContent}
        >
          <Chip
            label="All"
            lowCount={null}
            active={parentFilterId === null}
            onPress={() => setParentFilterId(null)}
          />
          {families.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              lowCount={f.lowStockCount}
              active={parentFilterId === f.id}
              onPress={() => setParentFilterId(f.id === parentFilterId ? null : f.id)}
            />
          ))}
        </ScrollView>
      )}

      {/* Item list grouped by family */}
      {loadingLinks || loadingSuppliers ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.center}>
          <Text variant="muted">
            {links.length === 0 ? 'No products linked to this supplier' : 'No matching products'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.itemId}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text variant="caption" style={styles.sectionTitle}>
                {section.title}
              </Text>
              <Text variant="muted">{section.data.length}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ItemRow
              link={item}
              qty={cart[item.itemId] ?? 0}
              onChange={(qty) => setQty(item.itemId, qty)}
            />
          )}
          ListFooterComponent={<View style={{ height: 96 }} />}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Cart summary bar */}
      {cartUnits > 0 && (
        <View style={styles.cartBar}>
          <View>
            <Text variant="body" style={styles.cartBarQty}>
              {cartUnits} {cartUnits === 1 ? 'item' : 'items'}
            </Text>
            <Text variant="caption" style={styles.cartBarTotal}>
              {formatMoney(cartTotal)}
            </Text>
          </View>
          <Button title="Review order" onPress={() => setCartOpen(true)} />
        </View>
      )}

      {/* Supplier picker */}
      <Modal
        visible={supplierPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSupplierPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text variant="h2">Choose supplier</Text>
              <Pressable onPress={() => setSupplierPickerOpen(false)} accessibilityRole="button">
                <Text variant="body" style={styles.modalClose}>
                  Close
                </Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.search}
              placeholder="Search suppliers"
              value={supplierQuery}
              onChangeText={setSupplierQuery}
              autoCorrect={false}
            />
            <FlatList
              data={filteredSuppliers}
              keyExtractor={(s) => s.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.supplierRow}
                  onPress={() => selectSupplier(item.id)}
                  accessibilityRole="button"
                >
                  <View style={styles.supplierRowText}>
                    <Text variant="body">{item.name}</Text>
                    {item.code ? <Text variant="muted">{item.code}</Text> : null}
                  </View>
                  {item.id === supplierId ? (
                    <Text variant="body" style={styles.check}>
                      ✓
                    </Text>
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text variant="muted">No suppliers</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Cart review */}
      <Modal
        visible={cartOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCartOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text variant="h2">Review order</Text>
              <Pressable onPress={() => setCartOpen(false)} accessibilityRole="button">
                <Text variant="body" style={styles.modalClose}>
                  Close
                </Text>
              </Pressable>
            </View>
            <Text variant="caption" style={styles.cartSupplier}>
              {activeSupplier?.name ?? 'Supplier'}
            </Text>
            <FlatList
              data={cartLines}
              keyExtractor={(line) => line.link.itemId}
              renderItem={({ item }) => (
                <Card style={styles.cartLineCard}>
                  <View style={styles.cartLineInfo}>
                    <Text variant="body" numberOfLines={1}>
                      {item.link.itemName}
                    </Text>
                    <Text variant="muted">
                      {formatMoney(unitCost(item.link))} × {item.qty} ={' '}
                      {formatMoney(unitCost(item.link) * item.qty)}
                    </Text>
                  </View>
                  <Stepper
                    qty={item.qty}
                    onChange={(qty) => setQty(item.link.itemId, qty)}
                  />
                </Card>
              )}
              style={styles.cartLines}
            />
            <TextInput
              style={styles.notes}
              placeholder="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <View style={styles.cartFooter}>
              <View>
                <Text variant="caption">Total</Text>
                <Text variant="h2">{formatMoney(cartTotal)}</Text>
              </View>
              <Button
                title={placing ? 'Placing…' : 'Place order'}
                onPress={() => void placeOrder()}
                disabled={placing || cartLines.length === 0}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Chip({
  label,
  lowCount,
  active,
  onPress,
}: {
  label: string;
  lowCount: number | null;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text
        variant="caption"
        style={
          active
            ? { ...styles.chipLabel, ...styles.chipLabelActive }
            : styles.chipLabel
        }
        numberOfLines={1}
      >
        {label}
      </Text>
      {lowCount != null && lowCount > 0 ? (
        <View style={styles.chipDot}>
          <Text style={styles.chipDotText}>{lowCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ItemRow({
  link,
  qty,
  onChange,
}: {
  link: SupplierItemLinkRecord;
  qty: number;
  onChange: (qty: number) => void;
}) {
  const stock = toNum(link.currentStock);
  const reorder = toNum(link.reorderLevel);
  const low = reorder > 0 && stock <= reorder;
  const cost = unitCost(link);

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemInfo}>
        <Text variant="body" numberOfLines={1} style={styles.itemName}>
          {link.itemName}
        </Text>
        <View style={styles.itemMeta}>
          <Text variant="muted">
            {link.sku || 'No SKU'}
            {link.packUnit ? ` · ${link.packUnit}` : ''}
          </Text>
          <Text
            variant="caption"
            style={
              low
                ? { ...styles.stockPill, ...styles.stockLow }
                : { ...styles.stockPill, ...styles.stockOk }
            }
          >
            {low ? `Low · ${stock}` : `${stock} in stock`}
          </Text>
        </View>
        <Text variant="caption" style={styles.itemCost}>
          {formatMoney(cost)} {reorder > 0 ? `· reorder at ${reorder}` : ''}
        </Text>
      </View>
      <Stepper qty={qty} onChange={onChange} />
    </View>
  );
}

function Stepper({ qty, onChange }: { qty: number; onChange: (qty: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={[styles.stepperBtn, qty === 0 && styles.stepperBtnMuted]}
        onPress={() => onChange(qty - 1)}
        disabled={qty === 0}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
      >
        <Text variant="body" style={styles.stepperBtnText}>
          −
        </Text>
      </Pressable>
      <Text variant="body" style={styles.stepperQty}>
        {qty}
      </Text>
      <Pressable
        style={styles.stepperBtn}
        onPress={() => onChange(qty + 1)}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
      >
        <Text variant="body" style={styles.stepperBtnText}>
          +
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  supplierBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  supplierBarText: { flex: 1, marginRight: 8 },
  supplierLabel: { color: theme.colors.textMuted },
  supplierName: { fontWeight: '600' },
  supplierCaret: { color: theme.colors.textMuted, fontSize: 18 },
  search: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  chips: { flexGrow: 0 },
  chipsContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.surface,
    maxWidth: 180,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipLabel: { color: theme.colors.text },
  chipLabelActive: { color: '#ffffff', fontWeight: '600' },
  chipDot: {
    backgroundColor: theme.colors.danger,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chipDotText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  listContent: { paddingHorizontal: 16, paddingBottom: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionTitle: { fontWeight: '700', color: theme.colors.text },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 8,
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemName: { fontWeight: '600' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' },
  stockPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  stockOk: { backgroundColor: theme.colors.success, color: '#ffffff' },
  stockLow: { backgroundColor: theme.colors.danger, color: '#ffffff' },
  itemCost: { color: theme.colors.textMuted, marginTop: 4 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  stepperBtnMuted: { opacity: 0.4 },
  stepperBtnText: { fontSize: 18, fontWeight: '600' },
  stepperQty: { minWidth: 24, textAlign: 'center', fontVariant: ['tabular-nums'] },
  cartBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  cartBarQty: { color: '#ffffff', fontWeight: '700' },
  cartBarTotal: { color: 'rgba(255,255,255,0.85)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: 16,
    paddingBottom: 28,
    maxHeight: '85%',
    minHeight: '55%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalClose: { color: theme.colors.primary, fontWeight: '600' },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  supplierRowText: { flex: 1, marginRight: 8 },
  check: { color: theme.colors.primary, fontWeight: '700' },
  cartSupplier: { color: theme.colors.textMuted, marginBottom: 8 },
  cartLines: { flexGrow: 0 },
  cartLineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 10,
  },
  cartLineInfo: { flex: 1, marginRight: 10 },
  notes: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: 10,
    minHeight: 44,
    marginTop: 4,
    fontSize: 15,
    color: theme.colors.text,
  },
  cartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
});
