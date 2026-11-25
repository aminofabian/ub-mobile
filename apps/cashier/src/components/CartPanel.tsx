import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, FONT, Text, theme } from '@kiosk/ui';
import { lineWords, type CartLine } from '../lib/cart';
import { describeServiceLine } from '../lib/service-sale';
import { checkoutWords } from '../lib/service-words';
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
  /** The till is looking at the shop for services that changed before it goes to payment: Checkout waits. */
  checking: boolean;
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
  checking,
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
      <View style={styles.header}>
        <Text style={styles.heading}>Basket</Text>
        {cart.length > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{cart.length}</Text>
          </View>
        ) : null}
      </View>
      <ScrollView style={styles.lines} keyboardShouldPersistTaps="handled">
        {cart.map((line) => {
          const words = lineWords(line);
          const doneBy = describeServiceLine(line);
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
              {doneBy ? <Text variant="muted">{doneBy}</Text> : null}
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
                {mayChangePrice && !line.service ? <Button title="Price" variant="secondary" onPress={() => onPrice(line)} style={styles.small} /> : null}
                <Button title="Remove" variant="danger" onPress={() => onRemove(line.itemId)} style={styles.small} />
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.totalRow}>
        <Text variant="caption" style={styles.totalLabel}>
          {cart.length === 1 ? '1 item' : `${cart.length} items`}
        </Text>
        <Text style={styles.totalValue}>{totalCents === null ? '—' : formatMoney(totalCents)}</Text>
      </View>
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
        <Button
          title={checkoutWords(checking)}
          onPress={onCheckout}
          disabled={checking || cart.length === 0 || totalCents === null}
          style={styles.checkout}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  cart: { margin: theme.spacing.md, maxHeight: '55%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
  heading: { fontFamily: FONT.bold, fontSize: 18, letterSpacing: -0.3, color: theme.colors.text },
  countPill: {
    minWidth: 24,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceSunken,
    alignItems: 'center',
  },
  countText: { fontFamily: FONT.semibold, fontSize: 13, color: theme.colors.textMuted },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  totalLabel: { color: theme.colors.textMuted },
  totalValue: { fontFamily: FONT.bold, fontSize: 24, letterSpacing: -0.5, color: theme.colors.text },
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
