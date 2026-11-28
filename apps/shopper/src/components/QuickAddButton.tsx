import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { landFeel, stepFeel } from '../lib/haptics';
import { FONT, onFill, RADIUS, SPRING } from '../theme/mart';
import { useTenant } from '../lib/TenantContext';
import { useCart } from '../hooks/useCart';

type Props = {
  itemId: string;
  name: string;
  /** The shop's colour: the fill of the control. */
  accent: string;
  /** What the product showed, so a new line has a price and a picture before the shop has answered. */
  price?: number | null;
  imageUrl?: string | null;
  variantName?: string | null;
};

const CHIP = 40;
const OPEN = 116;

/**
 * A round plus that rides the corner of a product photo. The first tap puts one in the basket and the
 * chip opens along the photo's edge into a stepper; taking the last one out closes it again.
 */
export function QuickAddButton({ itemId, name, accent, price, imageUrl, variantName }: Props) {
  const tenant = useTenant();
  const { quantityFor, addToBasket } = useCart(tenant.slug);
  const qty = quantityFor(itemId);
  const inCart = qty > 0;
  const facts = { itemId, name, unitPrice: price ?? null, imageUrl: imageUrl ?? null, variantName: variantName ?? null };
  const on = onFill(accent);

  const open = useSharedValue(inCart ? 1 : 0);
  const pop = useSharedValue(1);
  useEffect(() => {
    open.value = withSpring(inCart ? 1 : 0, SPRING);
  }, [inCart, open]);

  const shell = useAnimatedStyle(() => ({
    width: interpolate(open.value, [0, 1], [CHIP, OPEN]),
    transform: [{ scale: pop.value }],
  }));
  const inner = useAnimatedStyle(() => ({ opacity: interpolate(open.value, [0.4, 1], [0, 1], 'clamp') }));

  // The basket takes the tap at once, and tells the shop a moment later, so there is nothing to wait for.
  function addOne() {
    if (inCart) stepFeel();
    else landFeel();
    pop.value = withSequence(withSpring(1.08, { duration: 120 }), withSpring(1, SPRING));
    addToBasket(facts, 1);
  }

  function minus() {
    stepFeel();
    addToBasket(facts, -1);
  }

  return (
    <Animated.View style={[styles.shell, { backgroundColor: accent }, shell]}>
      {inCart ? (
        <Animated.View style={[styles.stepper, inner]}>
          <Pressable
            onPress={minus}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Remove one ${name}`}
            style={styles.hit}
          >
            <Ionicons name={qty === 1 ? 'trash-outline' : 'remove'} size={18} color={on.primary} />
          </Pressable>
          <Text style={[styles.qty, { color: on.primary }]} accessibilityLiveRegion="polite">
            {qty}
          </Text>
        </Animated.View>
      ) : null}
      <Pressable
        onPress={addOne}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={inCart ? `Add another ${name}` : `Add ${name} to basket`}
        style={styles.hit}
      >
        <Ionicons name="add" size={22} color={on.primary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: CHIP,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hit: {
    width: CHIP,
    height: CHIP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONT.bold,
    fontSize: 15,
    lineHeight: 20,
  },
});
