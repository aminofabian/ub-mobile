import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MART, RADIUS, SPACE, TYPE } from '../theme/mart';
import type { StoreCardView } from '../lib/store-card';
import { PressScale } from './Capsule';
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
    <PressScale
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${card.address}${current ? ', open now' : ''}`}
      accessibilityHint={hint}
      accessibilityState={{ busy, disabled: busy || disabled, selected: current }}
      style={[styles.row, (dimmed || (disabled && !busy)) && styles.dimmed]}
    >
      <StoreAvatar card={card} size={48} />
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>
          {card.name}
        </Text>
        <Text numberOfLines={1} style={styles.address}>
          {current ? `Open now · ${card.address}` : card.address}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={MART.ink} />
      ) : current ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={18} color={MART.paper} />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={MART.ink} />
      )}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 72,
    paddingLeft: SPACE.md,
    paddingRight: SPACE.lg,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
  },
  dimmed: {
    opacity: 0.5,
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
    color: MART.inkQuiet,
  },
  check: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.ink,
  },
});
