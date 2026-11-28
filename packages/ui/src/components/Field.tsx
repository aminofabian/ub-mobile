import React, { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { theme } from '../theme';
import { FONT, WEIGHT } from '../type';
import { Text } from './Text';

interface FieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  /** What is wrong with what was typed, in words. Shown under the box, and the box turns red. */
  error?: string | null;
  hint?: string;
  style?: ViewStyle;
}

/** A box to type in, with its label above and what is wrong with it below. On focus it lifts and its edge brightens. */
export function Field({ label, error, hint, style, onFocus, onBlur, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text variant="caption" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        autoCorrect={false}
        accessibilityLabel={label ?? input.placeholder}
        {...input}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && !error ? styles.inputFocused : null, error ? styles.inputError : null]}
      />
      {error ? (
        <Text variant="caption" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="muted">{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: theme.spacing.sm },
  label: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium, marginBottom: theme.spacing.xs },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    fontFamily: FONT.regular, fontWeight: WEIGHT.regular,
    fontSize: 15,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  // Active: the edge brightens to the brand green and the box lifts with a faint green-tinted ring.
  inputFocused: {
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 2,
  },
  inputError: { borderColor: theme.colors.danger },
  error: { color: theme.colors.danger, marginTop: theme.spacing.xs },
});
