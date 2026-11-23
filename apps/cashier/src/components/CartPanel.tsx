import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text, theme } from '@kiosk/ui';
import { lineWords, type CartLine } from '../lib/cart';
import { formatMoney } from '../lib/money';

interface CartPanelProps {
  cart: readonly CartLine[];
  /** The basket's total in cents. Null when a line cannot be counted. */
  totalCents: number | null;
  /** This person may sell at a price other than the shelf's. */
  mayChangePrice: boolean;
  /** The held baskets have been read, so a basket can be held. */
  canHold: boolean;
  heldCount: number;
  onUnits: (itemId: string, quantity: number) => void;
  onReweigh: (line: CartLine) => void;
  onPrice: (line: CartLine) => void;
  onRemove: (itemId: string) => void;
  onHold: () => void;
  onShowHeld: () => void;
  onCheckout: () => void;
}

export function CartPanel({
  cart,
  totalCents,
  mayChangePrice,
  canHold,
  heldCount,
  onUnits,
  onReweigh,
  onPrice,
  onRemove,
  onHold,
  onShowHeld,
  onCheckout,
}: CartPanelProps) {
  return (
    <Card style={styles.cart}>
      <Text variant="h2">Basket ({cart.length})</Text>
      <ScrollView style={styles.lines} keyboardShouldPersistTaps="handled">
        {cart.map((line) => {
          const words = lineWords(line);
          return (
            <View key={line.itemId} style={styles.line}>
              <View style={styles.lineTop}>
                <Text variant="body" style={styles.lineName}>
                  {line.name}
                </Text>
                <Text variant="body">{words.total}</Text>
              </View>
              <Text variant="muted">
                {words.quantity} x {words.price}
              </Text>
              {words.was ? (
                <Text variant="caption" style={styles.changed}>
                  Price changed (shelf price {words.was})
                </Text>
              ) : null}
              <View style={styles.lineButtons}>
                {line.weighed ? (
                  <Button title="Weigh again" variant="secondary" onPress={() => onReweigh(line)} style={styles.small} />
                ) : (
                  <>
                    <Button title="-" variant="secondary" onPress={() => onUnits(line.itemId, line.quantity - 1)} style={styles.step} />
                    <Button title="+" variant="secondary" onPress={() => onUnits(line.itemId, line.quantity + 1)} style={styles.step} />
                  </>
                )}
                {mayChangePrice ? <Button title="Price" variant="secondary" onPress={() => onPrice(line)} style={styles.small} /> : null}
                <Button title="Remove" variant="danger" onPress={() => onRemove(line.itemId)} style={styles.small} />
              </View>
            </View>
          );
        })}
      </ScrollView>
      <Text variant="h2">Total: {totalCents === null ? '-' : formatMoney(totalCents)}</Text>
      {totalCents === null ? (
        <Text variant="caption" style={styles.problem}>
          A line in the basket cannot be counted. Remove it, or change its price.
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button title="Hold" variant="secondary" onPress={onHold} disabled={!canHold || cart.length === 0} style={styles.action} />
        <Button
          title={heldCount > 0 ? `Held (${heldCount})` : 'Held'}
          variant="secondary"
          onPress={onShowHeld}
          disabled={!canHold}
          style={styles.action}
        />
        <Button title="Checkout" onPress={onCheckout} disabled={cart.length === 0 || totalCents === null} style={styles.checkout} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cart: { margin: theme.spacing.md, maxHeight: '55%' },
  lines: { flexGrow: 0 },
  line: { paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  lineTop: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
  lineName: { flex: 1 },
  changed: { color: theme.colors.danger },
  problem: { color: theme.colors.danger },
  lineButtons: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  step: { minWidth: 48, paddingHorizontal: theme.spacing.md },
  small: { minHeight: 44, paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  action: { flex: 1 },
  checkout: { flex: 2 },
});
