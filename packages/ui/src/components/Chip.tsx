import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { theme } from '../theme';
import { FONT, WEIGHT } from '../type';
import { Text } from './Text';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

/** A pill to pick one of a few choices: a filter, a reason, a mode. */
export function Chip({ label, selected = false, onPress, disabled, style }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      style={[styles.chip, selected && styles.selected, disabled && styles.disabled, style]}
    >
      <Text variant="caption" style={selected ? styles.labelSelected : styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surface,
  },
  selected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  disabled: { opacity: 0.5 },
  label: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium },
  labelSelected: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium, color: '#fffdf6' },
});
