import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ApiClient } from '@kiosk/core';
import { MART, RADIUS, SPACE, onFill, MartText } from '@kiosk/staff';
import { recordDrawout } from '../api/pos-api';
import { BottomSheet } from './BottomSheet';

type IconName = keyof typeof Ionicons.glyphMap;
/** The cash pay-out reasons a till reaches for. The value is what the server records; the label is shown. */
const CATEGORIES: { value: string; label: string; icon: IconName }[] = [
  { value: 'SUPPLIER_PAYMENT', label: 'Supplier', icon: 'cube-outline' },
  { value: 'SALARY', label: 'Wages', icon: 'people-outline' },
  { value: 'TRANSPORT', label: 'Transport', icon: 'car-outline' },
  { value: 'RENT', label: 'Rent', icon: 'home-outline' },
  { value: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal' },
];

/**
 * Record a cash pay-out from the open till. The cashier enters how much, what for, and who it went
 * to; the shift's cash drops by it. A large one may need an owner's nod — the server decides and the
 * sheet says so.
 */
export function DrawoutSheet({
  api,
  shiftId,
  visible,
  onClose,
  onRecorded,
}: {
  api: ApiClient;
  shiftId: string | null;
  visible: boolean;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState('SUPPLIER_PAYMENT');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmountText('');
      setCategory('SUPPLIER_PAYMENT');
      setRecipient('');
      setNote('');
      setBusy(false);
    }
  }, [visible]);

  const amount = parseFloat(amountText.replace(/[^0-9.]/g, ''));
  const amountOk = Number.isFinite(amount) && amount > 0;
  const ok = amountOk && recipient.trim().length > 0 && shiftId;

  const submit = async () => {
    if (!ok || busy || !shiftId) return;
    setBusy(true);
    try {
      const { pendingApproval } = await recordDrawout(api, shiftId, {
        amount,
        category,
        description: note.trim() || CATEGORIES.find((c) => c.value === category)?.label || 'Drawout',
        recipientName: recipient.trim(),
      });
      Alert.alert(
        pendingApproval ? 'Sent for approval' : 'Pay-out recorded',
        pendingApproval
          ? 'This pay-out needs an owner to approve it before the cash leaves the till.'
          : 'The shift cash has been reduced by this pay-out.'
      );
      onRecorded();
      onClose();
    } catch (e) {
      Alert.alert('Could not record it', e instanceof Error ? e.message : 'You may not be allowed to draw out. Ask an owner.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
          <View style={styles.head}>
            <View style={styles.headMark}>
              <Ionicons name="cash-outline" size={18} color={MART.fallbackPrimary} />
            </View>
            <View style={styles.headText}>
              <MartText variant="title">Cash pay-out</MartText>
              <MartText variant="meta" color={MART.inkQuiet}>
                Cash leaves the till now, and the shift records why.
              </MartText>
            </View>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: SPACE.sm, paddingTop: SPACE.md }}>
            <MartText variant="shelf" color={MART.inkQuiet} style={styles.amountLabel}>
              HOW MUCH
            </MartText>
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
                accessibilityLabel="Amount"
              />
            </View>

            <MartText variant="label" color={MART.inkMuted}>
              What for
            </MartText>
            <View style={styles.catRow}>
              {CATEGORIES.map((c) => (
                <Pressable key={c.value} onPress={() => setCategory(c.value)} style={[styles.cat, category === c.value && styles.catOn]}>
                  <Ionicons name={c.icon} size={15} color={category === c.value ? onFill(MART.fallbackPrimary).primary : MART.inkMuted} />
                  <MartText variant="label" color={category === c.value ? onFill(MART.fallbackPrimary).primary : MART.ink}>
                    {c.label}
                  </MartText>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={recipient}
              onChangeText={setRecipient}
              placeholder="Who received it"
              placeholderTextColor={MART.inkQuiet}
              style={styles.input}
              accessibilityLabel="Recipient name"
            />
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Note (optional)"
              placeholderTextColor={MART.inkQuiet}
              style={styles.input}
              accessibilityLabel="Note"
            />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}>
              <MartText variant="label" color={MART.ink}>
                Cancel
              </MartText>
            </Pressable>
            <Pressable
              onPress={() => void submit()}
              disabled={!ok || busy}
              style={({ pressed }) => [styles.btn, styles.btnPrimary, (!ok || busy) && styles.btnOff, pressed && styles.pressed]}
            >
              {busy ? (
                <ActivityIndicator color={onFill(MART.fallbackPrimary).primary} />
              ) : (
                <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
                  Record pay-out
                </MartText>
              )}
            </Pressable>
          </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: 'rgba(22,24,15,0.4)', justifyContent: 'flex-end' },
  // A native page sheet fills the card the system hands it; its own scrim, grip and top radius are gone.
  sheet: {
    flex: 1,
    backgroundColor: MART.paper,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.xl,
    gap: SPACE.xs,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  headMark: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,83,45,0.08)',
  },
  headText: { flex: 1, gap: 2 },
  amountLabel: { letterSpacing: 1.2, marginTop: SPACE.md },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    borderWidth: 1.5,
    borderColor: MART.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    minHeight: 60,
  },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '700', color: MART.ink },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  cat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  catOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  input: {
    borderWidth: 1,
    borderColor: MART.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    minHeight: 50,
    fontSize: 15,
    color: MART.ink,
    backgroundColor: MART.paperElevated,
  },
  actions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  btn: { flex: 1, minHeight: 50, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { borderWidth: 1, borderColor: MART.borderStrong, backgroundColor: MART.paperElevated },
  btnPrimary: { backgroundColor: MART.fallbackPrimary },
  btnOff: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});
