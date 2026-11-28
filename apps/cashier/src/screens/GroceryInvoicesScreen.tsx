import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ApiClient } from '@kiosk/core';
import { GUTTER, MART, PressableScale, RADIUS, SPACE, tint, MartText, onFill } from '@kiosk/staff';
import { CARD_SURFACE, CashierField, TABULAR_NUMS } from '../components/CashierPrimitives';
import { BottomSheet } from '../components/BottomSheet';
import {
  fetchGroceryInvoice,
  fetchPendingGroceryInvoices,
  payGroceryInvoice,
  payGroceryInvoiceStk,
  type GroceryInvoice,
} from '../api/pos-api';
import { normalizeKenyanPhone } from '../lib/phone';
import { describeInvoiceFailure } from '../lib/till-words';
import type { CashierStackParamList } from '../navigation/AppNavigator';
import { usePosStore } from '../store/pos-store';

type Props = {
  api: ApiClient;
  /** Parent stack: used after cash pay to open the Receipt screen for print/share. */
  navigation?: NativeStackNavigationProp<CashierStackParamList>;
};

/** How often the list is re-read, so a sale forwarded from the counter shows up without the cashier doing anything. */
const REFRESH_MS = 15_000;

function kes(amount: number | undefined): string {
  const value = amount ?? 0;
  return `KES ${value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(iso: string | undefined): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function lineCount(invoice: GroceryInvoice): number {
  return invoice.lines?.length ?? 0;
}

/** The pay sheet: Cash takes the full amount; M-Pesa pushes a prompt to the customer's phone (editable). */
function PaySheet({
  invoice,
  onCash,
  onMpesa,
  onClose,
  busy,
}: {
  invoice: GroceryInvoice;
  onCash: () => void;
  onMpesa: (phone: string) => void;
  onClose: () => void;
  busy: 'cash' | 'mpesa' | null;
}) {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState(invoice.customerPhone ?? '');
  const phoneOk = normalizeKenyanPhone(phone) !== null;
  return (
    <BottomSheet visible onClose={onClose}>
        <View style={styles.sheet}>
          <MartText variant="shelf" color={MART.inkQuiet}>
            TAKE PAYMENT
          </MartText>
          <MartText variant="display" style={TABULAR_NUMS}>{kes(invoice.grandTotal)}</MartText>
          <MartText variant="meta" color={MART.inkQuiet}>
            {invoice.customerName ?? 'Walk-in'} · {lineCount(invoice)} {lineCount(invoice) === 1 ? 'item' : 'items'}
          </MartText>

          <PressableScale
            onPress={onCash}
            disabled={busy !== null}
            style={[styles.payBtn, styles.payCash, busy === 'cash' && styles.dim]}
          >
            {busy === 'cash' ? (
              <ActivityIndicator color={onFill(MART.fallbackPrimary).primary} />
            ) : (
              <>
                <Ionicons name="cash-outline" size={20} color={onFill(MART.fallbackPrimary).primary} />
                <MartText variant="label" color={onFill(MART.fallbackPrimary).primary} style={TABULAR_NUMS}>
                  Cash · {kes(invoice.grandTotal)}
                </MartText>
              </>
            )}
          </PressableScale>

          <View style={styles.mpesaBox}>
            <MartText variant="shelf" color={MART.inkQuiet}>
              M-PESA TO
            </MartText>
            <CashierField
              leadingIcon="phone-portrait-outline"
              value={phone}
              onChangeText={setPhone}
              placeholder="07XX XXX XXX"
              keyboardType="phone-pad"
            />
            <PressableScale
              onPress={() => onMpesa(phone)}
              disabled={busy !== null || !phoneOk}
              style={[styles.payBtn, styles.payMpesa, (busy === 'mpesa' || !phoneOk) && styles.dim]}
            >
              {busy === 'mpesa' ? (
                <ActivityIndicator color={MART.ink} />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={18} color={MART.ink} />
                  <MartText variant="label" color={MART.ink}>
                    Send M-Pesa prompt
                  </MartText>
                </>
              )}
            </PressableScale>
          </View>

          <PressableScale onPress={onClose} style={styles.cancel}>
            <MartText variant="label" color={MART.inkMuted}>
              Not now
            </MartText>
          </PressableScale>
        </View>
    </BottomSheet>
  );
}

/** One forwarded invoice: who sent it and when, the total, and — when opened — its line items. */
function InvoiceCard({
  invoice,
  open,
  onToggle,
  onPay,
}: {
  invoice: GroceryInvoice;
  open: boolean;
  onToggle: () => void;
  onPay: () => void;
}) {
  const ago = timeAgo(invoice.createdAt);
  const sent = invoice.createdByName;
  return (
    <View style={styles.card}>
      <Pressable onPress={onToggle} style={styles.cardHead} accessibilityRole="button">
        <View style={styles.cardLead}>
          <View style={styles.cardIcon}>
            <Ionicons name="receipt-outline" size={18} color={MART.fallbackPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <MartText variant="heading" numberOfLines={1}>
              {invoice.customerName ?? 'Walk-in'}
            </MartText>
            <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
              {[sent ? `from ${sent}` : null, ago, `${lineCount(invoice)} ${lineCount(invoice) === 1 ? 'item' : 'items'}`]
                .filter(Boolean)
                .join(' · ')}
            </MartText>
          </View>
        </View>
        <View style={styles.cardRight}>
          <MartText variant="price" style={TABULAR_NUMS}>{kes(invoice.grandTotal)}</MartText>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={MART.inkQuiet} />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.lines}>
          {(invoice.lines ?? []).length === 0 ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              No item detail on this invoice.
            </MartText>
          ) : (
            (invoice.lines ?? []).map((line, i) => (
              <View key={`${line.itemName}:${i}`} style={styles.lineRow}>
                <MartText variant="body" numberOfLines={1} style={{ flex: 1 }}>
                  {line.quantity}
                  {line.unitName ? ` ${line.unitName}` : '×'} {line.itemName}
                </MartText>
                <MartText variant="body" color={MART.inkMuted} style={TABULAR_NUMS}>
                  {kes(line.lineTotal)}
                </MartText>
              </View>
            ))
          )}
          {invoice.notes ? (
            <MartText variant="meta" color={MART.inkQuiet} style={{ marginTop: SPACE.xs }}>
              Note: {invoice.notes}
            </MartText>
          ) : null}
        </View>
      ) : null}

      <PressableScale onPress={onPay} scaleTo={0.98} style={styles.payRow} accessibilityRole="button">
        <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
          Take payment
        </MartText>
        <Ionicons name="arrow-forward" size={16} color={onFill(MART.fallbackPrimary).primary} />
      </PressableScale>
    </View>
  );
}

export function GroceryInvoicesScreen({ api, navigation }: Props) {
  const setLastSale = usePosStore((s) => s.setLastSale);
  const [invoices, setInvoices] = useState<GroceryInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [first, setFirst] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [paying, setPaying] = useState<GroceryInvoice | null>(null);
  const [payBusy, setPayBusy] = useState<'cash' | 'mpesa' | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const list = await fetchPendingGroceryInvoices(api);
        setInvoices(list);
      } catch (e) {
        if (!quiet) Alert.alert('Could not load the invoices', describeInvoiceFailure(e, 'load'));
      } finally {
        if (!quiet) setLoading(false);
        setFirst(false);
      }
    },
    [api]
  );

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // When a card is opened, fetch its full detail (lines) if the list shape was thin.
  const openCard = useCallback(
    async (invoice: GroceryInvoice) => {
      if (openId === invoice.id) {
        setOpenId(null);
        return;
      }
      setOpenId(invoice.id);
      if (!invoice.lines || invoice.lines.length === 0) {
        try {
          const full = await fetchGroceryInvoice(api, invoice.id);
          setInvoices((list) => list.map((inv) => (inv.id === invoice.id ? { ...inv, ...full } : inv)));
        } catch {
          // Opening is best-effort; the card still shows the total and the pay action.
        }
      }
    },
    [api, openId]
  );

  const onCash = useCallback(
    async (invoice: GroceryInvoice) => {
      setPayBusy('cash');
      try {
        const paid = await payGroceryInvoice(api, invoice.id, [
          { method: 'cash', amount: invoice.grandTotal ?? 0 },
        ]);
        setPaying(null);
        setInvoices((list) => list.filter((inv) => inv.id !== invoice.id));
        // Same as a till sale: show the receipt so the cashier can print/share.
        if (paid.receipt && navigation) {
          setLastSale(paid.receipt);
          navigation.navigate('Receipt', { soldAt: paid.paidAt });
          return;
        }
        Alert.alert('Paid', `${invoice.customerName ?? 'Walk-in'} · ${kes(invoice.grandTotal)} in cash.`);
      } catch (e) {
        Alert.alert('Payment', describeInvoiceFailure(e, 'pay'));
      } finally {
        setPayBusy(null);
      }
    },
    [api, navigation, setLastSale]
  );

  const onMpesa = useCallback(
    async (invoice: GroceryInvoice, phone: string) => {
      const normalized = normalizeKenyanPhone(phone);
      if (!normalized) {
        Alert.alert('Check the number', 'Enter a Kenyan phone number, like 07XX XXX XXX.');
        return;
      }
      setPayBusy('mpesa');
      try {
        const result = await payGroceryInvoiceStk(api, invoice.id, normalized);
        setPaying(null);
        if (result.accepted) {
          Alert.alert('Prompt sent', `An M-Pesa prompt was sent to ${normalized}. The sale completes when they pay.`);
        } else {
          Alert.alert('Not sent', result.message ?? 'The prompt could not be sent. Try again or take cash.');
        }
        void load(true);
      } catch (e) {
        Alert.alert('M-Pesa', describeInvoiceFailure(e, 'pay'));
      } finally {
        setPayBusy(null);
      }
    },
    [api, load]
  );

  const total = useMemo(() => invoices.reduce((sum, inv) => sum + (inv.grandTotal ?? 0), 0), [invoices]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <MartText variant="shelf" color={MART.inkQuiet}>
            FROM THE COUNTER
          </MartText>
          <MartText variant="title">
            {invoices.length === 0 ? 'No invoices waiting' : `${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'} to pay`}
          </MartText>
        </View>
        {invoices.length > 0 ? (
          <View style={styles.totalPill}>
            <MartText variant="shelf" color={MART.inkQuiet}>
              TOTAL
            </MartText>
            <MartText variant="heading" color={MART.fallbackPrimary} style={TABULAR_NUMS}>
              {kes(total)}
            </MartText>
          </View>
        ) : null}
      </View>

      <FlatList
        data={invoices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={() => void load()}
        renderItem={({ item }) => (
          <InvoiceCard
            invoice={item}
            open={openId === item.id}
            onToggle={() => void openCard(item)}
            onPay={() => setPaying(item)}
          />
        )}
        ListEmptyComponent={
          first ? (
            <View style={styles.center}>
              <ActivityIndicator color={MART.fallbackPrimary} />
            </View>
          ) : (
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <Ionicons name="checkmark-done-outline" size={28} color={MART.success} />
              </View>
              <MartText variant="heading" style={styles.centerText}>
                All clear
              </MartText>
              <MartText variant="meta" color={MART.inkQuiet} style={styles.centerText}>
                Invoices the counter sends over appear here, ready to pay.
              </MartText>
            </View>
          )
        }
      />

      {paying ? (
        <PaySheet
          invoice={paying}
          busy={payBusy}
          onCash={() => void onCash(paying)}
          onMpesa={(phone) => void onMpesa(paying, phone)}
          onClose={() => (payBusy ? undefined : setPaying(null))}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: GUTTER,
    paddingBottom: SPACE.md,
    gap: SPACE.md,
  },
  totalPill: {
    alignItems: 'flex-end',
    paddingVertical: SPACE.xs,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: tint(MART.fallbackPrimary, 0.1),
  },
  list: { paddingHorizontal: GUTTER, paddingBottom: SPACE.xxxl, gap: SPACE.md },
  card: {
    ...CARD_SURFACE,
    overflow: 'hidden',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg },
  cardLead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: tint(MART.fallbackPrimary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardRight: { alignItems: 'flex-end', gap: SPACE.xxs, flexDirection: 'row' },
  lines: {
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.md,
    gap: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MART.border,
    paddingTop: SPACE.md,
  },
  lineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md, paddingVertical: 3 },
  lineRowRule: { borderTopWidth: 1, borderTopColor: MART.border, paddingTop: SPACE.sm },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.md,
    backgroundColor: MART.fallbackPrimary,
  },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.xxxl, gap: SPACE.sm },
  centerText: { textAlign: 'center' },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.xs,
  },
  sheet: {
    backgroundColor: MART.paperElevated,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: GUTTER,
    paddingBottom: SPACE.xxl,
    gap: SPACE.sm,
  },
  payBtn: {
    minHeight: 54,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    marginTop: SPACE.sm,
  },
  payCash: { backgroundColor: MART.fallbackPrimary },
  payMpesa: { backgroundColor: MART.paper, borderWidth: 1.5, borderColor: MART.borderStrong },
  mpesaBox: {
    marginTop: SPACE.md,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paper,
    borderWidth: 1,
    borderColor: MART.border,
    gap: SPACE.sm,
  },
  dim: { opacity: 0.55 },
  cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingVertical: SPACE.sm, marginTop: SPACE.xs },
});
