import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Button, Text, theme } from '@kiosk/ui';
import { priceChanged, type CartLine } from '../lib/cart';
import { formatMoney, toCents } from '../lib/money';
import { checkPriceEntry, describePriceChange } from '../lib/price-entry';
import { Prompt } from './Prompt';

interface PricePromptProps {
  /** The line whose price is being changed. Null while the prompt is closed. */
  line: CartLine | null;
  onCancel: () => void;
  /** Answers with words when the price cannot be taken, and null once it has been. */
  onConfirm: (cents: number) => string | null;
  /** Puts the line back on the shelf price. */
  onUseShelf: () => void;
}

export function PricePrompt({ line, onCancel, onConfirm, onUseShelf }: PricePromptProps) {
  const [text, setText] = useState('');
  const [refused, setRefused] = useState<string | null>(null);

  useEffect(() => {
    setText('');
    setRefused(null);
  }, [line?.itemId]);

  const shelfCents = line ? toCents(line.shelfPrice ?? line.unitPrice) : null;
  const entry = checkPriceEntry(text);
  const change = entry.ok && shelfCents !== null ? describePriceChange(shelfCents, entry.cents) : null;
  const per = line?.weighed ? ' per kg' : '';

  const confirm = () => {
    if (!entry.ok) return;
    setRefused(onConfirm(entry.cents));
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
  buttons: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  button: { flex: 1 },
});
