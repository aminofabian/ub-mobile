import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  dispatchTillPrint,
  fetchTillCashiers,
  type TillPrintCashier,
  type TillPrintSlipLine,
} from '../api/till-prints';
import { formatMoney, toNum } from '../lib/format';
import { describeTillSend } from '../lib/till-send-words';

const ORDER_CURRENCY = 'KES';
const TILL_PICK_KEY = (branchId: string) => `stock/order-print-till/${branchId || 'none'}`;

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

export function OrdersScreen({
  api,
  branchId,
  itemTypeIds,
  shopName,
  branchName,
  clerkName,
  printLocal,
  hasLocalPrinter = false,
}: {
  api: ApiClient;
  branchId: string;
  /**
   * When set, only suppliers (and links) for these departments. Pass `[]` for
   * an explicit empty scope (grocery clerk with no assignments).
   */
  itemTypeIds?: readonly string[];
  /** Shop name on the till slip. */
  shopName?: string | null;
  /** Branch name on the till slip. */
  branchName?: string | null;
  /** Who placed the order — shown on the till slip. */
  clerkName?: string | null;
  /**
   * Print the slip on this phone's paired thermal printer (grocery clerk BLE).
   * When set, Review order shows "Print here".
   */
  printLocal?: (slip: {
    reference: string;
    supplierName: string;
    lines: TillPrintSlipLine[];
    businessName: string;
    branchName: string;
    placedByName: string;
  }) => Promise<void>;
  /** True when a printer is paired so "Print here" is offered. */
  hasLocalPrinter?: boolean;
}) {
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
  const [printingOrder, setPrintingOrder] = useState(false);
  const [cashiers, setCashiers] = useState<TillPrintCashier[]>([]);
  const [cashiersLoading, setCashiersLoading] = useState(false);
  const [cashiersError, setCashiersError] = useState<string | null>(null);
  /** `null` = don't print (same as web "Don't print"). */
  const [printTillId, setPrintTillId] = useState<string | null>(null);
  const [tillPickerOpen, setTillPickerOpen] = useState(false);
  /** Last saved order slip — so Print to till still works after the cart is cleared. */
  const [lastPlaced, setLastPlaced] = useState<{
    poNumber: string;
    supplierName: string;
    lines: TillPrintSlipLine[];
  } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const scopeKey = itemTypeIds === undefined ? 'all' : itemTypeIds.slice().sort().join(',');

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
    void fetchSuppliers(
      api,
      itemTypeIds !== undefined ? { itemTypeIds } : undefined,
    )
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
  }, [api, scopeKey, itemTypeIds]);

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
        if (cancelled) return;
        const active = rows.filter((r) => r.active);
        if (itemTypeIds === undefined) {
          setLinks(active);
          return;
        }
        if (itemTypeIds.length === 0) {
          setLinks([]);
          return;
        }
        const allowed = new Set(itemTypeIds.map((id) => id.trim()).filter(Boolean));
        setLinks(
          active.filter((r) => {
            const typeId = r.itemTypeId?.trim();
            return !!typeId && allowed.has(typeId);
          }),
        );
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
  }, [supplierId, api, branchId, scopeKey, itemTypeIds]);

  useEffect(() => {
    setParentFilterId(null);
  }, [supplierId]);

  // Persist draft carts whenever they change.
  useEffect(() => {
    if (!hydrated) return;
    void cache.set(draftKey, cartsBySupplier).catch(() => {});
  }, [cartsBySupplier, hydrated, draftKey]);

  // Cashiers this order can print to — same API as web `/order` CashierPrintPicker.
  useEffect(() => {
    let cancelled = false;
    setCashiersLoading(true);
    setCashiersError(null);
    void fetchTillCashiers(api, branchId)
      .then(async (rows) => {
        if (cancelled) return;
        setCashiers(rows);
        const remembered = await cache.get<string>(TILL_PICK_KEY(branchId)).catch(() => null);
        // Match web: restore remembered till, else leave as "Don't print" (unless only one cashier).
        if (remembered && rows.some((r) => r.id === remembered)) {
          setPrintTillId(remembered);
        } else if (rows.length === 1) {
          setPrintTillId(rows[0]!.id);
        } else {
          setPrintTillId(null);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setCashiers([]);
        setPrintTillId(null);
        setCashiersError(
          error instanceof Error ? error.message : 'Could not load cashiers',
        );
      })
      .finally(() => {
        if (!cancelled) setCashiersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, branchId]);

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

  /** When true, the next till pick should also print the last placed order. */
  const printPlacedAfterPickRef = useRef(false);

  const buildOrderSlipLines = useCallback((): TillPrintSlipLine[] => {
    return cartLines.map((line) => {
      const unit = unitCost(line.link);
      return {
        name: line.link.itemName || 'Item',
        qty: line.qty,
        unitCost: unit,
        lineTotal: unit * line.qty,
      };
    });
  }, [cartLines]);

  const dispatchSlip = useCallback(
    async (opts: {
      reference: string;
      supplierName: string;
      lines: TillPrintSlipLine[];
      targetUserId: string;
    }) => {
      return dispatchTillPrint(api, {
        kind: 'order',
        branchId: branchId.trim() || null,
        targetUserIds: [opts.targetUserId],
        slip: {
          reference: opts.reference,
          supplierName: opts.supplierName,
          businessName: shopName?.trim() || '',
          branchName: branchName?.trim() || '',
          placedByName: clerkName?.trim() || '',
          currency: ORDER_CURRENCY,
          lines: opts.lines,
        },
      });
    },
    [api, branchId, branchName, clerkName, shopName],
  );

  const localSlipPayload = useCallback(
    (reference: string, lines: TillPrintSlipLine[], supplierName: string) => ({
      reference,
      supplierName,
      lines,
      businessName: shopName?.trim() || '',
      branchName: branchName?.trim() || '',
      placedByName: clerkName?.trim() || '',
    }),
    [branchName, clerkName, shopName],
  );

  /** Print on this phone's paired printer (grocery clerk). */
  const printHere = async (reference?: string, lines?: TillPrintSlipLine[], supplierName?: string) => {
    if (!printLocal) {
      Alert.alert('No printer', 'Pair a Bluetooth printer in Sales → Invoice printer.');
      return;
    }
    const slipLines = lines ?? buildOrderSlipLines();
    if (slipLines.length === 0) {
      Alert.alert('Empty order', 'Add products to the order.');
      return;
    }
    setPrintingOrder(true);
    try {
      await printLocal(
        localSlipPayload(
          reference ?? `DRAFT-${Date.now().toString().slice(-6)}`,
          slipLines,
          supplierName ?? activeSupplier?.name ?? 'Supplier',
        ),
      );
      Alert.alert('Printed', 'The order slip was sent to this phone’s printer.');
    } catch (error) {
      Alert.alert(
        'Could not print',
        error instanceof Error ? error.message : 'The printer did not take the slip.',
      );
    } finally {
      setPrintingOrder(false);
    }
  };

  /** Forward the draft cart to a till printer without saving the PO (web "Print order now"). */
  const printOrderNow = async () => {
    if (!printTillId) {
      Alert.alert('Pick a till', 'Choose which till should print this order.');
      setTillPickerOpen(true);
      return;
    }
    const slipLines = buildOrderSlipLines();
    if (slipLines.length === 0) {
      Alert.alert('Empty order', 'Add products to the order.');
      return;
    }
    setPrintingOrder(true);
    try {
      const sent = await dispatchSlip({
        reference: `DRAFT-${Date.now().toString().slice(-6)}`,
        supplierName: activeSupplier?.name || 'Supplier',
        lines: slipLines,
        targetUserId: printTillId,
      });
      Alert.alert('Sent to till', describeTillSend('order', sent.tills));
    } catch (error) {
      Alert.alert(
        'Could not send',
        error instanceof Error ? error.message : 'Could not send order to till',
      );
    } finally {
      setPrintingOrder(false);
    }
  };

  /** Forward the last placed order to a till (after create, or again). */
  const printLastPlaced = useCallback(
    async (targetUserId?: string) => {
      if (!lastPlaced) return;
      const tillId = targetUserId?.trim() || printTillId?.trim() || '';
      if (!tillId) {
        printPlacedAfterPickRef.current = true;
        setTillPickerOpen(true);
        return;
      }
      setPrintingOrder(true);
      try {
        const sent = await dispatchSlip({
          reference: lastPlaced.poNumber,
          supplierName: lastPlaced.supplierName,
          lines: lastPlaced.lines,
          targetUserId: tillId,
        });
        Alert.alert('Sent to till', describeTillSend('order', sent.tills));
      } catch (error) {
        Alert.alert(
          'Could not send',
          error instanceof Error ? error.message : 'Could not send order to till',
        );
      } finally {
        setPrintingOrder(false);
      }
    },
    [dispatchSlip, lastPlaced, printTillId],
  );

  const pickTill = useCallback(
    (id: string) => {
      setPrintTillId(id);
      setTillPickerOpen(false);
      void cache.set(TILL_PICK_KEY(branchId), id).catch(() => {});
      if (printPlacedAfterPickRef.current) {
        printPlacedAfterPickRef.current = false;
        void printLastPlaced(id);
      }
    },
    [branchId, printLastPlaced],
  );

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
    const printTo = printTillId?.trim() || '';
    const slipLines = buildOrderSlipLines();
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
      const placed = {
        poNumber: po.poNumber,
        supplierName: activeSupplier.name || 'Supplier',
        lines: slipLines,
      };
      setLastPlaced(placed);
      let printNote = '';
      if (printTo && slipLines.length > 0) {
        try {
          const sent = await dispatchSlip({
            reference: po.poNumber,
            supplierName: placed.supplierName,
            lines: slipLines,
            targetUserId: printTo,
          });
          printNote = `\n\n${describeTillSend('order', sent.tills)}`;
        } catch {
          printNote =
            '\n\nThe order was saved, but the selected till did not get the print.';
        }
      }
      setCartsBySupplier((prevMap) => {
        const next = { ...prevMap };
        delete next[supplierId];
        return next;
      });
      setCartOpen(false);
      const actions: Array<{
        text: string;
        style?: 'cancel' | 'default';
        onPress?: () => void;
      }> = [{ text: 'Done', style: 'cancel' }];
      if (hasLocalPrinter && printLocal) {
        actions.push({
          text: 'Print here',
          onPress: () => {
            void printHere(po.poNumber, slipLines, placed.supplierName);
          },
        });
      }
      if (!printTo) {
        actions.push({
          text: 'Print to till',
          onPress: () => {
            void printLastPlaced(printTillId ?? undefined);
          },
        });
      }
      Alert.alert(
        'Order placed',
        `Order ${po.poNumber} placed — confirm when goods arrive.${printNote}`,
        actions,
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
            {/* Same control as web /order "Print order to" — forward the slip to a cashier till printer. */}
            <View style={styles.printOrderBox} accessibilityRole="radiogroup">
              <Text variant="caption" style={styles.printOrderLegend}>
                Print order to
              </Text>
              <Text variant="muted" style={styles.printOrderHint}>
                One till only. Their screen chimes and the slip prints on that cashier’s printer — even remotely.
              </Text>
              {cashiersLoading ? (
                <Text variant="muted">Loading cashiers…</Text>
              ) : cashiersError ? (
                <Text variant="muted" style={styles.printOrderError}>
                  {cashiersError}
                </Text>
              ) : cashiers.length === 0 ? (
                <Text variant="muted">No cashiers on this shop, so nothing will print remotely.</Text>
              ) : (
                <>
                  <Pressable
                    style={styles.printOrderRow}
                    onPress={() => {
                      printPlacedAfterPickRef.current = false;
                      setPrintTillId(null);
                      void cache.set(TILL_PICK_KEY(branchId), '').catch(() => {});
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: printTillId === null }}
                  >
                    <Text variant="body" style={printTillId === null ? styles.printOrderOn : undefined}>
                      {printTillId === null ? '●' : '○'} Don’t print
                    </Text>
                  </Pressable>
                  {cashiers.map((cashier) => {
                    const on = printTillId === cashier.id;
                    return (
                      <Pressable
                        key={cashier.id}
                        style={styles.printOrderRow}
                        onPress={() => pickTill(cashier.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                      >
                        <Text variant="body" style={on ? styles.printOrderOn : undefined} numberOfLines={1}>
                          {on ? '●' : '○'} {cashier.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </>
              )}
            </View>
            <Button
              title={printingOrder ? 'Sending to till…' : 'Print order now'}
              onPress={() => void printOrderNow()}
              disabled={printingOrder || placing || cartLines.length === 0 || !printTillId}
              variant="secondary"
            />
            {hasLocalPrinter && printLocal ? (
              <Button
                title={printingOrder ? 'Printing…' : 'Print here'}
                onPress={() => void printHere()}
                disabled={printingOrder || placing || cartLines.length === 0}
                variant="secondary"
              />
            ) : null}
            {lastPlaced ? (
              <Button
                title={printingOrder ? 'Sending…' : `Print ${lastPlaced.poNumber} to till again`}
                onPress={() => void printLastPlaced()}
                disabled={printingOrder || placing || !printTillId}
                variant="secondary"
              />
            ) : null}
            <View style={styles.cartFooter}>
              <View>
                <Text variant="caption">Total</Text>
                <Text variant="h2">{formatMoney(cartTotal)}</Text>
              </View>
              <Button
                title={placing ? 'Placing…' : 'Place order'}
                onPress={() => void placeOrder()}
                disabled={placing || printingOrder || cartLines.length === 0}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Till picker — any cashier till, even remote */}
      <Modal
        visible={tillPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          printPlacedAfterPickRef.current = false;
          setTillPickerOpen(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text variant="h2">Print on till</Text>
              <Pressable
                onPress={() => {
                  printPlacedAfterPickRef.current = false;
                  setTillPickerOpen(false);
                }}
                accessibilityRole="button"
              >
                <Text variant="body" style={styles.modalClose}>
                  Close
                </Text>
              </Pressable>
            </View>
            <Text variant="caption" style={styles.cartSupplier}>
              The slip is queued remotely. If they are on Sell it prints now; otherwise it waits.
            </Text>
            <FlatList
              data={cashiers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.supplierRow}
                  onPress={() => pickTill(item.id)}
                  accessibilityRole="button"
                >
                  <View style={styles.supplierRowText}>
                    <Text variant="body">{item.name}</Text>
                  </View>
                  {item.id === printTillId ? (
                    <Text variant="body" style={styles.check}>
                      ✓
                    </Text>
                  ) : null}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text variant="muted">No cashier tills on this shop.</Text>
                </View>
              }
            />
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
  printOrderBox: {
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
  },
  printOrderLegend: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: theme.colors.textMuted,
    marginBottom: 4,
  },
  printOrderHint: { marginBottom: 8, fontSize: 12, lineHeight: 16 },
  printOrderError: { color: theme.colors.danger },
  printOrderRow: { paddingVertical: 6 },
  printOrderOn: { fontWeight: '700', color: theme.colors.primary },
  cartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
});
