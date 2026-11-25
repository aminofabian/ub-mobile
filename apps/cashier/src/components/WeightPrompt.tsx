import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MART, RADIUS, SPACE, tint, onFill, MartText } from '@kiosk/staff';
import type { CartItem } from '../lib/cart';
import { formatMoney, toCents } from '../lib/money';
import { formatKg, previewWeighedLine, weightForSpend } from '../lib/weight';

interface WeightPromptProps {
  item: CartItem | null;
  /** What the basket already holds of it, in thousandths of a kilogram. Zero when nothing. */
  inBasket: number;
  /** `add`: the weight is added to what is in the basket. `replace`: it takes the place of it. */
  mode: 'add' | 'replace';
  onCancel: () => void;
  /** Answers with words when the weight cannot be taken, and null once it has been. */
  onConfirm: (thousandths: number) => string | null;
}

type By = 'weight' | 'money';

/** The whole-kg and part-kg amounts a cashier reaches for most, for one tap. */
const QUICK_KG: { label: string; thousandths: number }[] = [
  { label: '¼', thousandths: 250 },
  { label: '½', thousandths: 500 },
  { label: '¾', thousandths: 750 },
  { label: '1', thousandths: 1000 },
  { label: '2', thousandths: 2000 },
];

/**
 * The weigh modal for a product sold by weight. The cashier can enter it two ways, and swap between
 * them:
 *   • By weight — type kilograms (whole or a fraction like 0.35), or tap a quick ¼ / ½ / ¾ / 1 / 2 kg.
 *   • By money — type what the customer is spending ("100") and the till works out the weight for
 *     them. The classic counter ask: "give me 100 bob of sugar" at 180/kg → 0.556 kg. No mental
 *     maths, and the price charged always matches the weight on the label.
 * Either way, the live line (weight = amount) is shown before it goes in the basket.
 */
