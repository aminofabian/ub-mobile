import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT, MART, MartText, PressableScale, RADIUS, SPACE, tint, WEIGHT } from '@kiosk/staff';
import { lineThousandths, type CartLine } from '../lib/cart';
import { zoneFor } from '@kiosk/staff';
import { formatMoney, toCents } from '../lib/money';
import { formatKg } from '../lib/weight';
import { CARD_SURFACE, TABULAR_NUMS } from './CashierPrimitives';
import { feel } from '../lib/feel';

/** The two letters that stand for a product in a list, the same rule the shelf uses. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '?';
  const second = words[1]?.[0] ?? words[0]?.[1] ?? '';
  return (first + second).toUpperCase();
}

/** "2" or "1.25 kg": how much of this line there is, with its unit said once. */
function qtyText(line: CartLine): string {
  if (line.weighed) {
    // `formatKg` already ends in " kg" — the row must not add it again.
    return formatKg(lineThousandths(line));
  }
  return `${Number.isInteger(line.quantity) ? line.quantity : Math.round(line.quantity * 1000) / 1000}`;
}

/** The line's total in cents: qty × unit price (kg × per-kg for a weighed line). */
function lineCents(line: CartLine): number {
  return toCents(line.quantity * line.unitPrice) ?? 0;
}

function money(cents: number): string {
  return `KES ${formatMoney(cents)}`;
}

/**
 * The basket, shown on the checkout page so the cashier can see exactly what is being paid for — each
 * product, how many (or how many kilograms), the unit price and the line total. Every product line
 * also carries a scale toggle: tap it to sell that product by weight instead of by the unit (or back
 * again), the same control the web till has. The toggle changes the shop's record of the product, so
 * it is only shown where the shop allows it and the till is online.
 */
export function CheckoutLines({
  cart,
  canToggleWeighed,
  online,
  busyItemId,
  onToggleWeighed,
  onSetUnits,
  onReweigh,
  onRemove,
}: {
  cart: readonly CartLine[];
  canToggleWeighed: boolean;
  online: boolean;
  busyItemId: string | null;
  onToggleWeighed: (line: CartLine) => void;
  /** Set a unit line's whole-number quantity. 0 takes the line out. */
  onSetUnits: (itemId: string, quantity: number) => void;
  /** The cashier wants to re-weigh a weighed line — open the weigh prompt. */
  onReweigh: (line: CartLine) => void;
  /** Take a line out of the basket. */
  onRemove: (itemId: string) => void;
}) {
  if (cart.length === 0) return null;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <MartText variant="shelf" color={MART.inkQuiet} style={styles.headLabel}>
          IN THIS SALE
        </MartText>
        <MartText variant="shelf" color={MART.inkQuiet} style={TABULAR_NUMS}>
          {cart.length === 1 ? '1 LINE' : `${cart.length} LINES`}
        </MartText>
      </View>
      <View style={styles.headRule} />

      {cart.map((line, index) => (
        <LineRow
          key={line.itemId}
          line={line}
          divider={index > 0}
          canToggleWeighed={canToggleWeighed}
          online={online}
          busy={busyItemId === line.itemId}
          onToggleWeighed={onToggleWeighed}
          onSetUnits={onSetUnits}
          onReweigh={onReweigh}
          onRemove={onRemove}
        />
      ))}
    </View>
  );
}

