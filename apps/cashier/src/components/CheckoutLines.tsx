import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONT, MART, MartText, PressableScale, RADIUS, SPACE, tint } from '@kiosk/staff';
import { lineThousandths, type CartLine } from '../lib/cart';
import { formatMoney, toCents } from '../lib/money';
import { formatKg } from '../lib/weight';
import { CARD_SURFACE, TABULAR_NUMS } from './CashierPrimitives';

/** "2" or "1.25 kg": how much of this line there is, in the right unit. */
function qtyText(line: CartLine): string {
  if (line.weighed) {
    return `${formatKg(lineThousandths(line))} kg`;
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
        <MartText variant="shelf" color={MART.inkQuiet}>
          IN THIS SALE
        </MartText>
        <MartText variant="shelf" color={MART.inkQuiet}>
          {cart.length === 1 ? '1 LINE' : `${cart.length} LINES`}
        </MartText>
      </View>

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
    <View style={[styles.row, divider && styles.rowDivider]}>
      {/* Top line: name + weigh toggle + total */}
      <View style={styles.topRow}>
        <View style={styles.nameRow}>
          <MartText variant="heading" numberOfLines={2} style={{ flex: 1 }}>
            {line.name}
          </MartText>
          {line.weighed ? (
            <View style={styles.weighTag}>
              <Ionicons name="scale-outline" size={11} color={MART.fallbackPrimary} />
              <MartText variant="shelf" color={MART.fallbackPrimary}>
                KG
              </MartText>
            </View>
          ) : null}
        </View>
        {showToggle ? (
          <Pressable
            onPress={() => onToggleWeighed(line)}
            disabled={busy || !online}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityState={{ selected: line.weighed === true, disabled: busy || !online }}
            accessibilityLabel={
              line.weighed ? `${line.name}: sold by weight, tap to sell by unit` : `${line.name}: mark as sold by weight`
            }
            style={({ pressed }) => [
              styles.scaleBtn,
              line.weighed && styles.scaleBtnOn,
              (pressed || busy) && styles.scaleBtnBusy,
              !online && styles.scaleBtnOff,
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={line.weighed ? MART.fallbackPrimary : MART.inkQuiet} />
            ) : (
              <Ionicons name="scale-outline" size={18} color={line.weighed ? MART.fallbackPrimary : MART.inkMuted} />
            )}
          </Pressable>
        ) : null}
        <MartText variant="price" color={MART.ink} style={[styles.lineTotal, TABULAR_NUMS]}>
          {money(lineCents(line))}
        </MartText>
      </View>

      {/* Bottom line: unit-price hint + how-many control */}
      <View style={styles.qtyRow}>
        <MartText variant="meta" color={MART.inkQuiet} style={[{ flex: 1 }, TABULAR_NUMS]}>
          {money(toCents(line.unitPrice) ?? 0)}
          {line.weighed ? ' /kg' : ' each'}
        </MartText>

        {line.weighed ? (
          // A weighed line is changed by re-weighing, not by a stepper.
          <PressableScale onPress={() => onReweigh(line)} style={styles.weighEdit}>
            <Ionicons name="scale-outline" size={14} color={MART.fallbackPrimary} />
            <MartText variant="label" color={MART.fallbackPrimary} style={TABULAR_NUMS}>
              {qtyText(line)} kg
            </MartText>
          </PressableScale>
        ) : isService ? (
          <MartText variant="label" color={MART.ink} style={TABULAR_NUMS}>
            {qtyText(line)}
          </MartText>
        ) : (
          <View style={styles.stepper}>
            <Pressable
              onPress={() => (units <= 1 ? onRemove(line.itemId) : onSetUnits(line.itemId, units - 1))}
              style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
              hitSlop={6}
              accessibilityLabel={units <= 1 ? `Remove ${line.name}` : `One fewer ${line.name}`}
            >
              <Ionicons name={units <= 1 ? 'trash-outline' : 'remove'} size={16} color={units <= 1 ? MART.danger : MART.ink} />
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
              onPress={() => onSetUnits(line.itemId, units + 1)}
              style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
              hitSlop={6}
              accessibilityLabel={`One more ${line.name}`}
            >
              <Ionicons name="add" size={16} color={MART.ink} />
            </Pressable>
          </View>
        )}
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
    paddingVertical: SPACE.sm,
  },
  row: {
    paddingVertical: SPACE.sm,
    gap: SPACE.xs,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: MART.border },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginLeft: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, flex: 1 },
  weighTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.fallbackPrimary, 0.12),
  },
  scaleBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleBtnOn: {
    borderColor: tint(MART.fallbackPrimary, 0.45),
    backgroundColor: tint(MART.fallbackPrimary, 0.12),
  },
  scaleBtnBusy: { opacity: 0.6 },
  scaleBtnOff: { opacity: 0.4 },
  lineTotal: { minWidth: 86, textAlign: 'right' },
  // Unit quantity stepper, matching the one on the product tile.
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    backgroundColor: tint(MART.fallbackPrimary, 0.08),
    borderRadius: RADIUS.pill,
    padding: 3,
  },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPressed: { backgroundColor: MART.paperSunken },
  qtyTap: { minWidth: 36, alignItems: 'center', justifyContent: 'center', minHeight: 38 },
  qtyInput: { minWidth: 44, textAlign: 'center', fontFamily: FONT.semibold, fontSize: 15, color: MART.ink, minHeight: 38, paddingVertical: 0 },
  // A weighed line's "re-weigh" chip.
  weighEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    minHeight: 38,
    paddingHorizontal: SPACE.md,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: tint(MART.fallbackPrimary, 0.35),
    backgroundColor: tint(MART.fallbackPrimary, 0.08),
  },
});
