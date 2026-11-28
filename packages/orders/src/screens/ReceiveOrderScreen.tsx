import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Card, Text, theme } from '@kiosk/ui';
import { TextInput } from 'react-native';
import { generateIdempotencyKey, isApiError, type ApiClient } from '@kiosk/core';
import {
  arrivalLabel,
  ARRIVAL_DAMAGED,
  planPutAway,
  retargetArrival,
  tallyWords,
  toggleDamaged,
  type ArrivalMap,
} from '../lib/receive-arrival';
import {
  cancelPurchaseOrder,
  fetchPurchaseOrder,
  fetchSupplierItemLinks,
  markPurchaseOrderArrived,
  postGoodsReceipt,
  postStoreRoomInheritOrder,
  postGrnSupplierInvoice,
  type PurchaseOrderDetail,
  type PurchaseOrderLine,
} from '../api/purchasing';
import { formatMoney, formatQty, toNum } from '../lib/format';
import {
  HALF_DONE_WORDS,
  planAttempt,
  receiptFailureWords,
  receiptSignature,
  sendAttempt,
  type ReceiptAttempt,
} from '../lib/receipt-attempt';

type Props = {
  /** Height of the bar under this screen (a tab bar), so the confirm bar and the last line clear it. */
  bottomInset?: number;
  api: ApiClient;
  branchId: string;
  purchaseOrderId: string;
  /** Called when the user finishes (confirm receipt or cancel) and leaves the screen. */
  onDone: () => void;
};

