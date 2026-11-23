import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Button, Text, theme } from '@kiosk/ui';
import type { CartItem } from '../lib/cart';
import { formatMoney, toCents } from '../lib/money';
import { formatKg, previewWeighedLine } from '../lib/weight';
import { Prompt } from './Prompt';

interface WeightPromptProps {
  /** The item being weighed. Null while the prompt is closed. */
  item: CartItem | null;
  /** What the basket already holds of it, in thousandths of a kilogram. Zero when nothing. */
  inBasket: number;
  /** `add`: the weight is added to what is in the basket. `replace`: it takes the place of it. */
  mode: 'add' | 'replace';
  onCancel: () => void;
  /** Answers with words when the weight cannot be taken, and null once it has been. */
  onConfirm: (thousandths: number) => string | null;
}

export function WeightPrompt({ item, inBasket, mode, onCancel, onConfirm }: WeightPromptProps) {
  const [text, setText] = useState('');
  const [refused, setRefused] = useState<string | null>(null);

  useEffect(() => {
    setText('');
    setRefused(null);
  }, [item?.id, mode]);

  const preview = item ? previewWeighedLine(item.sellingPrice, text) : null;
  const cents = item ? toCents(item.sellingPrice) : null;
  const title = mode === 'replace' ? 'Weigh again' : inBasket > 0 ? 'Add more weight' : 'Weigh';

  const confirm = () => {
    if (!preview?.ok) return;
    setRefused(onConfirm(preview.thousandths));
  };

  return (
    <Prompt visible={item !== null} title={title} onClose={onCancel}>
      {item ? (
        <View style={styles.body}>
          <Text variant="body">{item.name}</Text>
          {cents !== null ? <Text variant="muted">{formatMoney(cents)} per kg</Text> : null}
          {inBasket > 0 ? <Text variant="muted">In the basket: {formatKg(inBasket)}</Text> : null}
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            placeholder="Weight in kg"
            maxLength={12}
            autoFocus
            selectTextOnFocus
            onSubmitEditing={confirm}
            accessibilityLabel="Weight in kilograms"
          />
          {text.trim() === '' ? (
            <Text variant="muted">Enter the weight from the scale, in kg.</Text>
          ) : preview?.ok ? (
            <Text variant="body">
              {preview.weight} = {formatMoney(preview.totalCents)}
            </Text>
          ) : (
            <Text variant="caption" style={styles.problem}>
              {preview?.words}
            </Text>
          )}
          {refused ? (
            <Text variant="caption" style={styles.problem}>
              {refused}
            </Text>
          ) : null}
          <View style={styles.buttons}>
            <Button title="Cancel" variant="secondary" onPress={onCancel} style={styles.button} />
            <Button
              title={mode === 'replace' ? 'Set weight' : 'Add to basket'}
              onPress={confirm}
              disabled={!preview?.ok}
              style={styles.button}
            />
          </View>
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
