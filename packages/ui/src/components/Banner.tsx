import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { theme } from '../theme';
import { Text } from './Text';

export type BannerTone = 'info' | 'warn' | 'danger' | 'ok';

interface BannerProps {
  tone?: BannerTone;
  children: React.ReactNode;
  style?: ViewStyle;
}

const TONES: Record<BannerTone, { background: string; border: string; text: string }> = {
  info: { background: '#cfe8ff', border: '#aed4fb', text: '#0b5cab' },
  warn: { background: '#fbf3a0', border: '#f3e67a', text: '#7a5a00' },
  danger: { background: '#ffd5cd', border: '#f7b6aa', text: '#a8281b' },
  ok: { background: '#d9f0c6', border: '#bfe3a4', text: '#2f6b12' },
};

/** A short message above the content: something the person should know, or must do something about. */
export function Banner({ tone = 'info', children, style }: BannerProps) {
  const colors = TONES[tone];
  return (
    <View
      accessibilityRole={tone === 'warn' || tone === 'danger' ? 'alert' : undefined}
      style={[styles.box, { backgroundColor: colors.background, borderColor: colors.border }, style]}
    >
      {typeof children === 'string' ? (
        <Text variant="caption" style={{ color: colors.text }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
});