type ReceiveQty = Record<string, number>;
type Selected = Record<string, boolean>;
type ItemMeta = { name: string };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function ReceiveOrderScreen({ api, branchId, purchaseOrderId, onDone, bottomInset = 0 }: Props) {
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [itemMeta, setItemMeta] = useState<Record<string, ItemMeta>>({});
  const [qtyByLine, setQtyByLine] = useState<ReceiveQty>({});
  const [selectedLines, setSelectedLines] = useState<Selected>({});
  /** Where each line goes once it is counted: the shelf (till rises) or the store room (till does not). */
  const [putAway, setPutAway] = useState<Record<string, 'stock' | 'store'>>({});
  /** How each line came in. Filled from the count as it is typed; damaged can be set by hand. */
  const [arrival, setArrival] = useState<ArrivalMap>({});
  /** The supplier's own invoice, when it came with the delivery. Blank means the shop numbers the receipt itself. */
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const invoiceGiven = invoiceNo.trim() === '' && invoiceDate.trim() === '' ? null : { number: invoiceNo, date: invoiceDate };
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [marking, setMarking] = useState(false);
    /** The try being made to confirm this delivery, kept so a second press repeats it instead of starting another. */
  const attemptRef = useRef<ReceiptAttempt | null>(null);
  /** Store-room lines already accepted for this signature, so a lost receipt answer does not inherit the order again. */
  const storeSentFor = useRef<string | null>(null);
  /** A confirmation is on its way. Read at once, so a second tap in the same moment cannot start another. */
  const sending = useRef(false);

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
    const next = Math.max(0, qty);
    setQtyByLine((prev) => ({ ...prev, [lineId]: next }));
    const line = openLines.find((candidate) => candidate.id === lineId);
    const remaining = line ? toNum(line.qtyOrdered) - toNum(line.qtyReceived) : 0;
    setArrival((prev) => retargetArrival(prev, lineId, next, remaining));
  };

  const confirmSelected = async () => {
    if (!detail || sending.current) return;
    /** What leaves the dock: the shortfall and the damage stay off the shelf, exactly as the web's unpack sheet decides. */
    const puttingAway = planPutAway(
      openLines.filter((line) => selectedLines[line.id]).map((line) => line.id),
      arrival,
      qtyByLine,
      putAway
    );
    const toStore = puttingAway.storeLines.map((line) => ({ purchaseOrderLineId: line.id, quantity: line.qty }));
    const lines = puttingAway.stockLines.map((line) => {
      const source = openLines.find((candidate) => candidate.id === line.id);
      return {
        purchaseOrderLineId: line.id,
        qtyReceived: line.qty,
        itemId: source?.itemId ?? '',
        unitCost: toNum(source?.unitEstimatedCost),
      };
    });

    if (lines.length === 0 && toStore.length === 0) {
      Alert.alert('Nothing to confirm', 'Select at least one line with quantity.');
      return;
    }
    if (lines.length === 0) {
      // Everything selected is going to the back room: nothing is unpacked, so there is no receipt to post.
      sending.current = true;
      setConfirming(true);
      try {
        await postStoreRoomInheritOrder(api, { purchaseOrderId: detail.id, lines: toStore });
        Alert.alert(
          'Counted into the store room',
          'The till did not rise. Nothing was added to the shelf. The order line is still open, so it can still be put on the shelf.',
          [{ text: 'OK', onPress: onDone }]
        );
      } catch (error) {
        if (isApiError(error) && error.status === 409) {
          Alert.alert(
            'Already in the store room',
            'This order is already in the store room. Those lines were left as they are. The order line is still open.',
            [{ text: 'OK', onPress: onDone }]
          );
        } else {
          Alert.alert('Could not count it in', error instanceof Error ? error.message : 'The server did not answer.');
        }
      } finally {
        sending.current = false;
        setConfirming(false);
      }
      return;
    }

    const receiveBranch = detail.branchId || branchId;
    if (!receiveBranch.trim()) {
      Alert.alert('Missing branch', 'A branch is required to confirm.');
      return;
    }

    const body = {
      purchaseOrderId: detail.id,
      branchId: receiveBranch.trim(),
      notes: `Confirmed from Order · ${detail.poNumber}`,
      lines: lines.map((l) => ({
        purchaseOrderLineId: l.purchaseOrderLineId,
        qtyReceived: l.qtyReceived,
      })),
    };
    const invoiceLines = lines.map((l) => ({
      itemId: l.itemId,
      qty: l.qtyReceived,
      unitCost: l.unitCost,
      lineTotal: round2(l.qtyReceived * l.unitCost),
    }));

    // A repeat of the same press sends the same keys and the same times, so the server recognises it and the stock is
    // never put on the shelf twice (see lib/receipt-attempt).
    const plan = planAttempt(
      attemptRef.current,
      { signature: receiptSignature(body), poNumber: detail.poNumber, invoice: invoiceGiven },
      { key: generateIdempotencyKey, now: Date.now }
    );
    if (plan.kind === 'half_done') {
      Alert.alert('Part of this is already recorded', HALF_DONE_WORDS);
      return;
    }
    const attempt = plan.attempt;
    attemptRef.current = attempt;

    sending.current = true;
    setConfirming(true);
    try {
      const storeSignature = toStore
        .map((line) => `${line.purchaseOrderLineId}:${line.quantity}`)
        .sort()
        .join('|');
      let storeAlready = false;
      if (toStore.length > 0 && storeSentFor.current !== storeSignature) {
        try {
          await postStoreRoomInheritOrder(api, { purchaseOrderId: body.purchaseOrderId, lines: toStore });
          storeSentFor.current = storeSignature;
        } catch (error) {
          // A repeat of an order already in the store room is a conflict. The shelf portion can still be received.
          if (isApiError(error) && error.status === 409) {
            storeSentFor.current = storeSignature;
            storeAlready = true;
          } else throw error;
        }
      }
      await sendAttempt(attempt, {
        postGoodsReceipt: (key) =>
          postGoodsReceipt(
            api,
            {
              purchaseOrderId: body.purchaseOrderId,
              branchId: body.branchId,
              receivedAt: attempt.receivedAt,
              notes: body.notes,
              lines: body.lines,
            },
            { idempotencyKey: key }
          ),
        postInvoice: (goodsReceiptId, key) =>
          postGrnSupplierInvoice(
            api,
            goodsReceiptId,
            { invoiceNumber: attempt.invoiceNumber, invoiceDate: attempt.invoiceDate, lines: invoiceLines },
            { idempotencyKey: key }
          ),
      });
      attemptRef.current = null;
      Alert.alert(
        'Confirmed',
        storeAlready
          ? 'The shelf is updated. This order is already in the store room. Those lines were left as they are.'
          : 'Order confirmed — stock updated.',
        [{ text: 'OK', onPress: onDone }]
      );
    } catch (error) {
      Alert.alert('Error', receiptFailureWords(attempt, error));
    } finally {
      sending.current = false;
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

  const markArrivedNow = async () => {
    if (!detail || marking) return;
    setMarking(true);
    try {
      const updated = await markPurchaseOrderArrived(api, detail.id);
      setDetail(updated ?? (await fetchPurchaseOrder(api, detail.id)) ?? detail);
      Alert.alert('Marked arrived', 'Stock stays unchanged until you unpack the quantities.');
    } catch (error) {
      Alert.alert('Could not mark arrived', error instanceof Error ? error.message : 'The server did not answer.');
    } finally {
      setMarking(false);
    }
  };

  const canCancel = detail ? detail.status === 'draft' || detail.status === 'sent' : false;
  /** Two-step delivery: arrived is recorded before anything is unpacked, so the stock only moves when it is counted. */
  const arrived = detail ? detail.status === 'delivered' || detail.status === 'partially_delivered' : false;

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
        {!arrived ? (
          <Button
            title={marking ? 'Marking…' : 'Mark arrived'}
            variant="secondary"
            onPress={() => void markArrivedNow()}
            disabled={marking || confirming}
            style={styles.arriveBtn}
          />
        ) : null}
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
              Adjust the count, then choose where it goes. Sellable stock puts it on the till. Store room does not.
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
              <View style={styles.lineTop}>
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
                      {formatQty(received)} of {formatQty(ordered)} received · {formatQty(remaining)} remaining
                    </Text>
                    <Text variant="caption" style={styles.lineCost}>
                      {formatMoney(toNum(item.unitEstimatedCost))} / unit
                    </Text>
                    {arrivalLabel(arrival[item.id], qty, remaining) ? (
                      <Text variant="caption" style={styles.arrivalLabel}>
                        {arrivalLabel(arrival[item.id], qty, remaining)}
                      </Text>
                    ) : null}
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
              </View>
              {selected ? (
                <View style={styles.damageRow}>
                  <Pressable
                    onPress={() => setArrival((prev) => toggleDamaged(prev, item.id, remaining, qty))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: arrival[item.id] === ARRIVAL_DAMAGED }}
                    style={[styles.damageChip, arrival[item.id] === ARRIVAL_DAMAGED && styles.damageChipOn]}
                  >
                    <Text variant="caption" style={arrival[item.id] === ARRIVAL_DAMAGED ? styles.damageTextOn : styles.damageText}>
                      Arrived damaged
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              {selected && qty > 0 && arrival[item.id] !== ARRIVAL_DAMAGED ? (
                <View style={styles.destBlock}>
                  <View style={styles.putAway}>
                    {(['stock', 'store'] as const).map((destination) => {
                      const on = (putAway[item.id] ?? 'stock') === destination;
                      return (
                        <Pressable
                          key={destination}
                          onPress={() => setPutAway((before) => ({ ...before, [item.id]: destination }))}
                          accessibilityRole="button"
                          accessibilityState={{ selected: on }}
                          style={[styles.destChip, on && styles.destChipOn]}
                        >
                          <Text variant="caption" style={on ? styles.destTextOn : styles.destText}>
                            {destination === 'stock' ? 'Sellable stock' : 'Store room'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </Card>
          );
        }}
        ListFooterComponent={<View style={{ height: 120 + bottomInset }} />}
      />

      {openLines.length > 0 ? (
        <View style={styles.invoiceRow}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" style={styles.invoiceLabel}>
              SUPPLIER INVOICE
            </Text>
            <TextInput
              value={invoiceNo}
              onChangeText={setInvoiceNo}
              placeholder="Number on their paper"
              placeholderTextColor={theme.colors.textQuiet}
              autoCapitalize="characters"
              accessibilityLabel="Supplier invoice number"
              style={styles.invoiceInput}
            />
          </View>
          <View style={{ width: 128 }}>
            <Text variant="caption" style={styles.invoiceLabel}>
              DATED
            </Text>
            <TextInput
              value={invoiceDate}
              onChangeText={setInvoiceDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textQuiet}
              accessibilityLabel="Supplier invoice date"
              style={styles.invoiceInput}
            />
          </View>
        </View>
      ) : null}

      {openLines.length > 0 && (
        <View style={[styles.confirmBar, { marginBottom: bottomInset }]}>
          <View>
            <Text variant="caption" style={styles.confirmBarLabel}>
              Receiving
            </Text>
            <Text variant="body" style={styles.confirmBarTotal}>
              {selectedUnits} {selectedUnits === 1 ? 'unit' : 'units'} · {formatMoney(selectedTotal)}
            </Text>
            <Text variant="caption" style={styles.confirmBarLabel}>
              {tallyWords(openLines.filter((line) => selectedLines[line.id]).map((line) => line.id), arrival)}
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
  arriveBtn: { marginBottom: 8 },
  arrivalLabel: { color: '#a8281b', fontWeight: '600' },
  damageRow: { paddingHorizontal: 12, paddingBottom: 6 },
  damageChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  damageChipOn: { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger },
  damageText: { color: theme.colors.textMuted },
  damageTextOn: { color: '#fff' },
  invoiceRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  invoiceLabel: { color: theme.colors.textQuiet, letterSpacing: 0.8, marginBottom: 2 },
  invoiceInput: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSunken,
    color: theme.colors.text,
    fontSize: 14,
  },
  putAway: { flexDirection: 'row', gap: 8 },
  destBlock: { paddingHorizontal: 12, paddingBottom: 12 },
  destChip: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  destChipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  destText: { color: theme.colors.textMuted },
  destTextOn: { color: '#fff' },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 12, minHeight: 40 },
  listContent: { paddingHorizontal: 16, paddingBottom: 12 },
  listHint: { color: theme.colors.textMuted, marginBottom: 8 },
  lineCard: { flexDirection: 'column', alignItems: 'stretch', marginBottom: 10, paddingVertical: 10 },
  lineTop: { flexDirection: 'row', alignItems: 'center' },
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
