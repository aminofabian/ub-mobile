import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Capsule } from '../components/Capsule';
import { Lobe } from '../components/Coast';
import { doneFeel } from '../lib/haptics';
import { useTenant } from '../lib/TenantContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { GUTTER, MART, martFromTenant, SPACE, SPRING, TILE, TYPE, ZONE } from '../theme/mart';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderConfirmation'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function OrderConfirmationScreen() {
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const tenant = useTenant();
  const mart = martFromTenant(tenant);
  const { orderCode, payLater, pickup } = route.params;
  const collecting = pickup !== false;

  // The one authored moment: the lobe swells in, overshoots once and settles. With Reduce Motion on it
  // is simply there.
  const swell = useSharedValue(1);
  useEffect(() => {
    doneFeel();
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!live || reduce) return;
      swell.value = 0.6;
      swell.value = withSpring(1, SPRING);
    });
    return () => {
      live = false;
    };
  }, [swell]);
  const swellStyle = useAnimatedStyle(() => ({ transform: [{ scale: swell.value }] }));

  return (
    <View style={[styles.shell, { paddingBottom: SPACE.xl + insets.bottom }]}>
      <View style={styles.body}>
        <Animated.View style={[styles.tick, swellStyle]}>
          <Lobe color={ZONE.leaf} size={132} shape={3}>
            <Ionicons name="checkmark" size={60} color={MART.ink} />
          </Lobe>
        </Animated.View>
        <Text accessibilityRole="header" style={styles.title}>
          Order placed
        </Text>
        <Text style={styles.message}>
          {mart.displayName} has your order.{' '}
          {collecting
            ? 'They will call the number you gave when it is ready to collect.'
            : 'They will call the number you gave to arrange delivery.'}
          {payLater ? (collecting ? ' You pay at the counter when you collect.' : ' You pay the rider when it arrives.') : ''}
        </Text>

        <View style={styles.receipt}>
          {orderCode ? (
            <>
              <Text style={styles.receiptLabel}>Order number</Text>
              <Text selectable style={styles.receiptValue}>
                {orderCode}
              </Text>
              <Text style={styles.receiptHint}>
                {collecting ? 'Show this at the counter.' : 'Quote this if you call the shop.'}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.receiptLabel}>Your order</Text>
              <Text style={styles.receiptHint}>
                {collecting
                  ? 'Give your name and phone number at the counter. The shop will find it.'
                  : 'Give your name and phone number if you call the shop. It will find your order.'}
              </Text>
            </>
          )}
        </View>
      </View>

      <Capsule
        label="Keep shopping"
        chip="arrow-forward"
        fill={mart.primary}
        onPress={() => navigation.navigate('MainTabs')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingHorizontal: GUTTER,
    backgroundColor: MART.paper,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  tick: {
    alignSelf: 'flex-start',
    marginLeft: -SPACE.md,
    marginBottom: SPACE.xl,
  },
  title: {
    ...TYPE.display,
    fontSize: 40,
    lineHeight: 40,
    color: MART.ink,
  },
  message: {
    ...TYPE.body,
    marginTop: SPACE.md,
    color: MART.inkMuted,
  },
  receipt: {
    ...TILE,
    marginTop: SPACE.xxl,
    padding: SPACE.xl,
  },
  receiptLabel: {
    ...TYPE.label,
    color: MART.inkMuted,
  },
  receiptValue: {
    ...TYPE.display,
    marginTop: SPACE.xs,
    color: MART.ink,
  },
  receiptHint: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: MART.inkMuted,
  },
});
