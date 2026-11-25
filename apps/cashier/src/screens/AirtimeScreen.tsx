import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ApiClient } from '@kiosk/core';
import { GUTTER, MART, RADIUS, SPACE, tint, onFill, MartText } from '@kiosk/staff';
import { fetchAirtimeSettings, sellAirtime, type AirtimeOrder, type AirtimeSettings } from '../api/airtime-api';
import { normalizeKenyanPhone } from '../lib/phone';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Airtime'> & {
  api: ApiClient;
};

const PRESETS = [20, 50, 100, 250, 500, 1000];

function kes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Sell airtime from the till. Enter the customer's phone and an amount (or tap a preset), pick how
 * they paid, and send it. The order confirms with the telco a moment later; the screen shows it on
 * its way and settles to done or failed. The shop's airtime float is shown so a cashier knows when
 * it is running low.
 */
export function AirtimeScreen({ api, navigation }: Props) {
  const [settings, setSettings] = useState<AirtimeSettings | null>(null);
  const [phone, setPhone] = useState('');
  const [amountText, setAmountText] = useState('');
  const [tender, setTender] = useState<'CASH' | 'MPESA'>('CASH');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AirtimeOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(() => {
    fetchAirtimeSettings(api).then(setSettings, () => setSettings(null));
  }, [api]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const amount = parseFloat(amountText.replace(/[^0-9.]/g, ''));
  const phoneOk = normalizeKenyanPhone(phone) !== null;
  const amountOk =
    Number.isFinite(amount) &&
    amount > 0 &&
    (!settings || (amount >= settings.minAmount && amount <= settings.maxAmount));
  const commission = settings && amountOk ? (amount * settings.commissionPercent) / 100 : 0;

  const send = async () => {
    const normalized = normalizeKenyanPhone(phone);
    if (!normalized || !amountOk || busy) return;
    setBusy(true);
    setError(null);
    try {
      const order = await sellAirtime(api, { phoneNumber: normalized, amount, tender });
      setResult(order);
      loadSettings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the airtime. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setPhone('');
    setAmountText('');
    setTender('CASH');
  };

  // ── Result view ──
  if (result) {
    const failed = /fail|error|declin/i.test(result.status) || result.failureReason != null;
    const pending = !failed && /pend|process|flight|await|sent/i.test(result.status);
    return (
      <View style={styles.screen}>
        <View style={styles.resultCard}>
          <View style={[styles.resultIcon, { backgroundColor: failed ? MART.dangerSurface : tint(MART.fallbackPrimary, 0.12) }]}>
            <Ionicons
              name={failed ? 'close-circle' : pending ? 'time-outline' : 'checkmark-circle'}
              size={40}
              color={failed ? MART.danger : MART.fallbackPrimary}
            />
          </View>
          <MartText variant="title" style={styles.resultTitle}>
            {failed ? 'Airtime failed' : pending ? 'Airtime on its way' : 'Airtime sent'}
          </MartText>
          <MartText variant="body" color={MART.inkMuted} style={styles.resultBody}>
            {kes(result.amount)} to {result.phoneNumber}
            {failed && result.failureReason ? `\n${result.failureReason}` : ''}
            {pending ? '\nThe telco confirms in a moment.' : ''}
          </MartText>
          {!failed && result.commission > 0 ? (
            <View style={styles.commissionPill}>
              <Ionicons name="trending-up" size={14} color={MART.fallbackPrimary} />
              <MartText variant="label" color={MART.fallbackPrimary}>
                {kes(result.commission)} commission
              </MartText>
            </View>
          ) : null}
        </View>
        <View style={styles.resultActions}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}>
            <MartText variant="label" color={MART.ink}>
              Done
            </MartText>
          </Pressable>
          <Pressable onPress={reset} style={({ pressed }) => [styles.btn, styles.btnPrimary, pressed && styles.pressed]}>
            <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
              Sell more
            </MartText>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Blocked view ──
  if (settings && !settings.sellable) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIcon}>
          <Ionicons name="cellular-outline" size={26} color={MART.inkQuiet} />
        </View>
        <MartText variant="heading" style={styles.centerText}>
          Airtime is off
        </MartText>
        <MartText variant="meta" color={MART.inkQuiet} style={styles.centerText}>
          {settings.blockedReason ?? 'Ask the owner to turn on airtime selling for this till.'}
        </MartText>
      </View>
    );
  }

  // ── Sell form ──
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      {settings === null ? (
        <ActivityIndicator color={MART.fallbackPrimary} style={{ marginTop: SPACE.xl }} />
      ) : (
        <>
          <View style={styles.floatCard}>
            <MartText variant="meta" color={MART.inkQuiet}>
              Airtime float
            </MartText>
            <MartText variant="title" color={settings.walletBalance < 100 ? MART.warning : MART.ink}>
              {kes(settings.walletBalance)}
            </MartText>
          </View>

          <MartText variant="label" color={MART.inkMuted} style={styles.fieldLabel}>
            Customer's phone
          </MartText>
          <View style={styles.inputRow}>
            <Ionicons name="phone-portrait-outline" size={18} color={MART.inkQuiet} />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="07xx xxx xxx"
              placeholderTextColor={MART.inkQuiet}
              style={styles.input}
              accessibilityLabel="Customer phone number"
            />
          </View>

          <MartText variant="label" color={MART.inkMuted} style={styles.fieldLabel}>
            Amount
          </MartText>
          <View style={styles.inputRow}>
            <MartText variant="heading" color={MART.inkQuiet}>
              KES
            </MartText>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={MART.inkQuiet}
              style={styles.input}
              accessibilityLabel="Airtime amount"
            />
          </View>
          <View style={styles.presetRow}>
            {PRESETS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setAmountText(String(p))}
                style={({ pressed }) => [styles.preset, amount === p && styles.presetOn, pressed && styles.pressed]}
              >
                <MartText variant="label" color={amount === p ? onFill(MART.fallbackPrimary).primary : MART.ink}>
                  {p}
                </MartText>
              </Pressable>
            ))}
          </View>

          <MartText variant="label" color={MART.inkMuted} style={styles.fieldLabel}>
            Paid with
          </MartText>
          <View style={styles.tenderRow}>
            {(['CASH', 'MPESA'] as const).map((t) => (
              <Pressable key={t} onPress={() => setTender(t)} style={[styles.tender, tender === t && styles.tenderOn]}>
                <Ionicons
                  name={t === 'CASH' ? 'cash-outline' : 'phone-portrait-outline'}
                  size={16}
                  color={tender === t ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}
                />
                <MartText variant="label" color={tender === t ? onFill(MART.fallbackPrimary).primary : MART.ink}>
                  {t === 'CASH' ? 'Cash' : 'M-Pesa'}
                </MartText>
              </Pressable>
            ))}
          </View>

          {commission > 0 ? (
            <MartText variant="meta" color={MART.inkQuiet} style={{ marginTop: SPACE.xs }}>
              You earn {kes(commission)} commission on this.
            </MartText>
          ) : null}
          {error ? (
            <View style={styles.errorBar}>
              <Ionicons name="warning-outline" size={16} color={MART.danger} />
              <MartText variant="meta" color={MART.danger} style={{ flex: 1 }}>
                {error}
              </MartText>
            </View>
          ) : null}

          <Pressable
            onPress={() => void send()}
            disabled={!phoneOk || !amountOk || busy}
            style={({ pressed }) => [
              styles.sellBtn,
              (!phoneOk || !amountOk || busy) && styles.btnOff,
              pressed && styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={onFill(MART.fallbackPrimary).primary} />
            ) : (
              <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
                {amountOk ? `Send ${kes(amount)} airtime` : 'Send airtime'}
              </MartText>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper },
  body: { padding: GUTTER, gap: SPACE.sm },
  floatCard: {
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
    marginBottom: SPACE.sm,
  },
  fieldLabel: { marginTop: SPACE.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    minHeight: 54,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
  },
  input: { flex: 1, fontSize: 18, color: MART.ink },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.sm },
  preset: {
    minWidth: 56,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
    alignItems: 'center',
  },
  presetOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  tenderRow: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  tender: {
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
  tenderOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.sm,
    marginTop: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: MART.dangerSurface,
  },
  sellBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    marginTop: SPACE.lg,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
  },
  btnOff: { opacity: 0.45 },
  // Result
  resultCard: { alignItems: 'center', gap: SPACE.sm, padding: SPACE.xxxl },
  resultIcon: { width: 80, height: 80, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { marginTop: SPACE.sm },
  resultBody: { textAlign: 'center' },
  commissionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    marginTop: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.fallbackPrimary, 0.1),
  },
  resultActions: { flexDirection: 'row', gap: SPACE.sm, padding: GUTTER },
  // Shared
  btn: { flex: 1, minHeight: 50, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { borderWidth: 1, borderColor: MART.borderStrong, backgroundColor: MART.paperElevated },
  btnPrimary: { backgroundColor: MART.fallbackPrimary },
  pressed: { opacity: 0.8 },
  center: { flex: 1, backgroundColor: MART.paper, alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, padding: GUTTER },
  centerText: { textAlign: 'center', maxWidth: 280 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
