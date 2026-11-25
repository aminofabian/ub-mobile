import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GUTTER, MART, RADIUS, SPACE, tint, MartText, onFill } from '@kiosk/staff';
import {
  bump,
  denomLabel,
  drawerPieces,
  drawerTotal,
  emptyDrawer,
  isNote,
  KES_DENOMINATIONS,
  setCount,
  type DrawerCount,
} from '../lib/denominations';

type Props = {
  /** "Open" counts the float at the start; "Close" counts what is in the drawer at the end. */
  mode: 'open' | 'close';
  /** What the shift expects in the drawer (the opening float + takings), for a "counted vs expected" line when closing. */
  expectedTotal?: number | null;
  onCancel: () => void;
  /** The counted total, in whole shillings, when the cashier is done. */
  onDone: (total: number) => void;
};

function kes(n: number): string {
  return `KES ${n.toLocaleString('en-KE')}`;
}

/** One denomination: its face value, a −/count/＋ stepper, and the line subtotal. */
function Row({ value, count, onChange }: { value: number; count: number; onChange: (n: number) => void }) {
  const accent = isNote(value) ? MART.fallbackPrimary : MART.fallbackAccent;
  return (
    <View style={styles.row}>
      <View style={[styles.chip, { backgroundColor: tint(accent, 0.14) }]}>
        <MartText variant="label" color={accent}>
          {value.toLocaleString('en-KE')}
        </MartText>
      </View>
      <View style={styles.stepper}>
        <Pressable onPress={() => onChange(count - 1)} style={styles.step} hitSlop={6} disabled={count <= 0}>
          <Ionicons name="remove" size={18} color={count <= 0 ? MART.inkQuiet : MART.ink} />
        </Pressable>
        <TextInput
          value={count > 0 ? String(count) : ''}
          onChangeText={(t) => onChange(Number(t.replace(/[^0-9]/g, '')) || 0)}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={MART.inkQuiet}
          style={styles.countInput}
        />
        <Pressable onPress={() => onChange(count + 1)} style={styles.step} hitSlop={6}>
          <Ionicons name="add" size={18} color={MART.ink} />
        </Pressable>
      </View>
      <MartText variant="price" color={count > 0 ? MART.ink : MART.inkQuiet} style={styles.lineTotal}>
        {kes(value * count)}
      </MartText>
    </View>
  );
}

/**
 * Count the cash drawer by note and coin. The server wants one total, so this adds the pieces up and hands back the
 * sum. When closing, it shows counted-against-expected so an over or short is plain before the shift is closed.
 */
export function DenominationSheet({ mode, expectedTotal, onCancel, onDone }: Props) {
  const [count, setCount_] = useState<DrawerCount>(emptyDrawer);
  const total = useMemo(() => drawerTotal(count), [count]);
  const pieces = drawerPieces(count);
  const notes = KES_DENOMINATIONS.filter(isNote);
  const coins = KES_DENOMINATIONS.filter((v) => !isNote(v));
  const diff = expectedTotal != null ? total - expectedTotal : null;

  const change = (value: number) => (n: number) => setCount_((c) => setCount(c, value, n));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.grip} />
          <View style={styles.head}>
            <View>
              <MartText variant="shelf" color={MART.inkQuiet}>
                {mode === 'open' ? 'COUNT THE FLOAT' : 'COUNT THE DRAWER'}
              </MartText>
              <MartText variant="title">{mode === 'open' ? 'Opening cash' : 'Closing cash'}</MartText>
            </View>
            <Pressable onPress={onCancel} hitSlop={8} style={styles.close}>
              <Ionicons name="close" size={22} color={MART.inkMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            <MartText variant="shelf" color={MART.inkQuiet} style={styles.group}>
              NOTES
            </MartText>
            {notes.map((value) => (
              <Row key={value} value={value} count={count[value] ?? 0} onChange={change(value)} />
            ))}
            <MartText variant="shelf" color={MART.inkQuiet} style={styles.group}>
              COINS
            </MartText>
            {coins.map((value) => (
              <Row key={value} value={value} count={count[value] ?? 0} onChange={change(value)} />
            ))}
          </ScrollView>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <MartText variant="meta" color={MART.inkQuiet}>
                {pieces === 1 ? '1 piece' : `${pieces} pieces`}
              </MartText>
              <MartText variant="display">{kes(total)}</MartText>
            </View>
            {diff !== null ? (
              <View style={[styles.diffPill, { backgroundColor: diff === 0 ? MART.successSurface : diff > 0 ? MART.warningSurface : MART.dangerSurface }]}>
                <Ionicons
                  name={diff === 0 ? 'checkmark-circle' : diff > 0 ? 'arrow-up-circle' : 'arrow-down-circle'}
                  size={16}
                  color={diff === 0 ? MART.success : diff > 0 ? MART.warning : MART.danger}
                />
                <MartText variant="label" color={diff === 0 ? MART.success : diff > 0 ? MART.warning : MART.danger}>
                  {diff === 0 ? 'Matches expected' : diff > 0 ? `${kes(diff)} over` : `${kes(-diff)} short`}
                </MartText>
              </View>
            ) : null}
            <Pressable onPress={() => onDone(total)} style={styles.doneBtn} accessibilityRole="button">
              <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
                {mode === 'open' ? 'Open with this float' : 'Use this count'}
              </MartText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,29,27,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: MART.paper,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '88%',
    paddingBottom: SPACE.sm,
  },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: RADIUS.pill, backgroundColor: MART.border, marginTop: SPACE.sm },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.sm,
  },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: GUTTER },
  group: { marginTop: SPACE.md, marginBottom: SPACE.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MART.border,
  },
  chip: { width: 64, paddingVertical: SPACE.sm, borderRadius: RADIUS.md, alignItems: 'center' },
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
  },
  step: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperElevated,
  },
  countInput: {
    minWidth: 44,
    textAlign: 'center',
    fontSize: 18,
    color: MART.ink,
    paddingVertical: SPACE.xs,
  },
  lineTotal: { minWidth: 86, textAlign: 'right' },
  summary: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: MART.border,
    gap: SPACE.sm,
    backgroundColor: MART.paperElevated,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  diffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    alignSelf: 'flex-start',
    paddingVertical: SPACE.xs,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
  },
  doneBtn: {
    minHeight: 54,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACE.xs,
  },
});
