import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatKes, formatQty, generateIdempotencyKey, QTY_SCALE } from '@kiosk/core';
import {
  Gloss,
  MartText,
  PressableScale,
  WeightSheet,
  FONT,
  WEIGHT,
  MART,
  RADIUS,
  SHADOW,
  SPACE,
  onFill,
  tint,
  zoneFor,
  useKept,
} from '@kiosk/staff';
import { Banner, Button, Text } from '@kiosk/ui';
import { basketProblemWords, basketTotalCents, claimBasket, clearBasket, lineTotalCents, removeLine, setQuantity, type BasketLine } from '../lib/basket';
import { startForward, startProblemWords } from '../lib/forward';
import { unitsFromThousandths } from '../lib/pick';
import { useForwardSender } from '../lib/sender';
import { useGrocerySession } from '../lib/session';
import type { GroceryStackParamList } from '../navigation/AppNavigator';
import { basketKeeperFor, forwardKeeperFor } from '../store/invoice-store';

const TABULAR = { fontVariant: ['tabular-nums'] as Array<'tabular-nums'> };

type Props = NativeStackScreenProps<GroceryStackParamList, 'Finalize'>;

/** One line of the basket, with what can be changed about it: more or fewer, a typed weight, or taking it out. */
/** The two letters that stand for a product in the basket, as the till's rows show. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? words[0]?.[1] ?? '')).toUpperCase();
}

/**
 * One line in the basket, drawn as the till draws it: a product mark, what it is and what one costs on the left, what
 * the line comes to and the one control that changes it on the right. Unit lines step; weighed lines open the weigh
 * sheet, because that is how their quantity is decided.
 */