export function WeightPrompt({ item, inBasket, mode, onCancel, onConfirm }: WeightPromptProps) {
  const [by, setBy] = useState<By>('weight');
  const [weightText, setWeightText] = useState('');
  const [moneyText, setMoneyText] = useState('');
  const [refused, setRefused] = useState<string | null>(null);

  useEffect(() => {
    setBy('weight');
    setWeightText('');
    setMoneyText('');
    setRefused(null);
  }, [item?.id, mode]);

  const perKgCents = item ? toCents(item.sellingPrice) : null;

  // The chosen way's preview: both land on {thousandths, weight, totalCents} or an error in words.
  const preview = useMemo(() => {
    if (!item) return null;
    return by === 'weight'
      ? previewWeighedLine(item.sellingPrice, weightText)
      : weightForSpend(item.sellingPrice, moneyText);
  }, [item, by, weightText, moneyText]);

  const confirm = () => {
    if (!preview?.ok || preview.thousandths == null) return;
    setRefused(onConfirm(preview.thousandths));
  };

  const title = mode === 'replace' ? 'Weigh again' : inBasket > 0 ? 'Add more weight' : 'Weigh';
  const empty = by === 'weight' ? weightText.trim() === '' : moneyText.trim() === '';

  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close" />
        {item ? (
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.scaleIcon}>
                <Ionicons name="scale-outline" size={20} color={MART.fallbackPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <MartText variant="shelf" color={MART.inkQuiet}>
                  {title.toUpperCase()}
                </MartText>
                <MartText variant="heading" numberOfLines={1}>
                  {item.name}
                </MartText>
                <MartText variant="meta" color={MART.inkQuiet}>
                  {perKgCents !== null ? `KES ${formatMoney(perKgCents)} per kg` : 'No price per kg'}
                  {inBasket > 0 ? ` · in basket ${formatKg(inBasket)}` : ''}
                </MartText>
              </View>
            </View>

            {/* By weight / By money switch */}
            <View style={styles.segment}>
              {(['weight', 'money'] as By[]).map((k) => (
                <Pressable key={k} onPress={() => setBy(k)} style={[styles.seg, by === k && styles.segOn]}>
                  <Ionicons
                    name={k === 'weight' ? 'scale-outline' : 'cash-outline'}
                    size={15}
                    color={by === k ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}
                  />
                  <MartText variant="label" color={by === k ? onFill(MART.fallbackPrimary).primary : MART.ink}>
                    {k === 'weight' ? 'By weight' : 'By money'}
                  </MartText>
                </Pressable>
              ))}
            </View>

            {/* The one input for the chosen way */}
            {by === 'weight' ? (
              <>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={weightText}
                    onChangeText={setWeightText}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={MART.inkQuiet}
                    maxLength={12}
                    autoFocus
                    selectTextOnFocus
                    onSubmitEditing={confirm}
                    accessibilityLabel="Weight in kilograms"
                  />
                  <MartText variant="title" color={MART.inkQuiet}>
                    kg
                  </MartText>
                </View>
                <View style={styles.quickRow}>
                  {QUICK_KG.map((q) => (
                    <Pressable
                      key={q.thousandths}
                      onPress={() => setWeightText(String(q.thousandths / 1000))}
                      style={({ pressed }) => [styles.quick, pressed && styles.quickPressed]}
                      accessibilityLabel={`${q.label} kilograms`}
                    >
                      <MartText variant="label" color={MART.ink}>
                        {q.label}
                      </MartText>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.inputRow}>
                <MartText variant="title" color={MART.inkQuiet}>
                  KES
                </MartText>
                <TextInput
                  style={styles.input}
                  value={moneyText}
                  onChangeText={setMoneyText}
                  keyboardType="decimal-pad"
                  placeholder="100"
                  placeholderTextColor={MART.inkQuiet}
                  maxLength={9}
                  autoFocus
                  selectTextOnFocus
                  onSubmitEditing={confirm}
                  accessibilityLabel="Amount the customer is spending"
                />
              </View>
            )}

            {/* Live result */}
            <View style={styles.result}>
              {empty ? (
                <MartText variant="meta" color={MART.inkQuiet}>
                  {by === 'weight'
                    ? 'Type the weight from the scale, or tap a quick amount.'
                    : 'Type what the customer is spending — the till works out the weight.'}
                </MartText>
              ) : preview?.ok && preview.thousandths != null ? (
                <View style={styles.resultRow}>
                  <View>
                    <MartText variant="meta" color={MART.inkQuiet}>
                      {by === 'money' ? 'That weighs' : 'Comes to'}
                    </MartText>
                    <MartText variant="title" color={MART.ink}>
                      {by === 'money' ? preview.weight : `KES ${formatMoney(preview.totalCents ?? 0)}`}
                    </MartText>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color={MART.inkQuiet} />
                  <View style={{ alignItems: 'flex-end' }}>
                    <MartText variant="meta" color={MART.inkQuiet}>
                      {by === 'money' ? 'Charge' : 'Weight'}
                    </MartText>
                    <MartText variant="title" color={MART.fallbackPrimary}>
                      {by === 'money' ? `KES ${formatMoney(preview.totalCents ?? 0)}` : preview.weight}
                    </MartText>
                  </View>
                </View>
              ) : (
                <MartText variant="meta" color={MART.danger}>
                  {preview && !preview.ok ? preview.words : ''}
                </MartText>
              )}
              {refused ? (
                <MartText variant="meta" color={MART.danger} style={{ marginTop: SPACE.xs }}>
                  {refused}
                </MartText>
              ) : null}
            </View>

            {/* Actions */}
            <View style={styles.buttons}>
              <Pressable onPress={onCancel} style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && styles.pressed]}>
                <MartText variant="label" color={MART.ink}>
                  Cancel
                </MartText>
              </Pressable>
              <Pressable
                onPress={confirm}
                disabled={!preview?.ok}
                style={({ pressed }) => [styles.btn, styles.btnPrimary, !preview?.ok && styles.btnOff, pressed && styles.pressed]}
              >
                <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
                  {mode === 'replace' ? 'Set weight' : 'Add to basket'}
                </MartText>
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(22,24,15,0.4)',
    justifyContent: 'center',
    padding: SPACE.lg,
  },
  card: {
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    padding: SPACE.lg,
    gap: SPACE.md,
    shadowColor: MART.shadowTint,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  scaleIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: tint(MART.fallbackPrimary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: { flexDirection: 'row', backgroundColor: MART.paperSunken, borderRadius: RADIUS.pill, padding: 3 },
  seg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.pill,
  },
  segOn: { backgroundColor: MART.fallbackPrimary },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    borderWidth: 1.5,
    borderColor: MART.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    minHeight: 64,
    backgroundColor: MART.paper,
  },
  input: { flex: 1, fontSize: 30, fontWeight: '700', color: MART.ink, paddingVertical: SPACE.sm },
  quickRow: { flexDirection: 'row', gap: SPACE.sm },
  quick: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPressed: { backgroundColor: tint(MART.fallbackPrimary, 0.08), borderColor: MART.borderStrong },
  result: {
    minHeight: 56,
    justifyContent: 'center',
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperSunken,
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  buttons: { flexDirection: 'row', gap: SPACE.sm },
  btn: { flex: 1, minHeight: 50, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { borderWidth: 1, borderColor: MART.borderStrong, backgroundColor: MART.paperElevated },
  btnPrimary: { backgroundColor: MART.fallbackPrimary },
  btnOff: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});
