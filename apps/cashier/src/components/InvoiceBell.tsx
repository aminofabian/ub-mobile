import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MART, MOTION, PressableScale, RADIUS, SHADOW, SPACE, tint, onFill, MartText } from '@kiosk/staff';
import { useLiveInvoices, type LiveInvoice } from '../store/live-invoices-store';
import { TABULAR_NUMS } from './CashierPrimitives';

function kes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ago(at: number): string {
  const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (secs < 10) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

/**
 * The till's live bell. It sits in the sell header and watches the {@link useLiveInvoices} store,
 * which the realtime line fills as grocery clerks send counter invoices. A new arrival makes the
 * bell swing and a badge pop; tapping it drops a sheet of the recent invoices, and tapping one
 * jumps to the Invoices tab with that invoice's code queued to open.
 *
 * The chime + buzz are fired by the App's realtime subscription (see invoice-alert), not here, so
 * the sound plays whichever screen the cashier is on — not only when this bell is mounted.
 */
export function InvoiceBell({ onOpenInvoice }: { onOpenInvoice: (barcodeCode: string) => void }) {
  const invoices = useLiveInvoices((s) => s.invoices);
  const unread = useLiveInvoices((s) => s.unreadCount);
  const markAllRead = useLiveInvoices((s) => s.markAllRead);
  const [open, setOpen] = useState(false);

  // One swing per arrival: the swing animates the bell, the pop animates the badge.
  const swing = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const prevCount = useRef(invoices.length);

  useEffect(() => {
    const grew = invoices.length > prevCount.current;
    prevCount.current = invoices.length;
    if (!grew) return;
    // Bell: a quick ring — right, left, right, settle.
    swing.setValue(0);
    Animated.timing(swing, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    // Badge: overshoot then settle.
    pop.setValue(0.4);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
  }, [invoices.length, swing, pop]);

  // While anything is unread, a slow breathing glow draws the eye back to the bell.
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (unread === 0) {
      glow.stopAnimation();
      Animated.timing(glow, { toValue: 0, duration: MOTION.exit, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, easing: MOTION.easeOut, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.25, duration: 900, easing: MOTION.easeIn, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [unread, glow]);

  const rotate = swing.interpolate({
    inputRange: [0, 0.2, 0.45, 0.7, 1],
    outputRange: ['0deg', '16deg', '-13deg', '7deg', '0deg'],
  });

  const openSheet = () => {
    setOpen(true);
    markAllRead();
  };

  const pick = (invoice: LiveInvoice) => {
    setOpen(false);
    onOpenInvoice(invoice.barcodeCode);
  };

  return (
    <>
      <PressableScale
        onPress={openSheet}
        hitSlop={8}
        scaleTo={0.95}
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `${unread} new counter invoices` : 'Counter invoices'}
        style={styles.tap}
      >
        <Animated.View
          style={[
            styles.ring,
            {
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
              transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.25] }) }],
            },
          ]}
        />
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons
            name={unread > 0 ? 'notifications' : 'notifications-outline'}
            size={24}
            color={unread > 0 ? MART.fallbackPrimary : MART.ink}
          />
        </Animated.View>
        {unread > 0 ? (
          <Animated.View style={[styles.badge, { transform: [{ scale: pop }] }]}>
            <MartText variant="shelf" color={onFill(MART.danger).primary} style={TABULAR_NUMS}>
              {unread > 9 ? '9+' : `${unread}`}
            </MartText>
          </Animated.View>
        ) : null}
      </PressableScale>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHead}>
              <View style={styles.sheetTitle}>
                <View style={styles.headIcon}>
                  <Ionicons name="receipt-outline" size={18} color={MART.fallbackPrimary} />
                </View>
                <View>
                  <MartText variant="heading">Counter invoices</MartText>
                  <MartText variant="meta" color={MART.inkQuiet}>
                    Sent by the grocery clerks
                  </MartText>
                </View>
              </View>
              <Pressable onPress={() => setOpen(false)} hitSlop={8} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={MART.inkMuted} />
              </Pressable>
            </View>

            {invoices.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="notifications-off-outline" size={24} color={MART.inkQuiet} />
                </View>
                <MartText variant="meta" color={MART.inkQuiet} style={styles.emptyText}>
                  Nothing waiting. When a clerk forwards a sale, it rings here.
                </MartText>
              </View>
            ) : (
              <FlatList
                data={invoices}
                keyExtractor={(i) => i.invoiceId}
                style={styles.list}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => pick(item)}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  >
                    <View style={styles.rowIcon}>
                      <Ionicons
                        name={item.remote ? 'phone-portrait-outline' : 'storefront-outline'}
                        size={18}
                        color={MART.fallbackPrimary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowTop}>
                        <MartText variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                          {kes(item.grandTotal)}
                        </MartText>
                        <MartText variant="meta" color={MART.inkQuiet}>
                          {ago(item.at)}
                        </MartText>
                      </View>
                      <MartText variant="meta" color={MART.inkMuted} numberOfLines={1}>
                        {item.lineCount} {item.lineCount === 1 ? 'item' : 'items'} · from{' '}
                        {item.createdByName || 'the counter'}
                        {item.remote ? ' · runner' : ''}
                      </MartText>
                    </View>
                    <View style={styles.cta}>
                      <MartText variant="shelf" color={MART.fallbackPrimary}>
                        OPEN
                      </MartText>
                      <Ionicons name="chevron-forward" size={14} color={MART.fallbackPrimary} />
                    </View>
                  </Pressable>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // A bordered circle so it reads as a control, not a loose icon — matching the other header buttons.
  tap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
  },
  ring: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.fallbackPrimary, 0.16),
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 1,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: MART.paperElevated,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(22,24,15,0.28)',
    paddingTop: 96,
    paddingHorizontal: SPACE.md,
    alignItems: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '70%',
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: MART.border,
    overflow: 'hidden',
    ...SHADOW.hero,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: MART.border,
  },
  sheetTitle: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flex: 1 },
  headIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: tint(MART.fallbackPrimary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { flexGrow: 0 },
  sep: { height: 1, backgroundColor: MART.border, marginLeft: 60 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, padding: SPACE.md },
  rowPressed: { backgroundColor: MART.paperSunken },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.fallbackPrimary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  empty: { alignItems: 'center', gap: SPACE.sm, padding: SPACE.xxxl },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center', maxWidth: 240 },
});
