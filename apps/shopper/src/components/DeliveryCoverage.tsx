import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCart } from '../hooks/useCart';
import { useOrderHistory } from '../hooks/useOrderHistory';
import { useSession } from '../hooks/useSession';
import { useStorefront } from '../hooks/useStorefront';
import { useTenant } from '../lib/TenantContext';
import { deliveryAreasKey } from '../lib/shop-storage';
import { MART, martFromTenant, SPACE, TILE, TYPE, ZONE } from '../theme/mart';
import { Capsule } from './Capsule';
import { Lobe } from './Coast';
import { SHEET_SCRIM, SheetPanel } from './SheetPanel';

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
    void AsyncStorage.getItem(deliveryAreasKey(tenant.slug)).then((raw) => {
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
    await AsyncStorage.setItem(deliveryAreasKey(tenant.slug), new Date().toISOString());
  }

  if (!open) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={() => void dismiss()}>
      <View style={styles.overlay}>
        <Pressable style={styles.dim} onPress={() => void dismiss()} accessibilityLabel="Close" />
        <View style={styles.sheet} accessibilityViewIsModal>
          <SheetPanel
            title={`Areas ${mart.displayName} delivers to`}
            hint="First order? Check your area is on the list before you fill your basket."
            onClose={() => void dismiss()}
            footer={
              <>
                <Capsule
                  label="Got it, keep shopping"
                  chip="checkmark"
                  fill={mart.primary}
                  onPress={() => void dismiss()}
                />
                <Pressable
                  onPress={() => void dismiss()}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
                >
                  <Text style={styles.skipLabel}>Not my area, I’ll still browse</Text>
                </Pressable>
              </>
            }
          >
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listInner}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.tile}>
                {areas.map((area, index) => (
                  <View key={area.id} style={[styles.area, index > 0 && styles.areaRule]}>
                    <Lobe color={ZONE.leaf} size={32} shape={index}>
                      <Ionicons name="location" size={15} color={MART.ink} />
                    </Lobe>
                    <Text style={styles.areaName}>{area.name.trim()}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </SheetPanel>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: SHEET_SCRIM },
  sheet: {
    maxHeight: '88%',
  },
  list: { maxHeight: 300 },
  listInner: {
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.sm,
  },
  tile: {
    ...TILE,
    paddingVertical: SPACE.xs,
  },
  area: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 52,
  },
  areaRule: {
    borderTopWidth: 1,
    borderTopColor: MART.border,
  },
  areaName: {
    ...TYPE.body,
    color: MART.ink,
    flex: 1,
  },
  skip: {
    minHeight: 44,
    marginTop: SPACE.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipLabel: {
    ...TYPE.label,
    color: MART.ink,
    textDecorationLine: 'underline',
  },
  pressed: { opacity: 0.6 },
});
