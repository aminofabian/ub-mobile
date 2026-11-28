import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { MartText } from '@kiosk/staff';
import { MART, SHADOW, SPACE, onFill } from '../theme/mart';
import { tapTab } from '../lib/tap-route';
import type { OwnerTab } from '../lib/owner-access';

type Pulse = { key: string; title: string; body: string; kind: string };

const TONE: Record<string, { icon: keyof typeof Ionicons.glyphMap; wash: string; ink: string }> = {
  shift: { icon: 'time-outline', wash: '#2f7a21', ink: '#ffffff' },
  money: { icon: 'trending-up', wash: MART.fallbackPrimary, ink: '#1a1208' },
  supply: { icon: 'cube-outline', wash: '#0b5cab', ink: '#ffffff' },
  order: { icon: 'cart-outline', wash: '#0b5cab', ink: '#ffffff' },
  alert: { icon: 'alert-circle-outline', wash: '#b42318', ink: '#ffffff' },
  credit: { icon: 'wallet-outline', wash: MART.fallbackPrimary, ink: '#1a1208' },
};

function toneFor(kind: string) {
  if (kind.startsWith('shift.')) return TONE.shift;
  if (kind.startsWith('sales.') || kind.startsWith('credit')) return kind.startsWith('credit') ? TONE.credit : TONE.money;
  if (kind.startsWith('supply')) return TONE.supply;
  if (kind.startsWith('storefront') || kind.startsWith('web_order') || kind.startsWith('order')) return TONE.order;
  if (kind.startsWith('sale.voided') || kind.startsWith('drawout')) return TONE.alert;
  return { icon: 'notifications-outline' as const, wash: MART.fallbackPrimary, ink: onFill(MART.fallbackPrimary).primary };
}

/**
 * A notice that arrives while the owner is in the app. The phone's own banner is for when
 * the app is in the background; this card is the same news, in the shop's own colours.
 */
export function ShopPulse({
  tabs,
  onOpen,
}: {
  tabs: readonly OwnerTab[];
  onOpen: (tab: OwnerTab) => void;
}) {
  const insets = useSafeAreaInsets();
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notice) => {
      const content = notice.request.content;
      const data = content.data as Record<string, unknown> | undefined;
      const kind = typeof data?.kind === 'string' ? data.kind : typeof data?.type === 'string' ? data.type : '';
      const title = content.title?.trim() || 'Kiosk';
      const body = content.body?.trim() || '';
      if (timer.current) clearTimeout(timer.current);
      setPulse({ key: notice.request.identifier, title, body, kind });
      timer.current = setTimeout(() => setPulse(null), 5200);
    });
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!pulse) return null;
  const tone = toneFor(pulse.kind);
  const tab = tapTab({ kind: pulse.kind });

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Pressable
        onPress={() => {
          setPulse(null);
          onOpen(tabs.includes(tab) ? tab : 'Today');
        }}
        accessibilityRole="button"
        accessibilityLabel={`${pulse.title}. ${pulse.body}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={[styles.mark, { backgroundColor: tone.wash }]}>
          <Ionicons name={tone.icon} size={18} color={tone.ink} />
        </View>
        <View style={styles.copy}>
          <MartText variant="label" numberOfLines={1}>
            {pulse.title}
          </MartText>
          {pulse.body ? (
            <MartText variant="meta" color={MART.inkMuted} numberOfLines={3}>
              {pulse.body}
            </MartText>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: SPACE.md, right: SPACE.md, zIndex: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.sm,
    borderRadius: 16,
    backgroundColor: MART.paperElevated,
    ...SHADOW.floating,
  },
  pressed: { opacity: 0.92 },
  mark: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
});
