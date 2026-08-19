import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTenant } from '../lib/TenantContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  ELEVATION,
  GUTTER,
  MART,
  martFromTenant,
  ON_BRAND,
  RADIUS,
  SPACE,
  TYPE,
} from '../theme/mart';

type Props = NativeStackScreenProps<RootStackParamList, 'OrderConfirmation'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function OrderConfirmationScreen() {
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const tenant = useTenant();
  const mart = martFromTenant(tenant);
  const { orderId } = route.params;

  return (
    <View style={[styles.shell, { paddingBottom: SPACE.xl + insets.bottom }]}>
      <View style={styles.body}>
        <View style={styles.tick}>
          <Ionicons name="checkmark" size={28} color={MART.success} />
        </View>
        <Text style={styles.title}>Order placed</Text>
        <Text style={styles.message}>
          {mart.displayName} has your order. They will call the number you gave when it is ready to
          collect.
        </Text>

        <View style={styles.receipt}>
          <Text style={styles.receiptLabel}>Order number</Text>
          <Text selectable style={styles.receiptValue}>
            {orderId}
          </Text>
          <Text style={styles.receiptHint}>Show this at the counter.</Text>
        </View>
      </View>

      <Pressable
        onPress={() => navigation.navigate('MainTabs')}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: mart.primary },
          pressed && styles.ctaPressed,
        ]}
      >
        <Text style={styles.ctaLabel}>Keep shopping</Text>
      </Pressable>
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
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: MART.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.lg,
  },
  title: {
    ...TYPE.display,
    color: MART.ink,
  },
  message: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: MART.inkMuted,
  },
  receipt: {
    marginTop: SPACE.xxl,
    padding: SPACE.lg,
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
  },
  receiptLabel: {
    ...TYPE.meta,
    color: MART.inkQuiet,
  },
  receiptValue: {
    ...TYPE.heading,
    marginTop: SPACE.xs,
    color: MART.ink,
    fontVariant: ['tabular-nums'],
  },
  receiptHint: {
    ...TYPE.meta,
    marginTop: SPACE.sm,
    color: MART.inkQuiet,
  },
  cta: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaLabel: {
    ...TYPE.heading,
    color: ON_BRAND.primary,
  },
});
