import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MART, RADIUS, SPACE, TYPE } from '../theme/mart';
import type { StoreCardView } from '../lib/store-card';
import { StoreAvatar } from './StoreAvatar';

/** One shop in a list: a search result, a recent shop, a shop in the switcher. */
export function StoreRow({
  card,
  onPress,
  busy = false,
  disabled = false,
  current = false,
  dimmed = false,
  hint,
}: {
  card: StoreCardView;
  onPress: () => void;
  busy?: boolean;
  /** Another shop is being opened, so this one cannot be started now. It looks it. */
  disabled?: boolean;
  /** The shop that is open now. It is marked, and tapping it just closes the list. */
  current?: boolean;
  dimmed?: boolean;
  hint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${card.address}${current ? ', open now' : ''}`}
      accessibilityHint={hint}
      accessibilityState={{ busy, disabled: busy || disabled, selected: current }}
      style={({ pressed }) => [
        styles.row,
        current && styles.rowCurrent,
        (dimmed || (disabled && !busy)) && styles.dimmed,
        pressed && styles.pressed,
      ]}
    >
      <StoreAvatar card={card} size={44} />
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>
          {card.name}
        </Text>
        <Text numberOfLines={1} style={styles.address}>
          {card.address}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={MART.inkQuiet} />
      ) : current ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>OPEN NOW</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={MART.inkQuiet} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 68,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  rowCurrent: {
    borderColor: MART.fallbackPrimary,
  },
  dimmed: {
    opacity: 0.55,
  },
  pressed: {
    backgroundColor: MART.paperSunken,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...TYPE.heading,
    color: MART.ink,
  },
  address: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
  badge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xxs,
    borderRadius: RADIUS.sm,
    backgroundColor: MART.successSurface,
  },
  badgeText: {
    ...TYPE.shelf,
    color: MART.success,
  },
});
