import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import {
  cancelPurchaseOrder,
  fetchPurchaseOrder,
  fetchSupplierItemLinks,
  postGoodsReceipt,
  postGrnSupplierInvoice,
  type PurchaseOrderDetail,
  type PurchaseOrderLine,
} from '../api/purchasing';
import { formatMoney, formatQty, toNum } from '../lib/format';

type Props = {
  api: ApiClient;
  branchId: string;
  purchaseOrderId: string;
  /** Called when the user finishes (confirm receipt or cancel) and leaves the screen. */
  onDone: () => void;
};

type ReceiveQty = Record<string, number>;
type Selected = Record<string, boolean>;
type ItemMeta = { name: string };

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ReceiveOrderScreen({ api, branchId, purchaseOrderId, onDone }: Props) {
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [itemMeta, setItemMeta] = useState<Record<string, ItemMeta>>({});
  const [qtyByLine, setQtyByLine] = useState<ReceiveQty>({});
  const [selectedLines, setSelectedLines] = useState<Selected>({});
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchPurchaseOrder(api, purchaseOrderId)
      .then(async (po) => {
        if (cancelled) return;
        setDetail(po);
        const openLines = po.lines.filter(
          (l) => toNum(l.qtyOrdered) > toNum(l.qtyReceived)
        );
        const nextQty: ReceiveQty = {};
        const nextSel: Selected = {};
        for (const line of openLines) {
          const remaining = toNum(line.qtyOrdered) - toNum(line.qtyReceived);
          nextQty[line.id] = remaining;
          nextSel[line.id] = true;
        }
        setQtyByLine(nextQty);
        setSelectedLines(nextSel);

        try {
          const links = await fetchSupplierItemLinks(api, po.supplierId, {
            branchId: po.branchId || branchId || undefined,
          });
          if (cancelled) return;
          const map: Record<string, ItemMeta> = {};
          for (const link of links) {
            map[link.itemId] = { name: link.itemName };
          }
          setItemMeta(map);
        } catch {
          if (!cancelled) setItemMeta({});
        }
      })
      .catch((error) => {
        if (!cancelled) {
          Alert.alert('Error', error instanceof Error ? error.message : 'Could not load order');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per order id
  }, [purchaseOrderId, api]);

  const openLines = useMemo(
    () => (detail?.lines ?? []).filter((l) => toNum(l.qtyOrdered) > toNum(l.qtyReceived)),
    [detail]
  );

  const lineName = useCallback(
    (line: PurchaseOrderLine) => itemMeta[line.itemId]?.name ?? 'Item',
    [itemMeta]
  );

  const selectedTotal = useMemo(() => {
    let sum = 0;
    for (const line of openLines) {
      if (!selectedLines[line.id]) continue;
      sum += Math.max(0, qtyByLine[line.id] ?? 0) * toNum(line.unitEstimatedCost);
    }
    return sum;
  }, [openLines, selectedLines, qtyByLine]);

  const selectedUnits = useMemo(() => {
    let sum = 0;
    for (const line of openLines) {
      if (!selectedLines[line.id]) continue;
      sum += Math.max(0, qtyByLine[line.id] ?? 0);
    }
    return sum;
  }, [openLines, selectedLines, qtyByLine]);

  const toggleLine = (lineId: string) => {
    const willSelect = !selectedLines[lineId];
    setSelectedLines((prev) => ({ ...prev, [lineId]: willSelect }));
    if (!willSelect) {
      setQtyByLine((q) => ({ ...q, [lineId]: 0 }));
    }
  };

  const setLineQty = (lineId: string, qty: number) => {
    setQtyByLine((prev) => ({ ...prev, [lineId]: Math.max(0, qty) }));
  };

  const confirmSelected = async () => {
    if (!detail) return;
    const lines = openLines
      .filter((l) => selectedLines[l.id])
      .map((l) => ({
        purchaseOrderLineId: l.id,
        qtyReceived: Math.max(0, qtyByLine[l.id] ?? 0),
        itemId: l.itemId,
        unitCost: toNum(l.unitEstimatedCost),
      }))
      .filter((l) => l.qtyReceived > 0);

    if (lines.length === 0) {
      Alert.alert('Nothing to confirm', 'Select at least one line with quantity.');
      return;
    }

    const receiveBranch = detail.branchId || branchId;
    if (!receiveBranch.trim()) {
      Alert.alert('Missing branch', 'A branch is required to confirm.');
      return;
    }

    setConfirming(true);
    try {
      const grn = await postGoodsReceipt(api, {
        purchaseOrderId: detail.id,
        branchId: receiveBranch.trim(),
        receivedAt: new Date().toISOString(),
        notes: `Confirmed from Order · ${detail.poNumber}`,
        lines: lines.map((l) => ({
          purchaseOrderLineId: l.purchaseOrderLineId,
          qtyReceived: l.qtyReceived,
        })),
      });

      const invoiceLines = lines.map((l) => ({
        itemId: l.itemId,
        qty: l.qtyReceived,
        unitCost: l.unitCost,
        lineTotal: round2(l.qtyReceived * l.unitCost),
      }));

      await postGrnSupplierInvoice(api, grn.goodsReceiptId, {
        invoiceNumber: `${detail.poNumber}-R${String(Date.now()).slice(-4)}`,
        invoiceDate: todayIsoDate(),
        lines: invoiceLines,
      });

      Alert.alert('Confirmed', 'Order confirmed — stock updated.', [
        { text: 'OK', onPress: onDone },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not confirm order');
    } finally {
      setConfirming(false);
    }
  };

  const cancelOrder = () => {
    if (!detail) return;
    Alert.alert('Cancel order', `Cancel ${detail.poNumber}? This cannot be undone.`, [
      { text: 'Keep order', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: () => void runCancel(detail.id),
      },
    ]);
  };

  const runCancel = async (orderId: string) => {
    setCancelling(true);
    try {
      await cancelPurchaseOrder(api, orderId);
      Alert.alert('Order cancelled', 'The purchase order has been cancelled.', [
        { text: 'OK', onPress: onDone },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = detail ? detail.status === 'draft' || detail.status === 'sent' : false;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.center}>
        <Text variant="muted">Could not load this order.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="h2">{detail.poNumber}</Text>
          <Text variant="muted">Status: {detail.status}</Text>
        </View>
        {canCancel ? (
          <Button
            title={cancelling ? 'Cancelling…' : 'Cancel order'}
            variant="danger"
            onPress={cancelOrder}
            disabled={cancelling || confirming}
            style={styles.cancelBtn}
          />
        ) : null}
      </View>

      <FlatList
        data={openLines}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          openLines.length === 0 ? (
            <View style={styles.center}>
              <Text variant="muted">All lines on this order have been received.</Text>
            </View>
          ) : (
            <Text variant="caption" style={styles.listHint}>
              Adjust quantities, then confirm what arrived.
            </Text>
          )
        }
        renderItem={({ item }) => {
          const ordered = toNum(item.qtyOrdered);
          const received = toNum(item.qtyReceived);
          const remaining = ordered - received;
          const qty = Math.max(0, qtyByLine[item.id] ?? 0);
          const selected = !!selectedLines[item.id];
          return (
            <Card
              style={
                selected ? styles.lineCard : { ...styles.lineCard, ...styles.lineCardMuted }
              }
            >
              <Pressable
                style={styles.lineMain}
                onPress={() => toggleLine(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
              >
                <View style={[styles.checkbox, selected && styles.checkboxOn]}>
                  {selected ? <Text style={styles.checkboxCheck}>✓</Text> : null}
                </View>
                <View style={styles.lineInfo}>
                  <Text variant="body" numberOfLines={1} style={styles.lineName}>
                    {lineName(item)}
                  </Text>
                  <Text variant="muted">
                    {formatQty(received)} of {formatQty(ordered)} received · {formatQty(remaining)}{' '}
                    remaining
                  </Text>
                  <Text variant="caption" style={styles.lineCost}>
                    {formatMoney(toNum(item.unitEstimatedCost))} / unit
                  </Text>
                </View>
              </Pressable>
              <View style={styles.lineQty}>
                <Pressable
                  style={[styles.qtyBtn, qty === 0 && styles.qtyBtnMuted]}
                  onPress={() => setLineQty(item.id, qty - 1)}
                  disabled={qty === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease received quantity"
                >
                  <Text variant="body" style={styles.qtyBtnText}>
                    −
                  </Text>
                </Pressable>
                <Text variant="body" style={styles.qtyValue}>
                  {qty}
                </Text>
                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => setLineQty(item.id, qty + 1)}
                  accessibilityRole="button"
                  accessibilityLabel="Increase received quantity"
                >
                  <Text variant="body" style={styles.qtyBtnText}>
                    +
                  </Text>
                </Pressable>
              </View>
            </Card>
          );
        }}
        ListFooterComponent={<View style={{ height: 96 }} />}
      />

      {openLines.length > 0 && (
        <View style={styles.confirmBar}>
          <View>
            <Text variant="caption" style={styles.confirmBarLabel}>
              Receiving
            </Text>
            <Text variant="body" style={styles.confirmBarTotal}>
              {selectedUnits} {selectedUnits === 1 ? 'unit' : 'units'} · {formatMoney(selectedTotal)}
            </Text>
          </View>
          <Button
            title={confirming ? 'Confirming…' : 'Confirm receipt'}
            onPress={() => void confirmSelected()}
            disabled={confirming || selectedUnits === 0}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { padding: 16, paddingBottom: 4, flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1, marginRight: 8 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 12, minHeight: 40 },
  listContent: { paddingHorizontal: 16, paddingBottom: 12 },
  listHint: { color: theme.colors.textMuted, marginBottom: 8 },
  lineCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingVertical: 10 },
  lineCardMuted: { opacity: 0.55 },
  lineMain: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  checkboxCheck: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  lineInfo: { flex: 1 },
  lineName: { fontWeight: '600' },
  lineCost: { color: theme.colors.textMuted, marginTop: 2 },
  lineQty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  qtyBtnMuted: { opacity: 0.4 },
  qtyBtnText: { fontSize: 18, fontWeight: '600' },
  qtyValue: { minWidth: 24, textAlign: 'center', fontVariant: ['tabular-nums'] },
  confirmBar: {
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
  confirmBarLabel: { color: 'rgba(255,255,255,0.8)' },
  confirmBarTotal: { color: '#ffffff', fontWeight: '700' },
});
