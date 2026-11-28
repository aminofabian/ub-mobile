import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GUTTER, MART, RADIUS, SPACE, TYPE, ZONE } from '../theme/mart';
import { PressScale } from './Capsule';
import { Lobe } from './Coast';

type Service = {
  key: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint: string;
  zone: string;
  shape: number;
  onPress: () => void;
};

/**
 * The over-the-counter errands: airtime and power tokens. They sit in the page next to the shopping,
 * side by side when the shop offers both.
 */
export function CounterServices({
  airtimeAvailable,
  showPowerTokens = true,
  onAirtime,
  onTokens,
  flush = false,
}: {
  airtimeAvailable: boolean;
  /** Off only when the server says the shop does not sell power tokens (plan §5.6). */
  showPowerTokens?: boolean;
  /** Kept so callers written for the old tiles still compile. Errands take zone colours now. */
  primary?: string;
  accent?: string;
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
      zone: ZONE.pond,
      shape: 1,
      onPress: onAirtime,
    });
  }
  if (showPowerTokens) {
    services.push({
      key: 'tokens',
      icon: 'flash',
      label: 'Power tokens',
      hint: 'KPLC balance',
      zone: ZONE.lilac,
      shape: 3,
      onPress: onTokens,
    });
  }
  if (services.length === 0) {
    return null;
  }

  return (
    <View style={[styles.row, flush && styles.rowFlush]}>
      {services.map((service) => (
        <View key={service.key} style={styles.cell}>
          <PressScale
            onPress={service.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${service.label}. ${service.hint}`}
            style={styles.tile}
          >
            <Lobe color={service.zone} size={44} shape={service.shape}>
              <Ionicons name={service.icon} size={20} color={MART.ink} />
            </Lobe>
            <View style={styles.copy}>
              <Text numberOfLines={1} style={styles.label}>
                {service.label}
              </Text>
              <Text numberOfLines={1} style={styles.hint}>
                {service.hint}
              </Text>
            </View>
            {services.length === 1 ? (
              <Ionicons name="chevron-forward" size={18} color={MART.ink} />
            ) : null}
          </PressScale>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: GUTTER,
    gap: SPACE.sm,
  },
  rowFlush: {
    paddingHorizontal: 0,
  },
  cell: {
    flex: 1,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 68,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    ...TYPE.label,
    color: MART.ink,
  },
  hint: {
    ...TYPE.meta,
    color: MART.inkQuiet,
  },
});
