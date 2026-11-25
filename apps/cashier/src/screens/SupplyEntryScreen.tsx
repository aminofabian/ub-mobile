import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ApiClient } from '@kiosk/core';
import { GUTTER, MART, RADIUS, SPACE, tint, MartText, onFill } from '@kiosk/staff';
import {
  addSupplyLine,
  fetchSupplierProducts,
  postSupply,
  startSupplySession,
  type SupplierProduct,
} from '../api/pos-api';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'SupplyEntry'> & {
  api: ApiClient;
  branchId: string;
  renderScanner?: (p: { onBarcode: (v: string) => void; onClose: () => void }) => React.ReactNode;
};

/** A product the cashier has added to this supply, with the detail they captured. Costs/prices in whole shillings. */
type Draft = {
  product: SupplierProduct;
  qty: string;
  unitCost: string;
  sellPrice: string;
  expiry: string;
  lot: string;
  packQty: string;
  packUnit: string;
  unitsPerPack: string;
  wastage: string;
};

function newDraft(p: SupplierProduct): Draft {
  return {
    product: p,
    qty: '',
    unitCost: p.defaultCost != null ? String(p.defaultCost) : '',
    sellPrice: p.shelfPrice != null ? String(p.shelfPrice) : '',
    expiry: '',
    lot: '',
    packQty: '',
    packUnit: p.packUnit ?? '',
    unitsPerPack: p.packSize != null ? String(p.packSize) : '',
    wastage: '',
  };
}

