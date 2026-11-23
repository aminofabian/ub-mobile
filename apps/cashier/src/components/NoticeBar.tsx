import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, theme } from '@kiosk/ui';

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
  return (
    <View style={[styles.bar, tone === 'warning' ? styles.warning : styles.info]} accessibilityRole="alert">
      <View style={styles.words}>
        {notes.map((note, index) => (
          <Text key={`${index}:${note}`} variant="caption">
            {note}
          </Text>
        ))}
      </View>
      <View style={styles.actions}>
        {action ? <Button title={action.label} variant="secondary" onPress={action.onPress} style={styles.action} /> : null}
        <Button title="OK" variant="secondary" onPress={onDismiss} style={styles.action} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    gap: theme.spacing.sm,
  },
  info: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  warning: { backgroundColor: '#fff8e1', borderColor: theme.colors.warning },
  words: { gap: theme.spacing.xs },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm },
  action: { minHeight: 40, paddingVertical: theme.spacing.sm },
});
