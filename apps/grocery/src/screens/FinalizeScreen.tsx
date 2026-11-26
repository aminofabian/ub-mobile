import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatKes, formatQty, generateIdempotencyKey, QTY_SCALE } from '@kiosk/core';
import { MartText, WeightSheet, MART, tint, zoneFor, useKept } from '@kiosk/staff';
import { Banner, Button, Text, theme } from '@kiosk/ui';
import { basketProblemWords, basketTotalCents, claimBasket, clearBasket, lineTotalCents, removeLine, setQuantity, type BasketLine } from '../lib/basket';
import { startForward, startProblemWords } from '../lib/forward';
import { basketHeadline } from '../lib/sale-words';
import { useForwardSender } from '../lib/sender';
import { useGrocerySession } from '../lib/session';
import type { GroceryStackParamList } from '../navigation/AppNavigator';
import { basketKeeperFor, forwardKeeperFor } from '../store/invoice-store';

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
            <MartText variant="heading" numberOfLines={2}>
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
                <MartText variant="heading" style={styles.count}>{units}</MartText>
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
          const problem = onSet(thousandths);
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
        <Text variant="muted" style={styles.empty}>
          The basket is empty.
        </Text>
        <Button title="Back to selling" onPress={() => navigation.navigate('Builder')} style={styles.pad} />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {problem ? <Banner tone="danger">{problem}</Banner> : null}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <MartText variant="shelf" color={MART.inkQuiet} style={styles.cardHeadLabel}>
              IN THIS SALE
            </MartText>
            <MartText variant="shelf" color={MART.inkQuiet}>
              {basket.lines.length === 1 ? '1 LINE' : `${basket.lines.length} LINES`}
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
        <Button title="Clear the basket" variant="secondary" onPress={confirmClear} style={styles.clear} />
      </ScrollView>

      <View style={styles.bar}>
        <View style={styles.barTop}>
          <MartText variant="meta" color={MART.inkQuiet}>
            {basket.lines.length === 1 ? '1 line' : `${basket.lines.length} lines`}
          </MartText>
          <MartText variant="title" numberOfLines={1} adjustsFontSizeToFit>
            {formatKes(basketTotalCents(basket))}
          </MartText>
        </View>
        <MartText variant="meta" color={MART.inkQuiet} style={styles.fine}>
          The server prices the invoice. If a price has changed, the cashier's total can differ from this one.
        </MartText>
        <Button
          title={busy ? 'Sending to the till…' : 'Send to cashier →'}
          onPress={() => void send()}
          disabled={busy || !ready || basket.lines.length === 0}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barLabel: { fontFamily: 'System', fontWeight: '600' },
  // One card for the whole basket, ruled between lines, exactly as the till draws its checkout list.
  card: {
    borderRadius: 22,
    backgroundColor: MART.paperElevated,
    paddingHorizontal: 12,
    paddingTop: 4,
    shadowColor: MART.ink,
    shadowOpacity: 0.10,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  cardHeadLabel: { letterSpacing: 1.1 },
  headRule: { height: 1, backgroundColor: MART.border },
  rowWrap: { paddingVertical: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: MART.border, marginLeft: 44 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  mark: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  left: { flex: 1, gap: 1 },
  right: { width: 108, alignItems: 'flex-end', gap: 3 },
  rowError: { paddingLeft: 44, paddingTop: 2 },
  weighChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: tint(MART.fallbackPrimary, 0.1),
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stepBtn: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: MART.paperSunken },
  count: { minWidth: 22, textAlign: 'center' },
  pressed: { opacity: 0.7 },

  fill: { flex: 1, backgroundColor: theme.colors.background },
  pad: { margin: theme.spacing.md },
  body: { padding: theme.spacing.md },
  empty: { textAlign: 'center', padding: theme.spacing.lg },
  retry: { marginTop: theme.spacing.sm },
  error: { color: theme.colors.danger, marginTop: theme.spacing.xs },
  clear: { marginTop: theme.spacing.sm },
  bar: {
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 30,
    backgroundColor: MART.paperElevated,
    shadowColor: MART.ink,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  barOld: { padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  barTop: { gap: 2 },
  total: { marginBottom: 0 },
  fine: { marginBottom: theme.spacing.sm },
});