function kes(n: number): string {
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function toNum(s: string): number {
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Enter a supply from one supplier: pick from the products they supply (tap or scan), say how many of each came and at
 * what cost, and send it. Each line starts pre-filled from the shop's last cost and shelf price, so the common case is
 * a few taps. The server prices and records the goods-received (the "path-b" supply flow).
 */
export function SupplyEntryScreen({ api, branchId, route, navigation, renderScanner }: Props) {
  const { supplierId, supplierName } = route.params;
  const [products, setProducts] = useState<SupplierProduct[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchSupplierProducts(api, supplierId).then((list) => alive && setProducts(list), () => alive && setProducts([]));
    return () => {
      alive = false;
    };
  }, [api, supplierId]);

  const addProduct = useCallback((p: SupplierProduct) => {
    setDrafts((list) => {
      const at = list.findIndex((d) => d.product.itemId === p.itemId);
      if (at >= 0) {
        setEditing(at);
        return list;
      }
      setEditing(list.length);
      return [...list, newDraft(p)];
    });
    setPicking(false);
  }, []);

  const onScan = useCallback(
    (code: string) => {
      setScanning(false);
      const clean = code.replace(/[\s\-._]/g, '');
      const found = (products ?? []).find((p) => (p.barcode ?? '').replace(/[\s\-._]/g, '') === clean);
      if (!found) {
        Alert.alert('Not this supplier’s', 'That barcode is not one of this supplier’s products. Pick it from the list.');
        return;
      }
      addProduct(found);
    },
    [products, addProduct]
  );

  const patch = useCallback((i: number, p: Partial<Draft>) => {
    setDrafts((list) => list.map((d, idx) => (idx === i ? { ...d, ...p } : d)));
  }, []);

  const removeDraft = useCallback((i: number) => {
    setDrafts((list) => list.filter((_, idx) => idx !== i));
    setEditing(null);
  }, []);

  const total = useMemo(
    () => drafts.reduce((sum, d) => sum + toNum(d.qty) * toNum(d.unitCost), 0),
    [drafts]
  );
  const ready = drafts.length > 0 && drafts.every((d) => toNum(d.qty) > 0 && toNum(d.unitCost) >= 0);

  const submit = useCallback(async () => {
    if (!ready || posting) return;
    setPosting(true);
    try {
      const sessionId = await startSupplySession(api, supplierId, branchId);
      const breakdowns: Parameters<typeof postSupply>[2] = [];
      for (const d of drafts) {
        const qty = toNum(d.qty);
        const wastage = Math.min(qty, toNum(d.wastage));
        const lineId = await addSupplyLine(api, sessionId, {
          itemId: d.product.itemId,
          description: d.product.itemName,
          qty,
          unitCost: toNum(d.unitCost),
          sellPrice: toNum(d.sellPrice),
          ...(d.expiry.trim() ? { expiryDate: d.expiry.trim() } : {}),
          ...(d.lot.trim() ? { lotNumber: d.lot.trim() } : {}),
          ...(toNum(d.packQty) > 0 ? { purchaseQty: toNum(d.packQty), purchaseUnit: d.packUnit.trim() || undefined, unitsPerPurchaseUnit: toNum(d.unitsPerPack) || undefined } : {}),
        });
        breakdowns.push({
          lineId,
          itemId: d.product.itemId,
          usableQty: qty - wastage,
          wastageQty: wastage,
          ...(d.expiry.trim() ? { expiryDate: d.expiry.trim() } : {}),
          ...(d.lot.trim() ? { lotNumber: d.lot.trim() } : {}),
          ...(toNum(d.packQty) > 0 ? { purchaseQty: toNum(d.packQty), purchaseUnit: d.packUnit.trim() || undefined, unitsPerPurchaseUnit: toNum(d.unitsPerPack) || undefined } : {}),
        });
      }
      const result = await postSupply(api, sessionId, breakdowns);
      Alert.alert(
        'Supply recorded',
        `${result.linesPosted ?? drafts.length} ${(result.linesPosted ?? drafts.length) === 1 ? 'product' : 'products'} from ${supplierName}${result.grandTotal != null ? ` · ${kes(result.grandTotal)}` : ''}${result.invoiceNumber ? ` · ${result.invoiceNumber}` : ''}. Stock is updated.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert('Could not record the supply', e instanceof Error ? e.message : 'Try again, or check the connection.');
    } finally {
      setPosting(false);
    }
  }, [ready, posting, api, supplierId, branchId, drafts, supplierName, navigation]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <MartText variant="shelf" color={MART.inkQuiet}>
          SUPPLY FROM
        </MartText>
        <MartText variant="title" numberOfLines={1}>
          {supplierName}
        </MartText>

        {drafts.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cube-outline" size={26} color={MART.fallbackPrimary} />
            </View>
            <MartText variant="heading" style={styles.centerText}>
              What did they bring?
            </MartText>
            <MartText variant="meta" color={MART.inkQuiet} style={styles.centerText}>
              Add the products in this delivery, then record the supply.
            </MartText>
          </View>
        ) : (
          drafts.map((d, i) => {
            const lineTotal = toNum(d.qty) * toNum(d.unitCost);
            return (
              <Pressable key={d.product.itemId} onPress={() => setEditing(i)} style={styles.lineCard}>
                <View style={styles.lineHead}>
                  <MartText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                    {d.product.itemName}
                  </MartText>
                  <MartText variant="price">{lineTotal > 0 ? kes(lineTotal) : '—'}</MartText>
                </View>
                <MartText variant="meta" color={MART.inkQuiet}>
                  {toNum(d.qty) > 0 ? `${d.qty} × ${kes(toNum(d.unitCost))}` : 'Tap to set quantity & cost'}
                  {d.sellPrice ? ` · sells ${kes(toNum(d.sellPrice))}` : ''}
                  {d.expiry ? ` · exp ${d.expiry}` : ''}
                </MartText>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.addRow}>
          <Pressable onPress={() => setPicking(true)} style={[styles.addBtn, styles.addPick]}>
            <Ionicons name="add" size={18} color={MART.ink} />
            <MartText variant="label" color={MART.ink}>
              Add product
            </MartText>
          </Pressable>
          {renderScanner ? (
            <Pressable onPress={() => setScanning(true)} style={[styles.addBtn, styles.addScan]}>
              <Ionicons name="barcode-outline" size={20} color={MART.ink} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.totalRow}>
          <MartText variant="meta" color={MART.inkQuiet}>
            {drafts.length === 1 ? '1 product' : `${drafts.length} products`}
          </MartText>
          <MartText variant="display">{kes(total)}</MartText>
        </View>
        <Pressable onPress={() => void submit()} disabled={!ready || posting} style={[styles.submit, (!ready || posting) && styles.dim]}>
          {posting ? (
            <ActivityIndicator color={onFill(MART.fallbackPrimary).primary} />
          ) : (
            <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
              Record this supply
            </MartText>
          )}
        </Pressable>
      </View>

      {/* Product picker */}
      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <View style={styles.pickerScreen}>
          <View style={styles.pickerHead}>
            <MartText variant="title">Their products</MartText>
            <Pressable onPress={() => setPicking(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color={MART.inkMuted} />
            </Pressable>
          </View>
          {products === null ? (
            <View style={styles.center}>
              <ActivityIndicator color={MART.fallbackPrimary} />
            </View>
          ) : (
            <FlatList
              data={products}
              keyExtractor={(p) => p.itemId}
              contentContainerStyle={styles.pickerList}
              ListEmptyComponent={
                <MartText variant="meta" color={MART.inkQuiet} style={styles.centerText}>
                  This supplier has no products linked yet. Link them from a product’s page, or add the product first.
                </MartText>
              }
              renderItem={({ item }) => {
                const added = drafts.some((d) => d.product.itemId === item.itemId);
                return (
                  <Pressable onPress={() => addProduct(item)} style={styles.pickRow}>
                    <View style={{ flex: 1 }}>
                      <MartText variant="label" numberOfLines={1}>
                        {item.itemName}
                      </MartText>
                      <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
                        {[item.sku, item.defaultCost != null ? `cost ${kes(item.defaultCost)}` : null, item.currentStock != null ? `${item.currentStock} in stock` : null].filter(Boolean).join(' · ')}
                      </MartText>
                    </View>
                    <Ionicons name={added ? 'checkmark-circle' : 'add-circle-outline'} size={22} color={added ? MART.success : MART.fallbackPrimary} />
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>

      {/* Per-line detail editor */}
      <Modal visible={editing !== null} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        {editing !== null && drafts[editing] ? (
          <LineEditor
            draft={drafts[editing]}
            onChange={(p) => patch(editing, p)}
            onRemove={() => removeDraft(editing)}
            onClose={() => setEditing(null)}
          />
        ) : (
          <View />
        )}
      </Modal>

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        {renderScanner ? renderScanner({ onBarcode: onScan, onClose: () => setScanning(false) }) : <View />}
      </Modal>
    </View>
  );
}

/** The full-detail sheet for one supplied product. */
function LineEditor({ draft, onChange, onRemove, onClose }: { draft: Draft; onChange: (p: Partial<Draft>) => void; onRemove: () => void; onClose: () => void }) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.grip} />
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <MartText variant="title" numberOfLines={2}>
            {draft.product.itemName}
          </MartText>

          <View style={styles.pair}>
            <Num label="Quantity received" value={draft.qty} onChange={(qty) => onChange({ qty })} />
            <Money label="Unit cost" value={draft.unitCost} onChange={(unitCost) => onChange({ unitCost })} />
          </View>
          <Money label="New selling price" value={draft.sellPrice} onChange={(sellPrice) => onChange({ sellPrice })} />

          <MartText variant="shelf" color={MART.inkQuiet} style={styles.group}>
            PACK (OPTIONAL)
          </MartText>
          <View style={styles.pair}>
            <Num label="Packs" value={draft.packQty} onChange={(packQty) => onChange({ packQty })} />
            <Num label="Units / pack" value={draft.unitsPerPack} onChange={(unitsPerPack) => onChange({ unitsPerPack })} />
          </View>
          <Field label="Pack unit (carton, crate…)" value={draft.packUnit} onChange={(packUnit) => onChange({ packUnit })} autoCapitalize="none" />

          <MartText variant="shelf" color={MART.inkQuiet} style={styles.group}>
            BATCH (OPTIONAL)
          </MartText>
          <Field label="Expiry date (YYYY-MM-DD)" value={draft.expiry} onChange={(expiry) => onChange({ expiry })} keyboardType="numbers-and-punctuation" />
          <Field label="Lot / batch number" value={draft.lot} onChange={(lot) => onChange({ lot })} autoCapitalize="characters" />
          <Num label="Wastage (spoiled / short)" value={draft.wastage} onChange={(wastage) => onChange({ wastage })} />

          <View style={styles.sheetActions}>
            <Pressable onPress={onRemove} style={styles.removeBtn}>
              <MartText variant="label" color={MART.danger}>
                Remove
              </MartText>
            </Pressable>
            <Pressable onPress={onClose} style={styles.doneBtn}>
              <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
                Done
              </MartText>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

type FieldExtra = Omit<React.ComponentProps<typeof TextInput>, 'value' | 'onChange' | 'onChangeText' | 'style'>;
function Field({ label, value, onChange, ...input }: { label: string; value: string; onChange: (t: string) => void } & FieldExtra) {
  return (
    <View style={styles.field}>
      <MartText variant="label" color={MART.inkMuted}>
        {label}
      </MartText>
      <TextInput value={value} onChangeText={onChange} placeholderTextColor={MART.inkQuiet} style={styles.input} {...input} />
    </View>
  );
}
function Num(props: { label: string; value: string; onChange: (t: string) => void }) {
  return <Field {...props} keyboardType="decimal-pad" placeholder="0" />;
}
function Money(props: { label: string; value: string; onChange: (t: string) => void }) {
  return (
    <View style={styles.field}>
      <MartText variant="label" color={MART.inkMuted}>
        {props.label}
      </MartText>
      <View style={styles.moneyRow}>
        <MartText variant="label" color={MART.inkQuiet}>
          KES
        </MartText>
        <TextInput value={props.value} onChangeText={props.onChange} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={MART.inkQuiet} style={styles.moneyInput} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper },
  body: { padding: GUTTER, paddingBottom: SPACE.xxl, gap: SPACE.md },
  emptyCard: {
    marginTop: SPACE.xl,
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    borderStyle: 'dashed',
    backgroundColor: MART.paperElevated,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.fallbackPrimary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: { textAlign: 'center' },
  lineCard: {
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
    gap: SPACE.xxs,
  },
  lineHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  footer: {
    padding: GUTTER,
    borderTopWidth: 1,
    borderTopColor: MART.border,
    backgroundColor: MART.paperElevated,
    gap: SPACE.md,
  },
  addRow: { flexDirection: 'row', gap: SPACE.sm },
  addBtn: {
    minHeight: 48,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    borderWidth: 1,
    borderColor: MART.borderStrong,
  },
  addPick: { flex: 1 },
  addScan: { width: 56 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  submit: {
    minHeight: 54,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: GUTTER },
  pickerScreen: { flex: 1, backgroundColor: MART.paper, paddingTop: 52 },
  pickerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER, paddingBottom: SPACE.md },
  pickerList: { paddingHorizontal: GUTTER, paddingBottom: SPACE.xxxl, gap: SPACE.xs },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(22,24,15,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: MART.paper,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '90%',
    padding: GUTTER,
    paddingBottom: SPACE.xxl,
  },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: RADIUS.pill, backgroundColor: MART.border, marginBottom: SPACE.md },
  group: { marginTop: SPACE.lg, marginBottom: SPACE.xs },
  pair: { flexDirection: 'row', gap: SPACE.md },
  field: { flex: 1, gap: SPACE.xs, marginTop: SPACE.sm },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    fontSize: 15,
    color: MART.ink,
    backgroundColor: MART.paperElevated,
  },
  moneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 50,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    backgroundColor: MART.paperElevated,
  },
  moneyInput: { flex: 1, fontSize: 15, color: MART.ink },
  sheetActions: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.xl },
  removeBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtn: {
    flex: 2,
    minHeight: 50,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
