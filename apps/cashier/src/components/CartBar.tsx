import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT, MART, MOTION, MartText, PressableScale, RADIUS, SHADOW, SPACE, onFill, WEIGHT } from '@kiosk/staff';
import { formatMoney } from '../lib/money';
import { TABULAR_NUMS } from './CashierPrimitives';
import { feel } from '../lib/feel';

type Props = {
  count: number;
  totalCents: number | null;
  /** The line that just went in, for a moment: the till's answer to a tap the cashier may not have looked at. */
  lastAdded?: { name: string; at: number } | null;
  /** Takes the line that was just added back out — the till's answer to a slipped finger. */
  onUndo?: () => void;
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
export function CartBar({
  count,
  totalCents,
  lastAdded = null,
  onUndo,
  canHold,
  heldCount,
  checking,
  onHold,
  onShowHeld,
  onCheckout,
}: Props) {
  const empty = count === 0;
  const badTotal = totalCents === null;
  const checkoutOff = empty || badTotal || checking;
  const holdOff = heldCount === 0 && (empty || !canHold);

  // The answer to a tap: the newest line slides in, and the total gives a small nod. Both settle on their own.
  const reveal = useRef(new Animated.Value(1)).current;
  const nod = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!lastAdded) return;
    reveal.setValue(0);
    nod.setValue(1.04);
    Animated.parallel([
      Animated.timing(reveal, { toValue: 1, duration: MOTION.state, easing: MOTION.easeOut, useNativeDriver: true }),
      Animated.timing(nod, { toValue: 1, duration: MOTION.state, easing: MOTION.easeOut, useNativeDriver: true }),
    ]).start();
  }, [lastAdded?.at, reveal, nod]);

  // Above the tab bar only — the tab already owns the home-indicator inset, so do not add it again.
  return (
    <View style={styles.bar}>
      {heldCount > 0 || canHold ? (
        <PressableScale
          onPress={() => {
            feel.select();
            if (heldCount > 0) onShowHeld();
            else onHold();
          }}
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
        <Animated.View
          style={{
            opacity: reveal,
            transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [3, 0] }) }],
          }}
        >
          {lastAdded ? (
            // What just went in, by name, and the way back out: the till answers the tap in the place the cashier is
            // already looking, and makes a slipped finger cost one tap instead of two.
            <View style={styles.addedRow}>
              <MartText variant="meta" color={MART.ink} numberOfLines={1} style={styles.addedName}>
                <MartText variant="meta" color={MART.fallbackPrimary}>
                  +
                </MartText>{' '}
                {lastAdded.name}
              </MartText>
              {onUndo ? (
                <Pressable onPress={onUndo} hitSlop={10} accessibilityRole="button" accessibilityLabel="Undo the last item added">
                  <MartText variant="meta" color={MART.fallbackPrimary} style={styles.undo}>
                    Undo
                  </MartText>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <MartText variant="meta" color={MART.inkQuiet}>
              {empty ? 'Basket empty' : count === 1 ? '1 item' : `${count} items`}
            </MartText>
          )}
        </Animated.View>
        <Animated.View style={styles.totalWrap}>
          <Animated.View style={{ transform: [{ scale: nod }] }}>
            <MartText
              variant="title"
              color={badTotal ? MART.danger : MART.ink}
              style={TABULAR_NUMS}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {badTotal ? 'Check a line' : `KES ${formatMoney(totalCents ?? 0)}`}
            </MartText>
          </Animated.View>
        </Animated.View>
      </View>

      <PressableScale
        onPress={() => {
          if (!checkoutOff) feel.tap();
          onCheckout();
        }}
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
          // The arrow rides in its own disc, the way the reference's primary action does: a single bright mark at the
          // end of the pill that says "this way", in the palette's gold rather than a borrowed accent.
          <View style={[styles.checkoutDisc, empty ? styles.checkoutDiscIdle : styles.checkoutDiscLive]}>
            <Ionicons name="arrow-forward" size={16} color={empty ? MART.inkQuiet : MART.fallbackPrimary} />
          </View>
        ) : null}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  // A floating pill rather than a ledge across the foot: the shelf keeps two more millimetres of itself, and the
  // bar reads as the one object that stays with you. Same radius language as the sheets.
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    // On a tablet the bar keeps its phone proportions and centres itself, instead of stretching into a footer
    // with an arm's length of empty space between the total and the button.
    width: '96%',
    maxWidth: 760,
    alignSelf: 'center',
    marginBottom: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.xl,
    backgroundColor: MART.paperElevated,
    ...SHADOW.floating,
  },
  side: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
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
  addedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addedName: { flexShrink: 1 },
  undo: { fontFamily: FONT.semibold,
 fontWeight: WEIGHT.semibold, textDecorationLine: 'underline' },
  totals: { flex: 1, gap: 1 },
  totalWrap: { alignItems: 'flex-start' },
  checkout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 54,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.pill,
  },
  checkoutDisc: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Cream inside the green: a quiet knob rather than a second brand colour. The arrow stays green, so the disc
  // reads as part of the button, not as a badge borrowed from somewhere else.
  checkoutDiscLive: { backgroundColor: MART.paperSunken },
  // On an idle button the pill is already sand, so the disc is white to stay visible at all.
  checkoutDiscIdle: { backgroundColor: MART.paperElevated },
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
