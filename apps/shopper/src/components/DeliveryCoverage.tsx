import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '../hooks/useCart';
import { useOrderHistory } from '../hooks/useOrderHistory';
import { useSession } from '../hooks/useSession';
import { useStorefront } from '../hooks/useStorefront';
import { useTenant } from '../lib/TenantContext';
import {
  ELEVATION,
  MART,
  martFromTenant,
  ON_BRAND,
  RADIUS,
  SPACE,
  TYPE,
} from '../theme/mart';

const SEEN_KEY = 'kiosk.shopper.seenDeliveryAreas';

function seenStorageKey(slug: string) {
  return `${SEEN_KEY}.${slug}`;
}

/** First-time shoppers: no local till slips and no Pass pickup history. */
function neverPurchased(opts: {
  signedIn: boolean;
  hubLoading: boolean;
  pickupCount: number;
  localCount: number;
}): boolean {
  if (opts.localCount > 0) return false;
  if (opts.signedIn) {
    if (opts.hubLoading) return false;
    return opts.pickupCount === 0;
  }
  return true;
}

export function DeliveryCoverage() {
  const tenant = useTenant();
  const insets = useSafeAreaInsets();
  const mart = martFromTenant(tenant);
  const { itemCount } = useCart(tenant.slug);
  const { signedIn, hub, hubLoading } = useSession();
  const { data: localOrders } = useOrderHistory(tenant.slug);
  const { data: storefront } = useStorefront(tenant.slug);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<boolean | null>(null);
  const promptedRef = useRef(false);

  const areas = useMemo(
    () =>
      (storefront?.deliveryAreas ?? []).filter(
        (area) => area.active && area.name?.trim()
      ),
    [storefront?.deliveryAreas]
  );

  const pickupCount = hub?.pickupOrdersTotal ?? hub?.pickupOrders?.length ?? 0;
  const localCount = localOrders?.length ?? 0;
  const firstTime = neverPurchased({
    signedIn,
    hubLoading: signedIn && hubLoading,
    pickupCount,
    localCount,
  });

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(seenStorageKey(tenant.slug)).then((raw) => {
      if (!cancelled) setSeen(Boolean(raw));
    });
    return () => {
      cancelled = true;
    };
  }, [tenant.slug]);

  useEffect(() => {
    if (promptedRef.current || open) return;
    if (seen !== false) return;
    if (itemCount < 1) return;
    if (!firstTime) return;
    if (areas.length === 0) return;
    promptedRef.current = true;
    setOpen(true);
  }, [areas.length, firstTime, itemCount, open, seen]);

  async function dismiss() {
    setOpen(false);
    setSeen(true);
    await AsyncStorage.setItem(seenStorageKey(tenant.slug), new Date().toISOString());
  }

  if (!open) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={() => void dismiss()}>
      <View style={styles.overlay}>
        <Pressable style={styles.dim} onPress={() => void dismiss()} accessibilityLabel="Close" />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACE.lg) }]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          <View style={[styles.masthead, { backgroundColor: mart.primary }]}>
            <View style={styles.pin}>
              <Ionicons name="navigate" size={18} color={ON_BRAND.primary} />
            </View>
            <Text style={styles.kicker}>We deliver here</Text>
            <Text style={styles.title}>Areas {mart.displayName} serves</Text>
            <Text style={styles.lede}>
              First drop? Check your estate is on the list before you fill the basket.
            </Text>
          </View>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listInner}
            keyboardShouldPersistTaps="handled"
          >
            {areas.map((area) => (
              <View key={area.id} style={styles.area}>
                <Ionicons name="location-outline" size={16} color={mart.primary} />
                <Text style={styles.areaName}>{area.name.trim()}</Text>
              </View>
            ))}
          </ScrollView>
          <Pressable
            onPress={() => void dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Got it, keep shopping"
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: mart.accent },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.ctaLabel}>Got it — keep shopping</Text>
          </Pressable>
          <Pressable
            onPress={() => void dismiss()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          >
            <Text style={styles.skipLabel}>Not my area — I’ll still browse</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,20,18,0.45)' },
  sheet: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    maxHeight: '88%',
    ...ELEVATION.lifted,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: MART.borderStrong,
    marginTop: SPACE.sm,
  },
  masthead: {
    marginTop: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.xl,
  },
  pin: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ON_BRAND.wash,
    marginBottom: SPACE.md,
  },
  kicker: {
    ...TYPE.shelf,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: ON_BRAND.secondary,
  },
  title: {
    ...TYPE.title,
    marginTop: SPACE.xs,
    color: ON_BRAND.primary,
  },
  lede: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: ON_BRAND.secondary,
  },
  list: { maxHeight: 280 },
  listInner: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    gap: SPACE.xs,
  },
  area: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paper,
    borderWidth: 1,
    borderColor: MART.border,
  },
  areaName: {
    ...TYPE.body,
    fontWeight: '600',
    color: MART.ink,
    flex: 1,
  },
  cta: {
    marginHorizontal: SPACE.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  ctaLabel: {
    ...TYPE.label,
    fontWeight: '800',
    color: '#1a1204',
  },
  skip: {
    marginTop: SPACE.sm,
    marginBottom: SPACE.xs,
    alignItems: 'center',
    paddingVertical: SPACE.sm,
  },
  skipLabel: {
    ...TYPE.meta,
    color: MART.inkMuted,
  },
  pressed: { opacity: 0.84 },
});
