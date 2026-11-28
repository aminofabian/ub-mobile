import React from 'react';
import { Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';
import { theme } from '../theme';
import { FONT, WEIGHT } from '../type';

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
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
  },
  h1: {
    fontFamily: FONT.bold,
    fontWeight: WEIGHT.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
    marginBottom: theme.spacing.md,
  },
  h2: {
    fontFamily: FONT.semibold,
    fontWeight: WEIGHT.semibold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
    marginBottom: theme.spacing.sm,
  },
  body: {
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  caption: {
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  muted: {
    fontFamily: FONT.regular,
    fontWeight: WEIGHT.regular,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textMuted,
  },
});
