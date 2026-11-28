import React from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { MART, MartText, SPACE } from '@kiosk/staff';
import { describeBasket, type HeldBasket } from '../lib/holds';
import { CashierButton, CashierIconButton, EmptyOrErrorState } from './CashierPrimitives';
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
      {baskets.length === 0 ? (
        <EmptyOrErrorState
          icon="albums-outline"
          title="Nothing is on hold"
          message="A basket you put on hold waits here until you pick it up or throw it away."
        />
      ) : null}
      {baskets.map((basket) => {
        const words = describeBasket(basket, now);
        return (
          <View key={basket.id} style={styles.basket}>
            <View style={styles.head}>
              <MartText variant="heading" style={styles.grow}>
                {words.title}
              </MartText>
              {/* The destructive act is an icon in the corner, away from the thumb's path to "Pick up". */}
              <CashierIconButton
                icon="trash-outline"
                tone="danger"
                accessibilityLabel={`Throw away ${basket.label}`}
                onPress={() => throwAway(basket)}
                disabled={busy}
              />
            </View>
            <MartText variant="meta" color={MART.inkMuted}>
              {words.detail}
            </MartText>
            <MartText variant="meta" color={MART.inkQuiet}>
              {contents(basket)}
            </MartText>
            <View style={styles.actions}>
              <CashierButton
                title={busy ? 'Checking prices...' : 'Pick up'}
                variant="ghost"
                icon="arrow-forward"
                busy={busy}
                disabled={busy}
                onPress={() => onRecall(basket.id)}
              />
            </View>
          </View>
        );
      })}
      {baskets.length > 0 ? (
        <CashierButton title="Close" variant="secondary" disabled={busy} onPress={onClose} style={styles.close} />
      ) : null}
    </Prompt>
  );
}

const styles = StyleSheet.create({
  basket: {
    gap: SPACE.xs,
    paddingVertical: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: MART.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  grow: { flex: 1 },
  actions: { flexDirection: 'row', marginTop: SPACE.xxs, marginLeft: -SPACE.sm },
  close: { marginTop: SPACE.lg },
});
