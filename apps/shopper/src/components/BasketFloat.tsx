import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useNavigationState, type NavigationState } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../hooks/useCart';
import { totalText } from '../lib/basket-copy';
import { formatMoney, itemCountLabel } from '../lib/media';
import { useTenant } from '../lib/TenantContext';
import { TAB_BAR_BODY } from '../navigation/MartTabBar';
import type { RootStackParamList } from '../navigation/types';
import { tapFeel } from '../lib/haptics';
import { FONT, GUTTER, martFromTenant, MOTION, RADIUS, SPACE, TYPE } from '../theme/mart';

const BAR_HEIGHT = 56;
/** Space lists should leave so the last row clears this bar. */
export const BASKET_FLOAT_RESERVE = BAR_HEIGHT + SPACE.sm + SPACE.md;

const HIDDEN = new Set([
  'Cart',
  'Checkout',
  'Payment',
  'OrderConfirmation',
  'OrderDetail',
  'Airtime',
  'Kplc',
  'ProductDetail',
]);

function leafRouteName(state: NavigationState | undefined): string | undefined {
  if (!state) return undefined;
  const route = state.routes[state.index];
  if (route.state) return leafRouteName(route.state as NavigationState);
  return route.name;
}

function stackRouteName(state: NavigationState | undefined): string | undefined {
  return state?.routes[state.index]?.name;
}

export function useBasketFloatReserve(): number {
  const tenant = useTenant();
  const { itemCount } = useCart(tenant.slug);
  const leaf = useNavigationState((state) => leafRouteName(state));
  if (itemCount < 1 || !leaf || HIDDEN.has(leaf)) return 0;
  return BASKET_FLOAT_RESERVE;
}

export function BasketFloat() {
  const tenant = useTenant();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const mart = martFromTenant(tenant);
  const { itemCount, view } = useCart(tenant.slug);
  const leaf = useNavigationState((state) => leafRouteName(state));
  const stack = useNavigationState((state) => stackRouteName(state));
  const visible = itemCount > 0 && Boolean(leaf) && !HIDDEN.has(leaf ?? '');
  const onTabs = stack === 'MainTabs';
  const tabOffset = TAB_BAR_BODY + Math.max(insets.bottom, SPACE.sm);
  const bottom = (onTabs ? tabOffset : Math.max(insets.bottom, SPACE.md)) + SPACE.xs;
  const subtotal = view.subtotal ?? 0;
  const total = totalText(view, formatMoney);
  const enter = useRef(new Animated.Value(0)).current;
  const bump = useRef(new Animated.Value(1)).current;
  const lastTotal = useRef(subtotal);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: visible ? 1 : 0,
      duration: visible ? MOTION.view : MOTION.exit,
      easing: visible ? MOTION.easeOut : MOTION.easeIn,
      useNativeDriver: true,
    }).start();
  }, [enter, visible]);

  useEffect(() => {
    if (!visible || lastTotal.current === subtotal) {
      lastTotal.current = subtotal;
      return;
    }
    lastTotal.current = subtotal;
    bump.setValue(0.94);
    Animated.spring(bump, {
      toValue: 1,
      friction: 6,
      tension: 220,
      useNativeDriver: true,
    }).start();
  }, [bump, subtotal, visible]);

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.anchor,
          {
            bottom,
            opacity: enter,
            transform: [
              {
                translateY: enter.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Pressable
          onPress={() => {
            tapFeel();
            navigation.navigate('MainTabs', { screen: 'Cart' });
          }}
          accessibilityRole="button"
          accessibilityLabel={`${itemCountLabel(itemCount)}${total ? `, ${total}` : ''}. Open basket`}
          style={({ pressed }) => [
            styles.bar,
            { backgroundColor: mart.primary },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.mark, { backgroundColor: mart.accent }]}>
            <Text style={[styles.markText, { color: mart.onAccent.primary }]}>
              {itemCount > 99 ? '99+' : itemCount}
            </Text>
          </View>
          <Text style={[styles.count, { color: mart.onPrimary.primary }]}>View basket</Text>
          <Animated.View style={{ transform: [{ scale: bump }] }}>
            <Text style={[styles.total, { color: mart.onPrimary.primary }]}>{total ?? ''}</Text>
          </Animated.View>
          <View style={[styles.go, { backgroundColor: mart.onPrimary.primary }]}>
            <Ionicons name="arrow-forward" size={18} color={mart.primary} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: GUTTER,
    right: GUTTER,
  },
  bar: {
    minHeight: BAR_HEIGHT,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  mark: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    ...TYPE.label,
    fontFamily: FONT.bold,
  },
  count: {
    ...TYPE.label,
    flex: 1,
  },
  total: {
    ...TYPE.price,
  },
  go: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
});
