import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MART, MartText, PressableScale, RADIUS, SPACE, tint } from '@kiosk/staff';
import { boundNotes } from '../lib/notes';

interface NoticeBarProps {
  notes: readonly string[];
  tone?: 'info' | 'warning';
  /** One thing the cashier can do about what the notice says. */
  action?: { label: string; onPress: () => void };
  onDismiss: () => void;
}

/** Tells the cashier what happened, in a line or two, until they have seen it. Draws nothing when there is nothing to say. */
export function NoticeBar({ notes, tone = 'info', action, onDismiss }: NoticeBarProps) {
  if (notes.length === 0) return null;
  const shown = boundNotes(notes);
  const warn = tone === 'warning';
  return (
    <View style={[styles.bar, warn ? styles.warning : styles.info]} accessibilityRole="alert">
      <View style={styles.body}>
        <Ionicons
          name={warn ? 'alert-circle-outline' : 'information-circle-outline'}
          size={18}
          color={warn ? MART.warning : MART.fallbackPrimary}
          style={styles.icon}
        />
        <View style={styles.words}>
          {shown.map((note, index) => (
            <MartText key={`${index}:${note}`} variant="meta" color={MART.ink}>
              {note}
            </MartText>
          ))}
        </View>
      </View>
      <View style={styles.actions}>
        {action ? (
          <PressableScale
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={styles.actionBtn}
          >
            <MartText variant="label" color={MART.fallbackPrimary}>
              {action.label}
            </MartText>
          </PressableScale>
        ) : null}
        <PressableScale
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="OK"
          style={styles.okBtn}
        >
          <MartText variant="label" color={MART.ink}>
            OK
          </MartText>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: SPACE.md,
    marginBottom: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACE.sm,
  },
  info: { backgroundColor: MART.paperElevated, borderColor: MART.border },
  warning: { backgroundColor: MART.warningSurface, borderColor: tint(MART.warning, 0.32) },
  body: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  icon: { marginTop: 1 },
  words: { flex: 1, gap: SPACE.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACE.sm },
  actionBtn: {
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: tint(MART.fallbackPrimary, 0.35),
    backgroundColor: MART.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okBtn: {
    minHeight: 44,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
