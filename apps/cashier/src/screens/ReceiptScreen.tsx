import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '@kiosk/ui';
import { GUTTER, MART, MOTION, PressableScale, RADIUS, SPACE, SHADOW, onFill, tint, MartText } from '@kiosk/staff';
import type { ApiClient } from '@kiosk/core';
import { CARD_SURFACE, EmptyOrErrorState, TABULAR_NUMS } from '../components/CashierPrimitives';
import { buildSaleSummary } from '../lib/sale-summary';
import { buildReceipt } from '../printing/receipt';
import { voidSale } from '../api/pos-api';
import { mayVoidSale } from '../lib/shop-flags';
import { recordCompletedSalePulse, shiftMilestoneLabel } from '../lib/shift-pulse';
import type { TillPerson } from '../lib/till-person';
import { usePosStore } from '../store/pos-store';
import { usePrinter } from '../store/printer-store';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Receipt'> & {
  shopName: string;
  tenantId: string;
  branchId: string;
  api: ApiClient;
  person: TillPerson;
};

/**
 * The sale just taken, in words: a summary of what the server recorded, which the cashier can share as text or print
 * to a paired Bluetooth thermal printer (see the printing/ folder). The printed slip is the shop's own receipt, laid
 * out from this same sale; the tax wording a fiscal receipt needs is still the server's to state.
 */
