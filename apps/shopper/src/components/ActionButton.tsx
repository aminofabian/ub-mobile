import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { MART, ON_BRAND, RADIUS, TYPE } from '../theme/mart';

/** The two buttons the shop picker and its sheets use: one main action, and a quieter alternative. */
export function ActionButton({
  label,
  onPress,
  kind = 'primary',
  busy = false,
  disabled = false,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'quiet';
  busy?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  const inactive = disabled || busy;
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.quiet,
        disabled && styles.disabled,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={primary ? ON_BRAND.primary : MART.fallbackPrimary} />
      ) : (
        <Text style={[styles.label, primary ? styles.primaryLabel : styles.quietLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: MART.fallbackPrimary,
  },
  quiet: {
    borderWidth: 1,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.88,
  },
  label: {
    ...TYPE.heading,
  },
  primaryLabel: {
    color: ON_BRAND.primary,
  },
  quietLabel: {
    color: MART.ink,
  },
});
