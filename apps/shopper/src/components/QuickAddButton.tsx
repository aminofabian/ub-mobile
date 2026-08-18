import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MART } from '../theme/mart';
import { useTenant } from '../lib/TenantContext';
import { useCart } from '../hooks/useCart';

type Props = {
  itemId: string;
  name: string;
  accent: string;
};

export function QuickAddButton({ itemId, name, accent }: Props) {
  const tenant = useTenant();
  const { quantityFor, setLineQty } = useCart(tenant.slug);
  const qty = quantityFor(itemId);
  const inCart = qty > 0;
  const busy = setLineQty.isPending;
  const [justAdded, setJustAdded] = useState(false);
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(false), 700);
    return () => clearTimeout(timer);
  }, [justAdded]);

  function bump() {
    pop.setValue(0.86);
    Animated.spring(pop, {
      toValue: 1,
      friction: 5,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }

  async function addOne() {
    if (busy) return;
    bump();
    await setLineQty.mutateAsync({ itemId, quantity: qty + 1 });
    setJustAdded(true);
  }

  async function minus() {
    if (busy) return;
    bump();
    await setLineQty.mutateAsync({ itemId, quantity: qty - 1 });
  }

  if (inCart) {
    return (
      <Animated.View style={[styles.stepper, { transform: [{ scale: pop }] }]}>
        <Pressable
          onPress={minus}
          disabled={busy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove one ${name}`}
          style={styles.stepHit}
        >
          <Ionicons name="remove" size={16} color={MART.inkMuted} />
        </Pressable>
        <Text style={styles.qty} accessibilityLiveRegion="polite">
          {qty}
        </Text>
        <Pressable
          onPress={addOne}
          disabled={busy}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Add another ${name}`}
          style={styles.stepHit}
        >
          <Ionicons name="add" size={16} color={MART.inkMuted} />
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: pop }] }}>
      <Pressable
        onPress={addOne}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Add ${name} to cart`}
        style={({ pressed }) => [
          styles.add,
          justAdded && { borderColor: accent, backgroundColor: `${accent}14` },
          pressed && styles.pressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={MART.inkMuted} />
        ) : (
          <>
            <Ionicons
              name={justAdded ? 'checkmark' : 'add'}
              size={14}
              color={justAdded ? accent : MART.inkMuted}
            />
            <Text style={[styles.addLabel, justAdded && { color: accent }]}>ADD</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  add: {
    minHeight: 32,
    minWidth: 64,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
    borderRadius: MART.radius,
  },
  addLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: MART.inkMuted,
  },
  stepper: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paper,
    borderRadius: MART.radius,
  },
  stepHit: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: MART.ink,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
});
