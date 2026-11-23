import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, Text, theme } from '@kiosk/ui';
import { describeBasket, type HeldBasket } from '../lib/holds';
import { Prompt } from './Prompt';

interface HeldBasketsSheetProps {
  visible: boolean;
  baskets: readonly HeldBasket[];
  now: number;
  /** A basket is being picked up: nothing else can be done until it is. */
  busy: boolean;
  onClose: () => void;
  onRecall: (id: string) => void;
  onDiscard: (id: string) => void;
}

/** What is in a basket, by the first few names. */
function contents(basket: HeldBasket): string {
  const names = basket.lines.slice(0, 3).map((line) => line.name);
  return basket.lines.length > 3 ? `${names.join(', ')} and more` : names.join(', ');
}

export function HeldBasketsSheet({ visible, baskets, now, busy, onClose, onRecall, onDiscard }: HeldBasketsSheetProps) {
  const throwAway = (basket: HeldBasket) =>
    Alert.alert(`Throw away ${basket.label}?`, 'Its items are removed for good.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Throw away', style: 'destructive', onPress: () => onDiscard(basket.id) },
    ]);

  return (
    <Prompt visible={visible} title="Held baskets" onClose={busy ? () => undefined : onClose}>
      {baskets.length === 0 ? <Text variant="muted">Nothing is on hold.</Text> : null}
      {baskets.map((basket) => {
        const words = describeBasket(basket, now);
        return (
          <View key={basket.id} style={styles.basket}>
            <Text variant="body">{words.title}</Text>
            <Text variant="muted">{words.detail}</Text>
            <Text variant="caption">{contents(basket)}</Text>
            <View style={styles.buttons}>
              <Button title="Throw away" variant="secondary" disabled={busy} onPress={() => throwAway(basket)} style={styles.button} />
              <Button title={busy ? 'Checking prices...' : 'Pick up'} disabled={busy} onPress={() => onRecall(basket.id)} style={styles.button} />
            </View>
          </View>
        );
      })}
      <Button title="Close" variant="secondary" disabled={busy} onPress={onClose} style={styles.close} />
    </Prompt>
  );
}

const styles = StyleSheet.create({
  basket: {
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  buttons: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  button: { flex: 1 },
  close: { marginTop: theme.spacing.md },
});
