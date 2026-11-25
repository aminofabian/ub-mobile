import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MART, RADIUS, SPACE, tint, MartText, onFill } from '@kiosk/staff';

export type Choice = { id: string; name: string };

type Props = {
  /** Chosen id, or null for none. */
  value: string | null;
  choices: Choice[];
  loading?: boolean;
  /** Shown as the "none" chip, e.g. "No category". Omit to require a choice. */
  noneLabel?: string;
  /** Word for the thing, lowercase, e.g. "category" or "supplier". Used in the add box. */
  noun: string;
  onChange: (id: string | null) => void;
  /** Add a new one and return it; the field selects it. Omit to hide the add action. */
  onCreate?: (name: string) => Promise<Choice>;
};

/**
 * A wrap of selectable chips with an inline "add new" box. Used for the category and supplier on the add-product form,
 * so a cashier can tag a product without leaving the till — and make a new category or supplier on the spot.
 */
export function PickerField({ value, choices, loading, noneLabel, noun, onChange, onCreate }: Props) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const name = text.trim();
    if (!name || !onCreate) return;
    setBusy(true);
    try {
      const made = await onCreate(name);
      onChange(made.id);
      setText('');
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {loading ? (
        <ActivityIndicator color={MART.fallbackPrimary} style={styles.loading} />
      ) : (
        <View style={styles.chips}>
          {noneLabel ? (
            <Chip label={noneLabel} on={value === null} onPress={() => onChange(null)} />
          ) : null}
          {choices.map((c) => (
            <Chip key={c.id} label={c.name} on={value === c.id} onPress={() => onChange(c.id)} />
          ))}
          {onCreate && !adding ? (
            <Pressable onPress={() => setAdding(true)} style={styles.addChip} accessibilityRole="button" accessibilityLabel={`Add a ${noun}`}>
              <Ionicons name="add" size={16} color={MART.fallbackPrimary} />
              <MartText variant="label" color={MART.fallbackPrimary}>
                New {noun}
              </MartText>
            </Pressable>
          ) : null}
        </View>
      )}

      {adding ? (
        <View style={styles.addRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={`New ${noun} name`}
            placeholderTextColor={MART.inkQuiet}
            autoFocus
            style={styles.addInput}
            onSubmitEditing={() => void submit()}
            returnKeyType="done"
          />
          <Pressable onPress={() => void submit()} disabled={busy || !text.trim()} style={[styles.addBtn, (busy || !text.trim()) && styles.dim]}>
            {busy ? (
              <ActivityIndicator color={onFill(MART.fallbackPrimary).primary} />
            ) : (
              <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
                Add
              </MartText>
            )}
          </Pressable>
          <Pressable onPress={() => { setAdding(false); setText(''); }} style={styles.cancelBtn} hitSlop={6}>
            <Ionicons name="close" size={20} color={MART.inkMuted} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.chip, on && styles.chipOn]}
    >
      <MartText variant="label" color={on ? onFill(MART.fallbackPrimary).primary : MART.ink}>
        {label}
      </MartText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  loading: { alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
  },
  chipOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xxs,
    minHeight: 40,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tint(MART.fallbackPrimary, 0.5),
    backgroundColor: tint(MART.fallbackPrimary, 0.06),
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  addInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    fontSize: 15,
    color: MART.ink,
    backgroundColor: MART.paperElevated,
  },
  addBtn: {
    minHeight: 48,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.5 },
});
