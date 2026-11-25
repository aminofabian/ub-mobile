import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MART, MartText, PressableScale, RADIUS, SHADOW, SPACE, onFill } from '@kiosk/staff';
import { formatMoney } from '../lib/money';
import { TABULAR_NUMS } from './CashierPrimitives';

type Props = {
  count: number;
  totalCents: number | null;
  canHold: boolean;
  heldCount: number;
  checking: boolean;
  onHold: () => void;
  onShowHeld: () => void;
  onCheckout: () => void;
};

/**
 * A compact bar fixed at the foot of the till. It never covers the product grid — amounts are changed on the tiles
 * themselves. It carries the running total and the one action that matters: Checkout. Hold and Held sit beside it for
 * when a basket has to wait.
 */
export function CartBar({ count, totalCents, canHold, heldCount, checking, onHold, onShowHeld, onCheckout }: Props) {
  const insets = useSafeAreaInsets();
  const empty = count === 0;
  const badTotal = totalCents === null;
  const checkoutOff = empty || badTotal || checking;
  const holdOff = heldCount === 0 && (empty || !canHold);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(SPACE.lg, insets.bottom + SPACE.xs) }]}>
      {heldCount > 0 || canHold ? (
        <PressableScale
          onPress={heldCount > 0 ? onShowHeld : onHold}
          disabled={holdOff}
          scaleTo={0.95}
          style={[styles.side, holdOff && styles.dim]}
          accessibilityRole="button"
          accessibilityLabel={heldCount > 0 ? `${heldCount} held baskets` : 'Hold this basket'}
        >
          <Ionicons name={heldCount > 0 ? 'albums-outline' : 'pause-outline'} size={20} color={MART.ink} />
          {heldCount > 0 ? (
            <View style={styles.heldDot}>
              <MartText variant="shelf" color={onFill(MART.fallbackPrimary).primary} style={TABULAR_NUMS}>
                {heldCount}
              </MartText>
            </View>
          ) : null}
        </PressableScale>
      ) : null}

      <View style={styles.totals}>
        <MartText variant="meta" color={MART.inkQuiet}>
          {empty ? 'Basket empty' : count === 1 ? '1 item' : `${count} items`}
        </MartText>
        <MartText variant="title" color={badTotal ? MART.danger : MART.ink} style={TABULAR_NUMS} numberOfLines={1} adjustsFontSizeToFit>
          {badTotal ? 'Check a line' : `KES ${formatMoney(totalCents ?? 0)}`}
        </MartText>
      </View>

      <PressableScale
        onPress={onCheckout}
        disabled={checkoutOff}
        scaleTo={0.97}
        style={[styles.checkout, empty ? styles.checkoutIdle : styles.checkoutReady, (badTotal || checking) && styles.dim]}
        accessibilityRole="button"
        accessibilityLabel="Checkout"
      >
        <MartText variant="label" color={empty ? MART.inkQuiet : onFill(MART.fallbackPrimary).primary}>
          {checking ? 'Checking…' : 'Checkout'}
        </MartText>
        {!checking ? (
          <Ionicons name="arrow-forward" size={18} color={empty ? MART.inkQuiet : onFill(MART.fallbackPrimary).primary} />
        ) : null}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.md,
    backgroundColor: MART.paperElevated,
    borderTopWidth: 1,
    borderTopColor: MART.border,
    ...SHADOW.floating,
  },
  side: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heldDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totals: { flex: 1, gap: 1 },
  checkout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 54,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.pill,
  },
  // Empty basket: a quiet outline, so it does not shout before there is anything to ring up.
  checkoutIdle: {
    backgroundColor: MART.paperSunken,
    borderWidth: 1,
    borderColor: MART.border,
  },
  // Something in the basket: solid green, lifted — the one button the eye should land on.
  checkoutReady: {
    backgroundColor: MART.fallbackPrimary,
    shadowColor: MART.fallbackPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  dim: { opacity: 0.5 },
});
