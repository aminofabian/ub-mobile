import React from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { FONT, MART, PressableScale, RADIUS, SPACE, tint, WEIGHT } from '@kiosk/staff';
import { OFFLINE_NOTE, OFFLINE_PILL, STILL_OFFLINE, TRY_AGAIN } from '../lib/offline-words';
import { useReach } from '../store/reach-store';

/**
 * Shown in the header while the till believes it cannot reach the shop, and gone the moment it can. Pressing it says
 * what that means for the sale in front of the cashier, and offers to look for the shop again right away.
 */
export function ConnectionPill({ look }: { look: () => Promise<boolean> }) {
  const offline = useReach((state) => state.offline);
  if (!offline) return null;
  const ask = () =>
    Alert.alert(OFFLINE_PILL, OFFLINE_NOTE, [
      { text: 'OK', style: 'cancel' },
      {
        text: TRY_AGAIN,
        onPress: () => {
          void look().then((answered) => {
            if (!answered) Alert.alert(STILL_OFFLINE);
          });
        },
      },
    ]);
  return (
    <PressableScale
      onPress={ask}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${OFFLINE_PILL}. ${OFFLINE_NOTE} Press for options.`}
      style={styles.pill}
    >
      <Text style={styles.text}>{OFFLINE_PILL}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: SPACE.xs,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    minHeight: 34,
    justifyContent: 'center',
    backgroundColor: MART.warningSurface,
    borderWidth: 1,
    borderColor: tint(MART.warning, 0.3),
  },
  text: { fontSize: 12, fontFamily: FONT.semibold,
 fontWeight: WEIGHT.semibold, color: MART.warning },
});
