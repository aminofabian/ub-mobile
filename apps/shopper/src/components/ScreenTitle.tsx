import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GUTTER, MART, SPACE, TYPE } from '../theme/mart';

/**
 * The large title a top-level screen opens with (Search, Basket, Account). Pushed screens use the
 * native stack header instead, so the back gesture and title stay the platform's own.
 */
export function ScreenTitle({
  title,
  hint,
  trailing,
  color = MART.ink,
  hintColor = MART.inkMuted,
  safeTop = true,
}: {
  title: string;
  hint?: string | null;
  trailing?: React.ReactNode;
  color?: string;
  hintColor?: string;
  /** Leave room for the status bar. Off when a parent already has. */
  safeTop?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { paddingTop: (safeTop ? insets.top : 0) + SPACE.md }]}>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.title, { color }]}>
          {title}
        </Text>
        {hint ? (
          <Text numberOfLines={2} style={[styles.hint, { color: hintColor }]}>
            {hint}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACE.md,
    paddingHorizontal: GUTTER,
    paddingBottom: SPACE.lg,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...TYPE.display,
  },
  hint: {
    ...TYPE.body,
    marginTop: SPACE.xs,
  },
});
