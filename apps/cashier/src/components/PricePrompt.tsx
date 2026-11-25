import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text, theme } from '@kiosk/ui';
import { MART } from '@kiosk/staff';
import { priceChanged, type CartLine } from '../lib/cart';
import { formatMoney, toCents } from '../lib/money';
import { checkPriceEntry, describePriceChange } from '../lib/price-entry';
import { Prompt } from './Prompt';

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
          <Text variant="body">{line.name}</Text>
          {shelfCents !== null ? (
            <Text variant="muted">
              Shelf price: {formatMoney(shelfCents)}
              {per}
            </Text>
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
            <Text variant="muted">Enter the price to sell this at.</Text>
          ) : !entry.ok ? (
            <Text variant="caption" style={styles.problem}>
              {entry.words}
            </Text>
          ) : change ? (
            <Text variant="caption" style={change.large ? styles.problem : undefined}>
              {change.words}
            </Text>
          ) : null}
          {refused ? (
            <Text variant="caption" style={styles.problem}>
              {refused}
            </Text>
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
              <Text variant="body" style={styles.shelfLabel}>
                Also update the shelf price for the whole shop
              </Text>
            </Pressable>
          ) : null}
          <View style={styles.buttons}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} style={styles.button} />
            <Button title="Change price" onPress={confirm} disabled={!entry.ok} style={styles.button} />
          </View>
          {priceChanged(line) ? <Button title="Back to shelf price" variant="secondary" onPress={onUseShelf} /> : null}
        </View>
      ) : null}
    </Prompt>
  );
}

const styles = StyleSheet.create({
  body: { gap: theme.spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 56,
    fontSize: 24,
  },
  problem: { color: theme.colors.danger },
  shelfToggle: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  shelfLabel: { flex: 1 },
  buttons: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  button: { flex: 1 },
});
