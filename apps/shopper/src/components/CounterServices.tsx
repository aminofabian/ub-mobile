import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ELEVATION, GUTTER, MART, RADIUS, SPACE, TYPE, tint } from '../theme/mart';

type Service = {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint: string;
  color: string;
  onPress: () => void;
};

/**
 * The over-the-counter errands: airtime and power tokens. These used to float
 * over the catalogue as a pill; they belong in the page, next to the shopping.
 */
export function CounterServices({
  airtimeAvailable,
  showPowerTokens = true,
  primary,
  accent,
  onAirtime,
  onTokens,
  flush = false,
}: {
  airtimeAvailable: boolean;
  /** Off only when the server says the shop does not sell power tokens (plan §5.6). */
  showPowerTokens?: boolean;
  primary: string;
  accent: string;
  onAirtime: () => void;
  onTokens: () => void;
  /** Skip page gutter when the parent already pads. */
  flush?: boolean;
}) {
  const services: Service[] = [];
  if (airtimeAvailable) {
    services.push({
      key: 'airtime',
      icon: 'cellular',
      label: 'Airtime',
      hint: 'Top up any line',
      color: accent,
      onPress: onAirtime,
    });
  }
  if (showPowerTokens) {
    services.push({
      key: 'tokens',
      icon: 'flash',
      label: 'Power tokens',
      hint: 'KPLC balance',
      color: primary,
      onPress: onTokens,
    });
  }
  if (services.length === 0) {
    return null;
  }

  return (
    <View style={[styles.row, flush && styles.rowFlush]}>
      {services.map((service) => (
        <Pressable
          key={service.key}
          onPress={service.onPress}
          accessibilityRole="button"
          accessibilityLabel={`${service.label} — ${service.hint}`}
          style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
        >
          <View style={[styles.icon, { backgroundColor: tint(service.color, 0.1) }]}>
            <Ionicons name={service.icon} size={18} color={service.color} />
          </View>
          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.label}>
              {service.label}
            </Text>
            <Text numberOfLines={1} style={styles.hint}>
              {service.hint}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={MART.inkQuiet} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: GUTTER,
    gap: SPACE.sm,
  },
  rowFlush: {
    paddingHorizontal: 0,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 60,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
  },
  pressed: {
    backgroundColor: MART.paperSunken,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...TYPE.label,
    fontSize: 14,
    fontWeight: '700',
    color: MART.ink,
  },
  hint: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
});
