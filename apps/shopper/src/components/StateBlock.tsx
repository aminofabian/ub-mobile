import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { GUTTER, MART, SPACE, TYPE, ZONE } from '../theme/mart';
import { Capsule } from './Capsule';
import { Lobe } from './Coast';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TONE = {
  /** Nothing here yet. */
  empty: { zone: ZONE.sun, shape: 0 },
  /** It did not load or did not go through. */
  problem: { zone: ZONE.coral, shape: 1 },
  /** Something the shopper should know. */
  note: { zone: ZONE.pond, shape: 2 },
  /** It worked. */
  done: { zone: ZONE.leaf, shape: 3 },
} as const;

/**
 * What a screen shows when it has nothing, cannot load, or has finished: a lobe with a mark, what
 * happened in a few heavy words, what to do about it, and at most one action.
 */
export function StateBlock({
  tone = 'empty',
  icon,
  title,
  body,
  actionLabel,
  onAction,
  actionChip = 'arrow-forward',
  fill,
  style,
}: {
  tone?: keyof typeof TONE;
  icon: IconName;
  title: string;
  body?: string | null;
  actionLabel?: string;
  onAction?: () => void;
  actionChip?: IconName;
  /** The shop's colour, for the action. */
  fill?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const look = TONE[tone];
  return (
    <View style={[styles.block, style]}>
      <Lobe color={look.zone} size={96} shape={look.shape} style={styles.lobe}>
        <Ionicons name={icon} size={38} color={MART.ink} />
      </Lobe>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Capsule
          label={actionLabel}
          chip={actionChip}
          size="md"
          fill={fill}
          stretch={false}
          onPress={onAction}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xxl,
  },
  lobe: {
    marginLeft: -SPACE.sm,
  },
  title: {
    ...TYPE.display,
    marginTop: SPACE.xl,
    color: MART.ink,
  },
  body: {
    ...TYPE.body,
    marginTop: SPACE.md,
    maxWidth: 340,
    color: MART.inkMuted,
  },
  action: {
    marginTop: SPACE.xxl,
  },
});
