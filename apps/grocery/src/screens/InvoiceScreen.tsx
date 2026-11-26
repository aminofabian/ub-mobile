import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatKes, readFailureWords } from '@kiosk/core';
import { Gloss, MartText, PressableScale, FONT, MART, RADIUS, SHADOW, SPACE, WEIGHT, onFill, tint } from '@kiosk/staff';
import { Banner, Button, Text } from '@kiosk/ui';
import { cancelInvoice, fetchInvoice } from '../api/grocery-api';
import {
  canCancel,
  cancelBody,
  cancelFailureWords,
  cancelOutcomeOf,
  CANCEL_REASONS,
  classifyCancel,
  expiryWords,
  MAX_CANCEL_REASON,
  stateWords,
  type CancelReasonKey,
  type GroceryInvoice,
} from '../lib/invoices';
import { invoiceTone, whenWords, type Say, type Tone } from '../lib/sale-words';
import { useGrocerySession } from '../lib/session';
import { useNow } from '../lib/useNow';
import type { GroceryStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<GroceryStackParamList, 'Invoice'>;

const STATE_INK: Record<Tone, string> = {
  normal: MART.inkMuted,
  ok: MART.success,
  warn: MART.warning,
  danger: MART.danger,
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <MartText variant="meta" color={MART.inkQuiet}>
        {label}
      </MartText>
      <MartText variant="heading" style={styles.factValue} numberOfLines={2}>
        {value}
      </MartText>
    </View>
  );
}

/**
 * One invoice as the server has it now, with the code to read out and, for someone who may, the way to cancel it. A
 * cancel is sent once. If no answer comes back, nobody knows whether it went through, so the invoice is read again and
 * the person is told what it is now rather than being offered another try blindly.
 */
