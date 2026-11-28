import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { theme } from '../theme';
import { FONT, WEIGHT } from '../type';
import { Text } from './Text';

interface RowProps {
  title: string;
  subtitle?: string;
  /** What sits at the right edge: a quantity, a price, a status. */
  right?: string;
  rightTone?: 'normal' | 'warn' | 'danger' | 'ok';
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

const TONES = { normal: theme.colors.text, warn: theme.colors.warning, danger: theme.colors.danger, ok: theme.colors.success } as const;

/** One line of a list: a title, a smaller line under it, and a figure at the right. Tappable when it has `onPress`. */
export function Row({ title, subtitle, right, rightTone = 'normal', onPress, disabled, style }: RowProps) {
  const body = (
    <>
      <View style={styles.left}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <Text style={{ ...styles.right, color: TONES[rightTone] }}>{right}</Text> : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, style]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled, style]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  pressed: { backgroundColor: theme.colors.surfaceSunken },
  disabled: { opacity: 0.5 },
  left: { flex: 1, paddingRight: theme.spacing.sm },
  title: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold, fontSize: 15, letterSpacing: -0.2 },
  right: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold, fontSize: 15, letterSpacing: -0.2 },
});
