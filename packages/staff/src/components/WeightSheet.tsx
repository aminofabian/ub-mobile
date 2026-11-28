import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { MART, RADIUS, SPACE, tint } from '../theme/mart';
import { MartText } from '../theme/mart-ui';
import { Sheet } from './Sheet';

/** The fractions a counter reaches for most, in thousandths of the item's unit. */
const QUICK = [
  { label: '¼', thousandths: 250 },
  { label: '½', thousandths: 500 },
  { label: '¾', thousandths: 750 },
  { label: '1', thousandths: 1000 },
  { label: '2', thousandths: 2000 },
];

type By = 'weight' | 'money';

/**
 * The weigh sheet for a product sold by weight: the till's own prompt, shared.
 *
 * Two ways to answer, and a way to swap between them:
 *   • by weight — type kilograms (0.35), or tap ¼ / ½ / ¾ / 1 / 2;
 *   • by money — type what the customer is spending, and the sheet works out the weight ("100 bob of sugar").
 * The live line shows the weight and what it costs before anything goes into the basket, so the label and the charge can
 * never disagree.
 */
export function WeightSheet({
  visible,
  name,
  unit = 'kg',
  perUnitCents,
  onCancel,
  onConfirm,
  onNotWeighed,
}: {
  visible: boolean;
  name: string;
  unit?: string;
  /** What one unit costs, in cents. Null when the product has no price and cannot be sold by weight. */
  perUnitCents: number | null;
  onCancel: () => void;
  /** Answers with words when it cannot be taken, and null once it has been. */
  onConfirm: (thousandths: number) => string | null;
  /**
   * Offered when the product is not really sold by weight: stops treating it that way. Answers with words on failure, or
   * null once the item has been changed.
   */
  onNotWeighed?: () => Promise<string | null>;
}) {
  const [by, setBy] = useState<By>('weight');
  const [weightText, setWeightText] = useState('');
  const [moneyText, setMoneyText] = useState('');
  const [refused, setRefused] = useState<string | null>(null);

  const thousandths = useMemo(() => {
    if (by === 'weight') {
      const value = Number(weightText.replace(/[^0-9.]/g, ''));
      return Number.isFinite(value) && value > 0 ? Math.round(value * 1000) : null;
    }
    if (perUnitCents === null) return null;
    const spend = Number(moneyText.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(spend) || spend <= 0) return null;
    // Money ÷ price per unit × 1000, rounded to the nearest gram.
    return Math.round((spend * 100 * 1000) / perUnitCents);
  }, [by, weightText, moneyText, perUnitCents]);

  const totalCents = thousandths !== null && perUnitCents !== null ? Math.round((thousandths * perUnitCents) / 1000) : null;
  const kg = thousandths === null ? null : thousandths / 1000;
  const problem = perUnitCents === null ? 'This product has no price, so it cannot be weighed.' : refused;

  const submit = () => {
    if (thousandths === null) {
      setRefused(by === 'weight' ? 'Type a weight above zero.' : 'Type an amount above zero.');
      return;
    }
    setRefused(onConfirm(thousandths));
  };

  return (
    <Sheet visible={visible} onClose={onCancel} title={name}>
      <View style={styles.body}>
        <View style={styles.modes}>
          {(['weight', 'money'] as const).map((mode) => {
            const on = by === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => {
                  setBy(mode);
                  setRefused(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.mode, on && styles.modeOn]}
              >
                <MartText variant="label" color={on ? MART.paper : MART.inkMuted}>
                  {mode === 'weight' ? `By ${unit}` : 'By money'}
                </MartText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.amount}>
          <MartText variant="shelf" color={MART.inkQuiet}>
            {by === 'weight' ? unit.toUpperCase() : 'WHAT THEY ARE SPENDING'}
          </MartText>
          <TextInput
            value={by === 'weight' ? weightText : moneyText}
            onChangeText={(text) => {
              setRefused(null);
              if (by === 'weight') setWeightText(text);
              else setMoneyText(text);
            }}
            keyboardType="decimal-pad"
            placeholder={by === 'weight' ? '0.35' : '100'}
            placeholderTextColor={MART.inkQuiet}
            style={styles.input}
            accessibilityLabel={by === 'weight' ? `Weight in ${unit}` : 'Amount in shillings'}
          />
        </View>

        {by === 'weight' ? (
          <View style={styles.quick}>
            {QUICK.map((choice) => (
              <Pressable
                key={choice.label}
                onPress={() => {
                  setWeightText(String(choice.thousandths / 1000));
                  setRefused(null);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${choice.thousandths / 1000} ${unit}`}
                style={({ pressed }) => [styles.quickKey, pressed && styles.pressed]}
              >
                <MartText variant="label">{choice.label}</MartText>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.live}>
          {kg !== null && totalCents !== null ? (
            <MartText variant="title" numberOfLines={1}>
              {kg.toLocaleString('en-KE', { maximumFractionDigits: 3 })} {unit} · KES{' '}
              {(totalCents / 100).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </MartText>
          ) : (
            <MartText variant="meta" color={MART.inkQuiet}>
              {by === 'weight' ? `Type how many ${unit}, or tap a fraction.` : 'Type what the customer is spending.'}
            </MartText>
          )}
        </View>

        {problem ? (
          <MartText variant="meta" color={MART.danger}>
            {problem}
          </MartText>
        ) : null}

        {onNotWeighed ? (
          <Pressable
            onPress={() => {
              setRefused(null);
              void onNotWeighed().then((problem) => setRefused(problem));
            }}
            accessibilityRole="button"
            style={styles.notWeighed}
          >
            <MartText variant="meta" color={MART.inkMuted} style={styles.notWeighedText}>
              This item isn't sold by weight — stop weighing it
            </MartText>
          </Pressable>
        ) : null}

        <View style={styles.actions}>
          <Pressable onPress={onCancel} accessibilityRole="button" style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
            <MartText variant="label" color={MART.inkMuted}>
              Cancel
            </MartText>
          </Pressable>
          <Pressable onPress={submit} accessibilityRole="button" style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
            <MartText variant="label" color={MART.paper}>
              Add to basket
            </MartText>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.md, paddingTop: SPACE.xs },
  modes: { flexDirection: 'row', gap: 6, padding: 3, borderRadius: RADIUS.pill, backgroundColor: MART.paperSunken },
  mode: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  modeOn: { backgroundColor: MART.fallbackPrimary },
  amount: { alignItems: 'center', gap: 2 },
  input: { fontSize: 40, fontWeight: '700', color: MART.ink, textAlign: 'center', minWidth: 160, paddingVertical: 4 },
  quick: { flexDirection: 'row', gap: 6 },
  quickKey: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, backgroundColor: tint(MART.fallbackPrimary, 0.08) },
  live: { alignItems: 'center', minHeight: 30, justifyContent: 'center' },
  notWeighed: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 10 },
  notWeighedText: { textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', gap: SPACE.sm, paddingTop: SPACE.xs },
  cancel: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: MART.paperSunken },
  add: { flex: 2, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill, backgroundColor: MART.fallbackPrimary },
  pressed: { opacity: 0.85 },
});
