import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTenant } from '../lib/TenantContext';
import { useCart } from '../hooks/useCart';
import { useSession } from '../hooks/useSession';
import { useAuthGate } from '../components/AuthGate';
import { CartLinesSkeleton } from '../components/Skeleton';
import { QuickAddButton } from '../components/QuickAddButton';
import { formatMoney } from '../lib/media';
import {
  ELEVATION,
  GUTTER,
  MART,
  martFromTenant,
  ON_BRAND,
  RADIUS,
  SPACE,
  TYPE,
  tint,
} from '../theme/mart';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Cart'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function CartScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<NavigationProp>();
  const { cart, isLoading } = useCart(tenant.slug);
  const { signedIn } = useSession();
  const { openAuth } = useAuthGate();
  const mart = martFromTenant(tenant);
  const currency = cart?.currency ?? 'KES';
  const lines = cart?.lines ?? [];
  const unitTotal = lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);

  if (isLoading) {
    return (
      <View style={styles.shell}>
        <CartLinesSkeleton />
      </View>
    );
  }

  if (lines.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: tint(mart.primary, 0.08) }]}>
          <Ionicons name="bag-handle-outline" size={26} color={mart.primary} />
        </View>
        <Text style={styles.emptyTitle}>Your basket is empty</Text>
        <Text style={styles.emptyBody}>
          Add something from an aisle and it will wait for you here.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Home')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            styles.emptyCta,
            { backgroundColor: mart.primary },
            pressed && styles.ctaPressed,
          ]}
        >
          <Text style={styles.ctaLabel}>Shop the aisles</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.count}>
          {unitTotal} {unitTotal === 1 ? 'item' : 'items'} from {mart.displayName}
        </Text>
        {lines.map((line) => (
          <View key={line.itemId} style={styles.line}>
            {line.imageUrl ? (
              <Image source={{ uri: line.imageUrl }} style={styles.thumbnail} />
            ) : (
              <View style={[styles.thumbnail, styles.thumbnailEmpty]}>
                <Text style={styles.thumbnailLetter}>
                  {(line.name ?? '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.lineBody}>
              <View style={styles.lineTop}>
                <Text numberOfLines={2} style={styles.name}>
                  {line.name}
                </Text>
                <Text style={styles.lineTotal}>{formatMoney(currency, line.lineTotal ?? 0)}</Text>
              </View>
              <Text style={styles.unit}>
                {formatMoney(currency, line.unitPrice ?? 0)} each
              </Text>
              {line.itemId ? (
                <View style={styles.stepperRow}>
                  <QuickAddButton
                    itemId={line.itemId}
                    name={line.name ?? 'item'}
                    accent={mart.primary}
                  />
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>{formatMoney(currency, cart?.subtotal ?? 0)}</Text>
        </View>
        <Pressable
          onPress={() => {
            void (async () => {
              if (!signedIn) {
                const ok = await openAuth('checkout');
                if (!ok) return;
              }
              navigation.navigate('Checkout');
            })();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: mart.primary },
            pressed && styles.ctaPressed,
          ]}
        >
          <Text style={styles.ctaLabel}>Checkout</Text>
          <Ionicons name="arrow-forward" size={16} color={ON_BRAND.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.xxl,
    gap: SPACE.sm,
  },
  count: {
    ...TYPE.meta,
    marginBottom: SPACE.xs,
    color: MART.inkQuiet,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
    backgroundColor: MART.paper,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...TYPE.title,
    marginTop: SPACE.lg,
    color: MART.ink,
  },
  emptyBody: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: MART.inkMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    backgroundColor: MART.paper,
  },
  thumbnailEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailLetter: {
    ...TYPE.heading,
    color: MART.inkQuiet,
  },
  lineBody: {
    flex: 1,
    minWidth: 0,
  },
  lineTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACE.md,
  },
  name: {
    ...TYPE.label,
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: MART.ink,
  },
  unit: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
  stepperRow: {
    marginTop: SPACE.sm,
    alignItems: 'flex-start',
  },
  lineTotal: {
    ...TYPE.label,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: MART.ink,
  },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.md,
    gap: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: SPACE.md,
  },
  totalLabel: {
    ...TYPE.meta,
    color: MART.inkMuted,
  },
  totalValue: {
    ...TYPE.heading,
    fontVariant: ['tabular-nums'],
    color: MART.ink,
  },
  cta: {
    minHeight: 50,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
  },
  emptyCta: {
    marginTop: SPACE.xl,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaLabel: {
    ...TYPE.heading,
    color: ON_BRAND.primary,
  },
});
