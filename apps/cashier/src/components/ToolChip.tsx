import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HAIRLINE, MART, MartText, PressableScale, RADIUS, SPACE, onFill } from '@kiosk/staff';
import { TABULAR_NUMS } from './CashierPrimitives';

/**
 * A compact, icon-led action in the till's tool row — Add product, Web orders, Services. One shape,
 * one vocabulary: a hairline-edged capsule on the paper, its icon in the brand green, that dims when
 * the shop is out of reach. A small count rides the corner when there is work waiting (web orders).
 */
export function ToolChip({
  icon,
  label,
  badge,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.97}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} waiting` : label}
      style={[styles.chip, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={15} color={MART.fallbackPrimary} />
      <MartText variant="label" numberOfLines={1} color={MART.ink}>
        {label}
      </MartText>
      {badge ? (
        <View style={styles.badge}>
          <MartText variant="shelf" color={onFill(MART.fallbackPrimary).primary} style={TABULAR_NUMS}>
            {badge > 9 ? '9+' : `${badge}`}
          </MartText>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    minHeight: 36,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    ...HAIRLINE,
    backgroundColor: MART.paperElevated,
  },
  disabled: { opacity: 0.45 },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