export function ReceiptScreen({ navigation, route, shopName, tenantId, branchId, api, person }: Props) {
  const insets = useSafeAreaInsets();
  const { lastSale, currentShift } = usePosStore();
  const canVoid = mayVoidSale(person.permissions);
  const [voiding, setVoiding] = useState(false);
  const [voided, setVoided] = useState(false);
  const [milestone, setMilestone] = useState<string | null>(null);
  const recordedSaleId = useRef<string | null>(null);
  const tickScale = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    Animated.timing(tickScale, {
      toValue: 1,
      duration: MOTION.state,
      easing: MOTION.easeOut,
      useNativeDriver: true,
    }).start();
  }, [tickScale]);

  useEffect(() => {
    const saleId = lastSale?.id;
    if (!saleId || recordedSaleId.current === saleId) return;
    recordedSaleId.current = saleId;
    void recordCompletedSalePulse(tenantId, branchId, person.userId, currentShift?.id ?? null).then((pulse) => {
      setMilestone(shiftMilestoneLabel(pulse.salesInShift));
    });
  }, [lastSale?.id, tenantId, branchId, person.userId, currentShift?.id]);
  const summary = useMemo(
    () =>
      lastSale
        ? buildSaleSummary(lastSale, {
            shopName,
            soldAt: route.params?.soldAt,
            changeCents: route.params?.changeCents,
          })
        : null,
    [lastSale, shopName, route.params?.soldAt, route.params?.changeCents]
  );

  const shareSummary = async () => {
    if (summary) await Share.share({ message: summary.text });
  };

  const saved = usePrinter((s) => s.saved);
  const printReceipt = usePrinter((s) => s.print);
  const [printing, setPrinting] = useState(false);

  const printSlip = async () => {
    if (!lastSale) return;
    // No printer yet: send the cashier to pair one, rather than failing silently.
    if (!saved) {
      navigation.navigate('PrinterSettings');
      return;
    }
    setPrinting(true);
    try {
      const receipt = buildReceipt(
        lastSale,
        { name: shopName },
        {
          paper: saved.paper,
          soldAt: route.params?.soldAt,
          changeCents: route.params?.changeCents,
        }
      );
      await printReceipt(receipt.build());
      // A mock printer "prints" to the preview; a real one puts paper out, so only open the preview
      // when there was no real printer to watch.
      if (saved.kind === 'mock') navigation.navigate('ReceiptPreview', { source: 'sale' });
    } catch (e) {
      Alert.alert('Could not print', e instanceof Error ? e.message : 'Try again, or re-pair the printer.');
    } finally {
      setPrinting(false);
    }
  };

  // Void the sale just rung — for a mis-ring the cashier catches right away. Confirmed first, since
  // it reverses the money and the stock; after it, only "New sale" is left.
  const voidThisSale = () => {
    const saleId = lastSale?.id;
    if (!saleId || voiding || voided) return;
    Alert.alert(
      'Void this sale?',
      'This reverses the sale — the money and the stock go back. It cannot be undone from here.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Void sale',
          style: 'destructive',
          onPress: () => {
            setVoiding(true);
            voidSale(api, saleId)
              .then(() => setVoided(true))
              .catch((e) =>
                Alert.alert('Could not void', e instanceof Error ? e.message : 'Try again, or ask an owner.')
              )
              .finally(() => setVoiding(false));
          },
        },
      ]
    );
  };

  const onPrimary = onFill(MART.fallbackPrimary).primary;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingBottom: Math.max(GUTTER, insets.bottom + SPACE.md) }]}
    >
      <View style={styles.head}>
        <Animated.View style={[styles.tick, { transform: [{ scale: tickScale }] }]}>
          <Ionicons name="checkmark" size={20} color={onPrimary} />
        </Animated.View>
        <MartText variant="title" style={{ flex: 1 }}>Sale complete</MartText>
        {milestone ? (
          <View style={styles.milestonePill}>
            <View style={styles.milestoneDot} />
            <MartText variant="meta" color={MART.ink} style={TABULAR_NUMS}>
              {milestone}
            </MartText>
          </View>
        ) : null}
      </View>

      {summary ? (
        <>
          {summary.change ? (
            // The one figure the cashier acts on right now: the change to hand back. It leads.
            <View style={styles.changeCard}>
              <MartText variant="shelf" color={tint(onPrimary, 0.8)}>
                CHANGE DUE
              </MartText>
              <MartText variant="hero" color={onPrimary} style={TABULAR_NUMS}>
                {summary.change}
              </MartText>
            </View>
          ) : null}

          <View style={styles.card}>
            <MartText variant="heading" style={styles.cardTitle}>
              {summary.heading}
            </MartText>

            {summary.items.map((item, index) => (
              <View key={`${index}-${item.name}`} style={styles.row}>
                <View style={styles.grow}>
                  <MartText variant="body">{item.name}</MartText>
                  {item.detail ? (
                    <MartText variant="meta" color={MART.inkQuiet}>
                      {item.detail}
                    </MartText>
                  ) : null}
                </View>
                <MartText variant="price" style={TABULAR_NUMS}>{item.total}</MartText>
              </View>
            ))}

            <View style={[styles.row, styles.totalRow]}>
              <MartText variant="title">Total</MartText>
              <MartText variant="title" style={TABULAR_NUMS}>{summary.total}</MartText>
            </View>

            {summary.payments.map((payment, index) => (
              <View key={`${index}-${payment.label}`} style={styles.row}>
                <MartText variant="body" color={MART.inkMuted}>
                  {payment.label}
                  {payment.reference ? ` (${payment.reference})` : ''}
                </MartText>
                <MartText variant="body" color={MART.inkMuted} style={TABULAR_NUMS}>
                  {payment.amount}
                </MartText>
              </View>
            ))}

            {summary.soldBy ? (
              <MartText variant="meta" color={MART.inkQuiet} style={styles.soldBy}>
                Sold by {summary.soldBy}
              </MartText>
            ) : null}
          </View>

          <MartText variant="meta" color={MART.inkQuiet} style={styles.note}>
            This is a summary of the sale, not the official receipt.
          </MartText>

          <Button
            title={printing ? 'Printing…' : saved ? 'Print receipt' : 'Set up printer'}
            onPress={() => void printSlip()}
            disabled={printing}
          />
          <Button title="Share summary" variant="secondary" onPress={() => void shareSummary()} style={styles.action} />

          {voided ? (
            <View style={styles.voidedBar}>
              <Ionicons name="close-circle" size={18} color={MART.danger} />
              <MartText variant="label" color={MART.danger}>
                Sale voided
              </MartText>
            </View>
          ) : canVoid && lastSale?.id ? (
            <PressableScale
              onPress={voidThisSale}
              disabled={voiding}
              style={[styles.voidBtn, voiding && styles.voidBusy]}
              accessibilityRole="button"
              accessibilityLabel="Void this sale"
            >
              <Ionicons name="close-circle-outline" size={16} color={MART.danger} />
              <MartText variant="label" color={MART.danger}>
                {voiding ? 'Voiding…' : 'Void this sale'}
              </MartText>
            </PressableScale>
          ) : null}
        </>
      ) : (
        <EmptyOrErrorState
          icon="receipt-outline"
          title="No sale to show"
          message="Complete a sale from the till to view and print its receipt."
        />
      )}

      <Button title="New sale" onPress={() => navigation.popTo('Pos', { reload: true })} style={styles.action} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper },
  container: {
    padding: GUTTER,
    flexGrow: 1,
    gap: SPACE.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  milestonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  milestoneDot: {
    width: 7,
    height: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.gold,
  },
  tick: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeCard: {
    backgroundColor: MART.fallbackPrimary,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.lg,
    gap: SPACE.xs,
    ...SHADOW.hero,
  },
  card: {
    ...CARD_SURFACE,
    padding: SPACE.lg,
    gap: SPACE.sm,
  },
  cardTitle: { marginBottom: SPACE.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACE.md,
  },
  grow: { flex: 1 },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: MART.border,
    marginTop: SPACE.xs,
    paddingTop: SPACE.md,
  },
  soldBy: { marginTop: SPACE.xs },
  note: { textAlign: 'center' },
  action: { marginTop: SPACE.xs },
  voidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    minHeight: 44,
    marginTop: SPACE.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.dangerSurface,
    backgroundColor: MART.dangerSurface,
  },
  voidPressed: { opacity: 0.75 },
  voidBusy: { opacity: 0.6 },
  voidedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    minHeight: 44,
    marginTop: SPACE.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.dangerSurface,
  },
  emptyBlock: {
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.xxxl,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center' },
});