export function InvoiceScreen({ route }: Props) {
  const { invoiceId } = route.params;
  const { api, user } = useGrocerySession();
  const now = useNow();
  const [invoice, setInvoice] = useState<GroceryInvoice | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState<CancelReasonKey | null>(null);
  const [typed, setTyped] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [say, setSay] = useState<Say | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const read = await fetchInvoice(api, invoiceId);
      if (read) {
        setInvoice(read);
        setFailed(null);
      } else {
        setFailed('The server sent something the app could not read.');
      }
    } catch (error) {
      setFailed(readFailureWords(error));
    } finally {
      setLoading(false);
    }
  }, [api, invoiceId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const doCancel = useCallback(
    async (target: GroceryInvoice, body: { reason: string }) => {
      setCancelling(true);
      setSay(null);
      try {
        await cancelInvoice(api, target.id, body);
        setSay({ tone: 'ok', text: 'The invoice was cancelled.' });
        await load();
      } catch (error) {
        const kind = classifyCancel(error);
        if (kind !== 'doubt') {
          setSay({ tone: 'danger', text: cancelFailureWords[kind] });
          await load();
          return;
        }
        let after: GroceryInvoice | null = null;
        try {
          after = await fetchInvoice(api, target.id);
        } catch {
          after = null;
        }
        if (after) setInvoice(after);
        const outcome = cancelOutcomeOf(after);
        if (outcome === 'cancelled') setSay({ tone: 'ok', text: 'The invoice was cancelled.' });
        else if (outcome === 'open')
          setSay({
            tone: 'warn',
            text: 'The cancellation did not go through. The invoice is still waiting for payment. You can try again.',
          });
        else if (outcome === 'closed')
          setSay({
            tone: 'warn',
            text: `The invoice is no longer waiting for payment: it is ${after ? stateWords[after.state].toLowerCase() : 'closed'}.`,
          });
        else
          setSay({
            tone: 'warn',
            text: 'Could not tell whether it was cancelled. Check the signal and look at this invoice again before doing anything else.',
          });
      } finally {
        setCancelling(false);
      }
    },
    [api, load]
  );

  const confirmCancel = useCallback(
    (target: GroceryInvoice) => {
      if (!reason) return;
      const body = cancelBody(reason, typed);
      if (!body) {
        setSay({ tone: 'warn', text: 'Say why it is being cancelled.' });
        return;
      }
      const atTill = target.lockedByName ? ` It is open at the till with ${target.lockedByName}.` : '';
      Alert.alert(target.code ? `Cancel invoice ${target.code}?` : 'Cancel this invoice?', `The customer will not be able to pay it.${atTill}`, [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Cancel the invoice', style: 'destructive', onPress: () => void doCancel(target, body) },
      ]);
    },
    [doCancel, reason, typed]
  );

  if (!invoice) {
    return (
      <View style={styles.fill}>
        <Gloss />
        {failed ? (
          <Banner tone="danger" style={styles.pad}>
            <Text variant="caption">{failed}</Text>
            <Button title="Try again" variant="secondary" onPress={() => void load()} style={styles.gap} />
          </Banner>
        ) : loading ? (
          <ActivityIndicator style={styles.pad} color={MART.fallbackPrimary} />
        ) : null}
      </View>
    );
  }

  const tone = invoiceTone(invoice);
  const expiry = expiryWords(invoice, now);
  const mayCancel = canCancel(invoice, user);
  const needsWords = reason === 'other' && typed.trim().length === 0;

  return (
    <View style={styles.fill}>
      <Gloss />
      <ScrollView style={styles.fill} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {say ? <Banner tone={say.tone}>{say.text}</Banner> : null}
        {failed ? <Banner tone="warn">{`Could not refresh this invoice. ${failed}`}</Banner> : null}

        <View style={styles.head}>
          <MartText variant="shelf" color={MART.inkQuiet} style={styles.eyebrow}>
            CASHIER CODE
          </MartText>
          <MartText variant="display" selectable style={styles.code}>
            {invoice.code ?? 'No code'}
          </MartText>
          <View style={[styles.statePill, { backgroundColor: tint(STATE_INK[tone], 0.14) }]}>
            <MartText variant="shelf" color={STATE_INK[tone]} style={styles.stateLabel}>
              {stateWords[invoice.state]}
            </MartText>
          </View>
          {expiry ? (
            <MartText variant="meta" color={MART.inkQuiet} style={styles.headMeta}>
              {expiry}
            </MartText>
          ) : null}
          {invoice.lockedByName ? (
            <MartText variant="meta" color={MART.inkQuiet} style={styles.headMeta}>
              {`Open at the till with ${invoice.lockedByName}`}
            </MartText>
          ) : null}
        </View>

        <View style={styles.card}>
          {invoice.totalCents !== null ? <Fact label="Total" value={formatKes(invoice.totalCents)} /> : null}
          {invoice.lineCount > 0 ? <Fact label="Items" value={String(invoice.lineCount)} /> : null}
          {invoice.createdByName ? <Fact label="Made by" value={invoice.createdByName} /> : null}
          {invoice.createdAt !== null ? <Fact label="Made" value={whenWords(invoice.createdAt, now)} /> : null}
          {invoice.remote && invoice.customerPhone ? <Fact label="Customer" value={invoice.customerPhone} /> : null}
        </View>

        {mayCancel ? (
          <View style={styles.card}>
            <MartText variant="heading">Cancel this invoice</MartText>
            <MartText variant="meta" color={MART.inkQuiet}>
              Why?
            </MartText>
            <View style={styles.chips}>
              {CANCEL_REASONS.map((entry) => {
                const on = reason === entry.key;
                return (
                  <Pressable
                    key={entry.key}
                    onPress={() => setReason(entry.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <MartText
                      variant="label"
                      color={on ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}
                      style={[styles.chipLabel, on && styles.chipLabelOn]}
                    >
                      {entry.words}
                    </MartText>
                  </Pressable>
                );
              })}
            </View>
            {reason === 'other' ? (
              <TextInput
                value={typed}
                onChangeText={setTyped}
                placeholder="What happened?"
                placeholderTextColor={MART.inkQuiet}
                maxLength={MAX_CANCEL_REASON}
                autoCapitalize="sentences"
                style={styles.field}
              />
            ) : null}
            <PressableScale
              onPress={() => confirmCancel(invoice)}
              disabled={cancelling || !reason || needsWords}
              scaleTo={0.98}
              style={[styles.cancelBtn, (cancelling || !reason || needsWords) && styles.dim]}
              accessibilityRole="button"
              accessibilityLabel={cancelling ? 'Cancelling' : 'Cancel invoice'}
            >
              <MartText variant="label" color={MART.danger} style={styles.cancelLabel}>
                {cancelling ? 'Cancelling…' : 'Cancel invoice'}
              </MartText>
            </PressableScale>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  pad: { margin: SPACE.md },
  body: { padding: SPACE.md, gap: SPACE.md, paddingBottom: SPACE.xxxl },
  gap: { marginTop: SPACE.sm },
  head: {
    alignItems: 'center',
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    gap: SPACE.sm,
    ...SHADOW.card,
  },
  eyebrow: { letterSpacing: 1.1 },
  code: { letterSpacing: 2, textAlign: 'center' },
  statePill: {
    marginTop: SPACE.xs,
    paddingHorizontal: SPACE.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  stateLabel: { letterSpacing: 0.2 },
  headMeta: { textAlign: 'center' },
  card: {
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    padding: SPACE.md,
    gap: SPACE.sm,
    ...SHADOW.card,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MART.border,
  },
  factValue: { flexShrink: 1, textAlign: 'right', fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.xs },
  chip: {
    minHeight: 36,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperSunken,
  },
  chipOn: { backgroundColor: MART.fallbackPrimary },
  chipLabel: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium },
  chipLabelOn: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  field: {
    marginTop: SPACE.xs,
    minHeight: 48,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperSunken,
    color: MART.ink,
    fontFamily: FONT.regular,
    fontSize: 15,
  },
  cancelBtn: {
    marginTop: SPACE.sm,
    minHeight: 48,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.dangerSurface,
  },
  cancelLabel: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  dim: { opacity: 0.5 },
});
