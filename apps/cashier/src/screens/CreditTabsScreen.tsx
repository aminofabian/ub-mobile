import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ApiClient } from '@kiosk/core';
import { GUTTER, MART, RADIUS, SPACE, tint, onFill, MartText } from '@kiosk/staff';
import { TABULAR_NUMS } from '../components/CashierPrimitives';
import {
  fetchOutstandingTabs,
  fetchCustomerTabPurchases,
  proposeTabClearance,
  type OutstandingTab,
  type TabPurchase,
} from '../api/credit-api';
import { normalizeKenyanPhone } from '../lib/phone';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'CreditTabs'> & {
  api: ApiClient;
};

function kes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function whenShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', day: '2-digit', month: 'short' }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * The till's credit book: who owes the shop, how much, and what they bought — plus a way to record
 * that a customer has paid down their tab. A repayment the cashier records is a *proposal*: it goes
 * to an admin for approval, it does not clear the debt on its own (the till holds read rights only).
 */
export function CreditTabsScreen({ api }: Props) {
  const [query, setQuery] = useState('');
  const [tabs, setTabs] = useState<OutstandingTab[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState<OutstandingTab | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (q: string) => {
      const mine = ++seq.current;
      setProblem(null);
      try {
        const rows = await fetchOutstandingTabs(api, q);
        if (mine === seq.current) setTabs(rows);
      } catch {
        if (mine === seq.current) {
          setTabs([]);
          setProblem('Could not read the credit book. Pull to try again.');
        }
      }
    },
    [api]
  );

  useEffect(() => {
    void load('');
  }, [load]);

  // Debounce the search.
  useEffect(() => {
    const t = setTimeout(() => void load(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  const totalOwed = useMemo(() => (tabs ?? []).reduce((sum, t) => sum + t.balanceOwed, 0), [tabs]);

  return (
    <View style={styles.screen}>
      {/* Total owed */}
      <View style={styles.totalCard}>
        <MartText variant="meta" color={MART.inkQuiet}>
          Outstanding across {tabs?.length ?? 0} {tabs?.length === 1 ? 'customer' : 'customers'}
        </MartText>
        <MartText variant="hero" color={MART.ink}>
          {kes(totalOwed)}
        </MartText>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={MART.inkQuiet} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Customer name or phone"
          placeholderTextColor={MART.inkQuiet}
          autoCapitalize="none"
          style={styles.searchInput}
          accessibilityLabel="Search customers who owe"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={MART.inkQuiet} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={tabs ?? []}
        keyExtractor={(t) => t.customerId}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          tabs && tabs.length > 0 ? (
            <View style={styles.summary}>
              <MartText variant="shelf" color={MART.inkQuiet} style={styles.summaryLabel}>
                {tabs.length === 1 ? '1 CUSTOMER OWES' : `${tabs.length} CUSTOMERS OWE`}
              </MartText>
              <MartText variant="title" color={MART.danger} style={TABULAR_NUMS}>
                {kes(tabs.reduce((sum, item) => sum + item.balanceOwed, 0))}
              </MartText>
            </View>
          ) : null
        }
        ListEmptyComponent={
          tabs === null ? (
            <View style={styles.center}>
              <ActivityIndicator color={MART.fallbackPrimary} />
            </View>
          ) : (
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <Ionicons name={problem ? 'cloud-offline-outline' : 'checkmark-circle-outline'} size={26} color={MART.inkQuiet} />
              </View>
              <MartText variant="meta" color={MART.inkQuiet} style={styles.centerText}>
                {problem ?? (query ? 'No one by that name owes the shop.' : 'Nobody owes the shop. The credit book is clear.')}
              </MartText>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => setOpen(item)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={[styles.avatar, { backgroundColor: tint(MART.fallbackPrimary, 0.12) }]}>
              <MartText variant="label" color={MART.fallbackPrimary}>
                {initials(item.name)}
              </MartText>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <MartText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                  {item.name}
                </MartText>
                {item.creditSuspended ? (
                  <View style={styles.suspendTag}>
                    <MartText variant="shelf" color={MART.danger}>
                      ON HOLD
                    </MartText>
                  </View>
                ) : null}
              </View>
              {item.primaryPhone ? (
                <MartText variant="meta" color={MART.inkQuiet}>
                  {item.primaryPhone}
                </MartText>
              ) : null}
            </View>
            <MartText variant="price" color={item.balanceOwed > 0 ? MART.danger : MART.ink}>
              {kes(item.balanceOwed)}
            </MartText>
          </Pressable>
        )}
      />

      <CustomerTabSheet api={api} tab={open} onClose={() => setOpen(null)} onProposed={() => void load(query.trim())} />
    </View>
  );
}

/** A customer's tab: their credit purchases, and a way to record a repayment for approval. */
function CustomerTabSheet({
  api,
  tab,
  onClose,
  onProposed,
}: {
  api: ApiClient;
  tab: OutstandingTab | null;
  onClose: () => void;
  onProposed: () => void;
}) {
  const [purchases, setPurchases] = useState<TabPurchase[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [repaying, setRepaying] = useState(false);

  useEffect(() => {
    setPurchases(null);
    setExpanded(null);
    setRepaying(false);
    if (!tab) return;
    let alive = true;
    fetchCustomerTabPurchases(api, tab.customerId, { limit: 50 }).then(
      (page) => alive && setPurchases(page.rows),
      () => alive && setPurchases([])
    );
    return () => {
      alive = false;
    };
  }, [api, tab]);

  return (
    <Modal visible={tab !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        {tab ? (
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <MartText variant="title" numberOfLines={1}>
                  {tab.name}
                </MartText>
                <MartText variant="meta" color={MART.inkQuiet}>
                  {tab.primaryPhone ?? 'No phone on file'}
                </MartText>
              </View>
              <View style={styles.owedPill}>
                <MartText variant="shelf" color={onFill(MART.danger).primary}>
                  OWES
                </MartText>
                <MartText variant="heading" color={onFill(MART.danger).primary}>
                  {kes(tab.balanceOwed)}
                </MartText>
              </View>
            </View>

            <ScrollView style={styles.purchases} contentContainerStyle={{ gap: SPACE.sm }}>
              {purchases === null ? (
                <ActivityIndicator color={MART.fallbackPrimary} style={{ marginVertical: SPACE.xl }} />
              ) : purchases.length === 0 ? (
                <MartText variant="meta" color={MART.inkQuiet} style={{ textAlign: 'center', paddingVertical: SPACE.xl }}>
                  No credit purchases on record.
                </MartText>
              ) : (
                purchases.map((p) => (
                  <Pressable
                    key={p.saleId}
                    onPress={() => setExpanded(expanded === p.saleId ? null : p.saleId)}
                    style={styles.purchase}
                  >
                    <View style={styles.purchaseTop}>
                      <View>
                        <MartText variant="label">
                          {p.receiptNo != null ? `Sale #${p.receiptNo}` : 'Credit sale'}
                        </MartText>
                        <MartText variant="meta" color={MART.inkQuiet}>
                          {whenShort(p.soldAt)} · {p.lines.length} {p.lines.length === 1 ? 'item' : 'items'}
                        </MartText>
                      </View>
                      <MartText variant="price" color={MART.ink}>
                        {kes(p.creditAmount)}
                      </MartText>
                    </View>
                    {expanded === p.saleId ? (
                      <View style={styles.lines}>
                        {p.lines.map((l, i) => (
                          <View key={i} style={styles.lineRow}>
                            <MartText variant="meta" color={MART.inkMuted} numberOfLines={1} style={{ flex: 1 }}>
                              {l.quantity} × {l.itemName}
                            </MartText>
                            {l.lineTotal != null ? (
                              <MartText variant="meta" color={MART.inkMuted}>
                                {kes(l.lineTotal)}
                              </MartText>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Pressable>
                ))
              )}
            </ScrollView>

            <View style={styles.sheetActions}>
              <Pressable onPress={onClose} style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}>
                <MartText variant="label" color={MART.ink}>
                  Close
                </MartText>
              </Pressable>
              <Pressable
                onPress={() => setRepaying(true)}
                disabled={tab.balanceOwed <= 0}
                style={({ pressed }) => [styles.btn, styles.btnPrimary, tab.balanceOwed <= 0 && styles.btnOff, pressed && styles.pressed]}
              >
                <Ionicons name="cash-outline" size={16} color={onFill(MART.fallbackPrimary).primary} />
                <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
                  Record repayment
                </MartText>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {tab ? (
        <RepaymentSheet
          api={api}
          tab={tab}
          visible={repaying}
          onClose={() => setRepaying(false)}
          onDone={() => {
            setRepaying(false);
            onProposed();
            onClose();
          }}
        />
      ) : null}
    </Modal>
  );
}

/** Record a repayment against a tab — cash or M-Pesa, with an optional reference. Sent for approval. */
function RepaymentSheet({
  api,
  tab,
  visible,
  onClose,
  onDone,
}: {
  api: ApiClient;
  tab: OutstandingTab;
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amountText, setAmountText] = useState('');
  const [channel, setChannel] = useState<'cash' | 'mpesa'>('cash');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmountText(String(tab.balanceOwed || ''));
      setChannel('cash');
      setReference('');
      setBusy(false);
    }
  }, [visible, tab.balanceOwed]);

  const amount = parseFloat(amountText.replace(/[^0-9.]/g, ''));
  const amountOk = Number.isFinite(amount) && amount > 0 && amount <= tab.balanceOwed + 0.5;
  const refOk = channel === 'cash' || normalizeKenyanPhone(reference) !== null || reference.trim().length >= 6;

  const submit = async () => {
    if (!amountOk || busy) return;
    setBusy(true);
    try {
      await proposeTabClearance(api, {
        customerId: tab.customerId,
        amount,
        channel,
        reference: channel === 'mpesa' ? reference.trim() : null,
      });
      Alert.alert(
        'Sent for approval',
        `${kes(amount)} from ${tab.name} has been recorded and sent to an owner to confirm.`
      );
      onDone();
    } catch {
      Alert.alert('Could not record it', 'Try again, or ask an owner to record this repayment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.repayWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.repayCard}>
          <MartText variant="shelf" color={MART.inkQuiet}>
            REPAYMENT FROM
          </MartText>
          <MartText variant="heading">{tab.name}</MartText>

          <View style={styles.amountRow}>
            <MartText variant="title" color={MART.inkQuiet}>
              KES
            </MartText>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={MART.inkQuiet}
              style={styles.amountInput}
              autoFocus
              selectTextOnFocus
              accessibilityLabel="Amount paid"
            />
          </View>
          <MartText variant="meta" color={MART.inkQuiet}>
            Owes {kes(tab.balanceOwed)}
          </MartText>

          <View style={styles.channelRow}>
            {(['cash', 'mpesa'] as const).map((c) => (
              <Pressable key={c} onPress={() => setChannel(c)} style={[styles.channel, channel === c && styles.channelOn]}>
                <Ionicons
                  name={c === 'cash' ? 'cash-outline' : 'phone-portrait-outline'}
                  size={16}
                  color={channel === c ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}
                />
                <MartText variant="label" color={channel === c ? onFill(MART.fallbackPrimary).primary : MART.ink}>
                  {c === 'cash' ? 'Cash' : 'M-Pesa'}
                </MartText>
              </Pressable>
            ))}
          </View>

          {channel === 'mpesa' ? (
            <TextInput
              value={reference}
              onChangeText={setReference}
              placeholder="M-Pesa code or phone"
              placeholderTextColor={MART.inkQuiet}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.refInput}
              accessibilityLabel="M-Pesa reference"
            />
          ) : null}

          <View style={styles.infoBar}>
            <Ionicons name="shield-checkmark-outline" size={14} color={MART.inkQuiet} />
            <MartText variant="meta" color={MART.inkQuiet} style={{ flex: 1 }}>
              An owner confirms this before the debt is cleared.
            </MartText>
          </View>

          <View style={styles.repayActions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}>
              <MartText variant="label" color={MART.ink}>
                Cancel
              </MartText>
            </Pressable>
            <Pressable
              onPress={() => void submit()}
              disabled={!amountOk || (channel === 'mpesa' && !refOk) || busy}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                (!amountOk || (channel === 'mpesa' && !refOk) || busy) && styles.btnOff,
                pressed && styles.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={onFill(MART.fallbackPrimary).primary} />
              ) : (
                <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
                  Send for approval
                </MartText>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper, padding: GUTTER, gap: SPACE.md },
  totalCard: {
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    minHeight: 50,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
  },
  searchInput: { flex: 1, fontSize: 15, color: MART.ink },
  summary: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.xs,
    paddingBottom: SPACE.sm,
  },
  summaryLabel: { letterSpacing: 1.1 },
  list: { paddingBottom: SPACE.xxxl, gap: SPACE.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    shadowColor: MART.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  rowPressed: { backgroundColor: MART.paperSunken },
  avatar: { width: 44, height: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  suspendTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.dangerSurface,
  },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.xxxl, gap: SPACE.sm },
  centerText: { textAlign: 'center', maxWidth: 260 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Customer sheet ──
  sheetWrap: { flex: 1, backgroundColor: 'rgba(22,24,15,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: MART.paper,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: GUTTER,
    paddingBottom: SPACE.xl,
    paddingTop: SPACE.sm,
    maxHeight: '86%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: MART.borderStrong,
    marginBottom: SPACE.md,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.md },
  owedPill: {
    alignItems: 'flex-end',
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.md,
    backgroundColor: MART.danger,
  },
  purchases: { maxHeight: 360 },
  purchase: {
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  purchaseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lines: { marginTop: SPACE.sm, paddingTop: SPACE.sm, borderTopWidth: 1, borderTopColor: MART.border, gap: SPACE.xs },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  sheetActions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md },
  // ── Repayment sheet ──
  repayWrap: { flex: 1, backgroundColor: 'rgba(22,24,15,0.4)', justifyContent: 'center', padding: SPACE.lg },
  repayCard: { backgroundColor: MART.paperElevated, borderRadius: RADIUS.xl, padding: SPACE.lg, gap: SPACE.sm },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    borderWidth: 1.5,
    borderColor: MART.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    minHeight: 60,
    marginTop: SPACE.xs,
  },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '700', color: MART.ink },
  channelRow: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.xs },
  channel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    minHeight: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  channelOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  refInput: {
    borderWidth: 1,
    borderColor: MART.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    minHeight: 48,
    fontSize: 15,
    color: MART.ink,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperSunken,
  },
  repayActions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  // ── Shared buttons ──
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, minHeight: 50, borderRadius: RADIUS.pill },
  btnGhost: { borderWidth: 1, borderColor: MART.borderStrong, backgroundColor: MART.paperElevated },
  btnPrimary: { backgroundColor: MART.fallbackPrimary },
  btnOff: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});
