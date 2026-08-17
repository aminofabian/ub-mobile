import React from 'react';
import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { theme } from '../theme';

interface KioskTextProps extends TextProps {
  variant?: 'h1' | 'h2' | 'body' | 'caption' | 'muted';
  style?: TextStyle;
}

export function Text({ variant = 'body', style, ...props }: KioskTextProps) {
  return <RNText style={[styles.base, styles[variant], style]} {...props} />;
}

const styles = StyleSheet.create({
  base: {
    color: theme.colors.text,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: theme.spacing.md,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
  },
  muted: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
});
