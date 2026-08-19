import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GUTTER, MART, SPACE, TYPE } from '../theme/mart';

/**
 * One heading treatment for every list and rail, so stacked sections read as
 * an ordered page instead of a pile. More air above the title than below it.
 */
export function SectionHead({
  title,
  hint,
  actionLabel,
  onAction,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {hint ? (
          <Text numberOfLines={1} style={styles.hint}>
            {hint}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={MART.inkMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: SPACE.xxl,
    marginBottom: SPACE.md,
    paddingHorizontal: GUTTER,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACE.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...TYPE.heading,
    color: MART.ink,
  },
  hint: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xxs,
    minHeight: 32,
  },
  actionLabel: {
    ...TYPE.label,
    color: MART.inkMuted,
  },
  pressed: {
    opacity: 0.6,
  },
});