function BasketLine({ line, divider, onSet, onRemove }: { line: BasketLine; divider: boolean; onSet: (units: number) => string | null; onRemove: () => void }) {
  const [weighing, setWeighing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const units = Math.round(line.quantityUnits / QTY_SCALE);

  return (
    <>
      <View style={[styles.rowWrap, divider && styles.rowDivider]}>
        <View style={styles.row}>
          <View style={[styles.mark, { backgroundColor: tint(zoneFor(line.name), 0.18) }]}>
            <MartText variant="shelf" color={tint(MART.ink, 0.66)}>
              {initialsOf(line.name)}
            </MartText>
          </View>
          <View style={styles.left}>
            <MartText variant="heading" numberOfLines={2} style={styles.productName}>
              {line.name}
            </MartText>
            <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
              {`${formatKes(line.unitCents)}${line.weighed ? ` /${line.unitName}` : ' each'}`}
            </MartText>
          </View>
          <View style={styles.right}>
            <MartText variant="price" numberOfLines={1}>
              {formatKes(lineTotalCents(line.quantityUnits, line.unitCents))}
            </MartText>
            {line.weighed ? (
              <Pressable
                onPress={() => setWeighing(true)}
                accessibilityRole="button"
                accessibilityLabel={`${line.name}, ${formatQty(line.quantityUnits)} ${line.unitName}. Tap to weigh again.`}
                style={({ pressed }) => [styles.weighChip, pressed && styles.pressed]}
              >
                <Ionicons name="scale-outline" size={12} color={MART.fallbackPrimary} />
                <MartText variant="label" color={MART.fallbackPrimary}>
                  {`${formatQty(line.quantityUnits)} ${line.unitName}`}
                </MartText>
              </Pressable>
            ) : (
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => {
                    if (units <= 1) onRemove();
                    else setError(onSet(line.quantityUnits - QTY_SCALE));
                  }}
                  hitSlop={7}
                  accessibilityLabel={units <= 1 ? `Remove ${line.name}` : `One fewer ${line.name}`}
                  style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                >
                  <Ionicons name={units <= 1 ? 'trash-outline' : 'remove'} size={15} color={units <= 1 ? MART.danger : MART.ink} />
                </Pressable>
                <MartText variant="heading" style={[styles.count, TABULAR]}>{units}</MartText>
                <Pressable
                  onPress={() => setError(onSet(line.quantityUnits + QTY_SCALE))}
                  hitSlop={7}
                  accessibilityLabel={`One more ${line.name}`}
                  style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="add" size={15} color={MART.ink} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
        {error ? (
          <MartText variant="meta" color={MART.danger} style={styles.rowError}>
            {error}
          </MartText>
        ) : null}
      </View>

      <WeightSheet
        visible={weighing}
        name={line.name}
        unit={line.unitName}
        perUnitCents={line.unitCents}
        onCancel={() => setWeighing(false)}
        onConfirm={(thousandths) => {
          // WeightSheet is in thousandths; the basket is in ten-thousandths (QTY_SCALE).
          const problem = onSet(unitsFromThousandths(thousandths));
          if (!problem) setWeighing(false);
          return problem;
        }}
      />
    </>
  );
}

export function FinalizeScreen({ navigation }: Props) {
  const { tenantId, userId, branchId } = useGrocerySession();
  const { flush } = useForwardSender();
  const basketKeeper = useMemo(() => basketKeeperFor(tenantId), [tenantId]);
  const forwardKeeper = useMemo(() => forwardKeeperFor(tenantId), [tenantId]);
  const basketKept = useKept(basketKeeper);
  const forwardKept = useKept(forwardKeeper);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const owner = useMemo(() => ({ ownerId: userId, branchId }), [userId, branchId]);
  const basket = useMemo(() => claimBasket(basketKept.value, owner, Date.now()), [basketKept.value, owner]);
  const ready = basketKept.ready && forwardKept.ready;

  const changeQuantity = useCallback(
    (lineId: string, units: number): string | null => {
      const result = setQuantity(claimBasket(basketKeeper.get(), owner, Date.now()), lineId, units, Date.now());
      if (!result.ok) return basketProblemWords[result.why];
      basketKeeper.update(() => result.basket);
      return null;
    },
    [basketKeeper, owner]
  );

  const takeOut = useCallback(
    (lineId: string) => {
      const current = claimBasket(basketKeeper.get(), owner, Date.now());
      const next = removeLine(current, lineId, Date.now());
      if (next !== current) basketKeeper.update(() => next);
    },
    [basketKeeper, owner]
  );

  const empty = useCallback(() => {
    basketKeeper.update((current) => (current && current.ownerId === userId && current.branchId === branchId ? clearBasket(current, Date.now()) : current));
  }, [basketKeeper, userId, branchId]);

  const confirmClear = useCallback(() => {
    Alert.alert('Clear the basket?', 'Everything in it is taken out. Nothing is sent.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: empty },
    ]);
  }, [empty]);

  const send = useCallback(async () => {
    if (busy || !ready) return;
    setBusy(true);
    setProblem(null);
    try {
      const at = Date.now();
      const current = claimBasket(basketKeeper.get(), owner, at);
      const started = startForward(forwardKeeper.get(), current, { id: generateIdempotencyKey(), issueKey: generateIdempotencyKey() }, at);
      if (!started.ok) {
        // This very basket is already in the list of sales to send (the app closed before the basket was cleared): it is not sent again.
        if (started.why === 'already_sent') empty();
        setProblem(startProblemWords[started.why]);
        return;
      }
      forwardKeeper.update(() => started.state);
      const landed = await forwardKeeper.saved();
      if (!landed) {
        // The phone could not write the sale down, so it is not the phone's to send: take it back out and keep the basket.
        forwardKeeper.update((state) => ({ entries: state.entries.filter((entry) => entry.id !== started.entry.id) }));
        setProblem('This phone could not keep the sale, so nothing was sent. The basket is still here. Free up some space and try again.');
        return;
      }
      basketKeeper.update((kept) => (kept && kept.savedAt === current.savedAt ? clearBasket(kept, Date.now()) : kept));
      void flush();
      navigation.navigate('Builder');
    } finally {
      setBusy(false);
    }
  }, [busy, ready, basketKeeper, forwardKeeper, owner, empty, flush, navigation]);

  if (basketKept.failed || forwardKept.failed) {
    return (
      <View style={styles.fill}>
        <Banner tone="danger" style={styles.pad}>
          <Text variant="caption">What is kept on this phone could not be read. Nothing has been lost.</Text>
          <Button
            title="Try again"
            variant="secondary"
            onPress={() => {
              basketKept.retry();
              forwardKept.retry();
            }}
            style={styles.retry}
          />
        </Banner>
      </View>
    );
  }

  if (basketKept.ready && basket.lines.length === 0) {
    return (
      <View style={styles.fill}>
        <Gloss />
        <View style={styles.emptyWrap}>
          <View style={styles.emptyMark}>
            <Ionicons name="basket-outline" size={28} color={MART.inkQuiet} />
          </View>
          <MartText variant="title" style={styles.emptyTitle}>
            Basket empty
          </MartText>
          <MartText variant="meta" color={MART.inkQuiet} style={styles.emptyCopy}>
            Add items on the counter, then come back to send them.
          </MartText>
          <PressableScale
            onPress={() => navigation.navigate('Builder')}
            scaleTo={0.97}
            style={styles.emptyCta}
            accessibilityRole="button"
            accessibilityLabel="Back to selling"
          >
            <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
              Back to selling
            </MartText>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Gloss />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {problem ? <Banner tone="danger">{problem}</Banner> : null}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <MartText variant="shelf" color={MART.inkQuiet} style={styles.cardHeadLabel}>
              IN THIS SALE
            </MartText>
            <MartText variant="shelf" color={MART.inkQuiet}>
              {basket.lines.length === 1 ? '1 ITEM' : `${basket.lines.length} ITEMS`}
            </MartText>
          </View>
          <View style={styles.headRule} />
          {basket.lines.map((line, index) => (
            <BasketLine
              key={line.lineId}
              line={line}
              divider={index > 0}
              onSet={(units) => changeQuantity(line.lineId, units)}
              onRemove={() => takeOut(line.lineId)}
            />
          ))}
        </View>
        <Pressable
          onPress={confirmClear}
          accessibilityRole="button"
          accessibilityLabel="Clear the basket"
          style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
        >
          <MartText variant="label" color={MART.danger}>
            Clear the basket
          </MartText>
        </Pressable>
      </ScrollView>

      <View style={styles.bar}>
        <View style={styles.barTop}>
          <MartText variant="meta" color={MART.inkQuiet}>
            {basket.lines.length === 1 ? '1 item' : `${basket.lines.length} items`}
          </MartText>
          <MartText variant="title" numberOfLines={1} adjustsFontSizeToFit style={TABULAR}>
            {formatKes(basketTotalCents(basket))}
          </MartText>
        </View>
        <MartText variant="meta" color={MART.inkQuiet} style={styles.fine}>
          The till prices the invoice. If a price has changed, the cashier's total can differ.
        </MartText>
        <PressableScale
          onPress={() => void send()}
          disabled={busy || !ready || basket.lines.length === 0}
          scaleTo={0.97}
          style={[styles.sendBtn, (busy || !ready || basket.lines.length === 0) && styles.dim]}
          accessibilityRole="button"
          accessibilityLabel={busy ? 'Sending to the till' : 'Send to cashier'}
        >
          <MartText variant="label" color={onFill(MART.fallbackPrimary).primary} style={styles.sendLabel}>
            {busy ? 'Sending…' : 'Send to cashier'}
          </MartText>
          {!busy ? (
            <View style={styles.sendDisc}>
              <Ionicons name="arrow-forward" size={16} color={MART.fallbackPrimary} />
            </View>
          ) : null}
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  pad: { margin: SPACE.md },
  body: { padding: SPACE.md, paddingBottom: SPACE.xxl, gap: SPACE.md },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACE.xxl, gap: SPACE.sm },
  emptyMark: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperElevated,
    ...SHADOW.card,
    marginBottom: SPACE.sm,
  },
  emptyTitle: { textAlign: 'center' },
  emptyCopy: { textAlign: 'center', maxWidth: 280 },
  emptyCta: {
    marginTop: SPACE.md,
    minHeight: 48,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retry: { marginTop: SPACE.sm },
  card: {
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.xs,
    ...SHADOW.card,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACE.sm },
  cardHeadLabel: { letterSpacing: 1.1 },
  headRule: { height: StyleSheet.hairlineWidth, backgroundColor: MART.border },
  rowWrap: { paddingVertical: SPACE.sm },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: MART.border, marginLeft: 44 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  mark: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  left: { flex: 1, gap: 1 },
  productName: { fontFamily: FONT.regular, fontWeight: WEIGHT.regular },
  right: { width: 108, alignItems: 'flex-end', gap: 3 },
  rowError: { paddingLeft: 44, paddingTop: 2 },
  weighChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.fallbackPrimary, 0.1),
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stepBtn: { width: 32, height: 32, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: MART.paperSunken },
  count: { minWidth: 22, textAlign: 'center' },
  pressed: { opacity: 0.7 },
  clearBtn: {
    alignSelf: 'center',
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.lg,
  },
  bar: {
    gap: SPACE.sm,
    width: '96%',
    maxWidth: 760,
    alignSelf: 'center',
    marginBottom: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.xl,
    backgroundColor: MART.paperElevated,
    ...SHADOW.floating,
  },
  barTop: { gap: 2 },
  fine: { marginBottom: SPACE.xs },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    minHeight: 54,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    shadowColor: MART.fallbackPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  sendDisc: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperSunken,
  },
  dim: { opacity: 0.5 },
  sendLabel: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold, fontSize: 15, letterSpacing: -0.2 },
});
