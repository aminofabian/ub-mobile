import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT, MART, MartText, RADIUS, SPACE, WEIGHT } from '@kiosk/staff';
import { priceChanged, type CartLine } from '../lib/cart';
import { formatMoney, toCents } from '../lib/money';
import { checkPriceEntry, describePriceChange } from '../lib/price-entry';
import { Prompt } from './Prompt';
import { CashierButton } from './CashierPrimitives';

interface PricePromptProps {
  /** The line whose price is being changed. Null while the prompt is closed. */
  line: CartLine | null;
  /** Whether this till may write the shelf price for the whole shop (not just this sale). */
  canSetShelf?: boolean;
  onCancel: () => void;
  /** Answers with words when the price cannot be taken, and null once it has been. `alsoShelf` asks
   * to make the new price the shop's shelf price too. */
  onConfirm: (cents: number, alsoShelf: boolean) => string | null;
  /** Puts the line back on the shelf price. */
  onUseShelf: () => void;
}

export function PricePrompt({ line, canSetShelf, onCancel, onConfirm, onUseShelf }: PricePromptProps) {
  const [text, setText] = useState('');
  const [refused, setRefused] = useState<string | null>(null);
  const [alsoShelf, setAlsoShelf] = useState(false);

  useEffect(() => {
    setText('');
    setRefused(null);
    setAlsoShelf(false);
  }, [line?.itemId]);

  const shelfCents = line ? toCents(line.shelfPrice ?? line.unitPrice) : null;
  const entry = checkPriceEntry(text);
  const change = entry.ok && shelfCents !== null ? describePriceChange(shelfCents, entry.cents) : null;
  const per = line?.weighed ? ' per kg' : '';

  const confirm = () => {
    if (!entry.ok) return;
    setRefused(onConfirm(entry.cents, alsoShelf && canSetShelf === true));
  };

  return (
    <Prompt visible={line !== null} title="Change price" onClose={onCancel}>
      {line ? (
        <View style={styles.body}>
          <MartText variant="heading">{line.name}</MartText>
          {shelfCents !== null ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              Shelf price: KES {formatMoney(shelfCents)}
              {per}
            </MartText>
          ) : null}
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            placeholder={`New price${per}`}
            maxLength={14}
            autoFocus
            selectTextOnFocus
            onSubmitEditing={confirm}
            accessibilityLabel="New price"
          />
          {text.trim() === '' ? (
            <MartText variant="meta" color={MART.inkQuiet}>Enter the price to sell this at.</MartText>
          ) : !entry.ok ? (
            <MartText variant="meta" style={styles.problem}>
              {entry.words}
            </MartText>
          ) : change ? (
            <MartText variant="meta" color={change.large ? MART.danger : MART.inkMuted}>
              {change.words}
            </MartText>
          ) : null}
          {refused ? (
            <MartText variant="meta" style={styles.problem}>
              {refused}
            </MartText>
          ) : null}
          {canSetShelf && entry.ok ? (
            <Pressable
              onPress={() => setAlsoShelf((v) => !v)}
              style={styles.shelfToggle}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: alsoShelf }}
            >
              <Ionicons
                name={alsoShelf ? 'checkbox' : 'square-outline'}
                size={20}
                color={alsoShelf ? MART.fallbackPrimary : MART.inkMuted}
              />
              <MartText variant="label" style={styles.shelfLabel}>
                Also update the shelf price for the whole shop
              </MartText>
            </Pressable>
          ) : null}
          <View style={styles.buttons}>
            <CashierButton title="Cancel" variant="secondary" onPress={onCancel} style={styles.button} />
            <CashierButton title="Change price" onPress={confirm} disabled={!entry.ok} style={styles.button} />
          </View>
          {priceChanged(line) ? <CashierButton title="Back to shelf price" variant="secondary" onPress={onUseShelf} style={styles.shelfReset} /> : null}
        </View>
      ) : null}
    </Prompt>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.sm },
  // The new price is the one thing typed here, so it is set large — and its box matches every field in the till.
  input: {
    borderWidth: 1.5,
    borderColor: MART.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    minHeight: 56,
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 24,
    color: MART.ink,
    backgroundColor: MART.paperElevated,
  },
  problem: { color: MART.danger },
  shelfToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xs },
  shelfLabel: { flex: 1 },
  buttons: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  button: { flex: 1, paddingHorizontal: SPACE.md },
  shelfReset: { marginTop: SPACE.xs },
});