/** One basket line: name, the running qty×price and total, a weigh toggle, and a way to change how many. */
function LineRow({
  line,
  divider,
  canToggleWeighed,
  online,
  busy,
  onToggleWeighed,
  onSetUnits,
  onReweigh,
  onRemove,
}: {
  line: CartLine;
  divider: boolean;
  canToggleWeighed: boolean;
  online: boolean;
  busy: boolean;
  onToggleWeighed: (line: CartLine) => void;
  onSetUnits: (itemId: string, quantity: number) => void;
  onReweigh: (line: CartLine) => void;
  onRemove: (itemId: string) => void;
}) {
  const isService = Boolean(line.service);
  const showToggle = canToggleWeighed && !isService;
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState('');

  const commit = () => {
    const n = Math.max(0, Math.trunc(Number(typed.replace(/[^0-9]/g, '')) || 0));
    onSetUnits(line.itemId, n);
    setEditing(false);
    setTyped('');
  };

  const units = Math.round(line.quantity);

  return (
    <View style={[styles.rowWrap, divider && styles.rowWrapDivider]}>
    <View style={styles.row}>
      {/* The mark first: the same colour and letters the tile had, so the line is recognised in a glance. */}
      <View style={[styles.mark, { backgroundColor: tint(zoneFor(line.name), 0.18) }]}>
        <MartText variant="shelf" color={tint(MART.ink, 0.66)}>
          {initialsOf(line.name)}
        </MartText>
      </View>
      {/* Left: what it is and what one costs. Right: a fixed column holding what it comes to, and the
          one control that changes how many — so every total and every stepper lines up down the list. */}
      <View style={styles.left}>
        <MartText variant="heading" numberOfLines={2}>
          {line.name}
        </MartText>
        <View style={styles.metaRow}>
          <MartText variant="meta" color={MART.inkQuiet} style={TABULAR_NUMS}>
            {money(toCents(line.unitPrice) ?? 0)}
            {line.weighed ? ' /kg' : ' each'}
          </MartText>
          {showToggle ? (
            <Pressable
              onPress={() => onToggleWeighed(line)}
              disabled={busy || !online}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityState={{ selected: line.weighed === true, disabled: busy || !online }}
              accessibilityLabel={
                line.weighed ? `${line.name}: sold by weight, tap to sell by unit` : `${line.name}: mark as sold by weight`
              }
              style={({ pressed }) => [
                styles.swap,
                line.weighed && styles.swapOn,
                (pressed || busy) && styles.swapBusy,
                !online && styles.swapOff,
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color={MART.fallbackPrimary} />
              ) : (
                <Ionicons
                  name="swap-horizontal"
                  size={12}
                  color={line.weighed ? MART.fallbackPrimary : MART.inkQuiet}
                />
              )}
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.right}>
        <MartText variant="price" color={MART.ink} style={[styles.total, TABULAR_NUMS]}>
          {money(lineCents(line))}
        </MartText>
        {line.weighed ? (
          // A weighed line is changed by re-weighing, not by a stepper.
          <PressableScale onPress={() => onReweigh(line)} style={styles.weighChip}>
            <Ionicons name="scale-outline" size={12} color={MART.fallbackPrimary} />
            <MartText variant="label" color={MART.fallbackPrimary} style={TABULAR_NUMS}>
              {qtyText(line)}
            </MartText>
          </PressableScale>
        ) : isService ? (
          <MartText variant="label" color={MART.ink} style={[TABULAR_NUMS, styles.serviceQty]}>
            {qtyText(line)}
          </MartText>
        ) : (
          <View style={styles.stepper}>
            <Pressable
              onPress={() => {
                feel.select();
                if (units <= 1) onRemove(line.itemId);
                else onSetUnits(line.itemId, units - 1);
              }}
              style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
              hitSlop={7}
              accessibilityLabel={units <= 1 ? `Remove ${line.name}` : `One fewer ${line.name}`}
            >
              <Ionicons name={units <= 1 ? 'trash-outline' : 'remove'} size={15} color={units <= 1 ? MART.danger : MART.ink} />
            </Pressable>
            {editing ? (
              <TextInput
                value={typed}
                onChangeText={setTyped}
                keyboardType="number-pad"
                autoFocus
                placeholder={String(units)}
                placeholderTextColor={MART.inkQuiet}
                style={[styles.qtyInput, TABULAR_NUMS]}
                onBlur={commit}
                onSubmitEditing={commit}
                returnKeyType="done"
              />
            ) : (
              <Pressable
                onPress={() => {
                  setEditing(true);
                  setTyped(String(units));
                }}
                style={styles.qtyTap}
                hitSlop={4}
                accessibilityLabel={`${units}, tap to type`}
              >
                <MartText variant="heading" style={TABULAR_NUMS}>{units}</MartText>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                feel.select();
                onSetUnits(line.itemId, units + 1);
              }}
              style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
              hitSlop={7}
              accessibilityLabel={`One more ${line.name}`}
            >
              <Ionicons name="add" size={15} color={MART.ink} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: SPACE.md,
    ...CARD_SURFACE,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.sm,
  },
  headLabel: { letterSpacing: 1.1 },
  headRule: { height: 1, backgroundColor: MART.border, marginBottom: SPACE.xs },
  rowWrap: { paddingVertical: SPACE.sm },
  // The rule begins where the words do, so the marks form a clean column down the left.
  rowWrapDivider: { borderTopWidth: 1, borderTopColor: MART.border, marginLeft: 44 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, paddingVertical: SPACE.xs },
  mark: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  left: { flex: 1, gap: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  // The right column is a fixed width so the money and the stepper form two clean columns down the list.
  // Wide enough for "KES 1,510.00" never to wrap; the money and the control share one right edge.
  right: { width: 108, alignItems: 'flex-end', gap: 3 },
  total: { textAlign: 'right' },
  // A quiet swap for "sold by weight / by unit": part of the meta line, not a button competing with the stepper.
  swap: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapOn: { backgroundColor: tint(MART.fallbackPrimary, 0.12) },
  swapBusy: { opacity: 0.6 },
  swapOff: { opacity: 0.4 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPressed: { backgroundColor: MART.paperSunken },
  qtyTap: { minWidth: 22, alignItems: 'center', justifyContent: 'center', minHeight: 32 },
  qtyInput: {
    minWidth: 40,
    textAlign: 'center',
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 15,
    color: MART.ink,
    minHeight: 32,
    paddingVertical: 0,
  },
  serviceQty: { minHeight: 32, textAlignVertical: 'center' },
  // A weighed line's "re-weigh" chip: the weight, said once, in the same column as the stepper.
  weighChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: SPACE.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.fallbackPrimary, 0.1),
  },
});
