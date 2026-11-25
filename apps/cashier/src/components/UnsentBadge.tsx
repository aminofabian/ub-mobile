import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FONT, MART, PressableScale, RADIUS, SPACE, tint } from '@kiosk/staff';
import { useUnsentSales } from '../hooks/useUnsentSales';
import type { CashierStackParamList } from '../navigation/AppNavigator';

/**
 * Shown in the header of every screen while sales are waiting on this phone, and gone when there are none.
 * It turns amber when a sale needs a person, and opens the list.
 */
export function UnsentBadge() {
  const navigation = useNavigation<NativeStackNavigationProp<CashierStackParamList>>();
  const { total, needsAttention } = useUnsentSales();
  if (total === 0) {
    return null;
  }
  const stuck = needsAttention > 0;
  const label = stuck ? `${needsAttention} ${needsAttention === 1 ? 'needs' : 'need'} attention` : `${total} unsent`;
  const spoken = `${total} ${total === 1 ? 'sale has' : 'sales have'} not been sent${
    stuck ? `, ${needsAttention} of them ${needsAttention === 1 ? 'needs' : 'need'} attention` : ''
  }. Open unsent sales.`;
  return (
    <PressableScale
      onPress={() => navigation.navigate('Conflicts')}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      style={[styles.pill, stuck ? styles.stuck : styles.waiting]}
    >
      <Text style={[styles.text, stuck ? styles.stuckText : styles.waitingText]}>{label}</Text>
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
    borderWidth: 1,
  },
  waiting: { backgroundColor: MART.paperElevated, borderColor: MART.borderStrong },
  stuck: { backgroundColor: MART.warningSurface, borderColor: tint(MART.warning, 0.3) },
  text: { fontSize: 12, fontFamily: FONT.semibold },
  waitingText: { color: MART.ink },
  stuckText: { color: MART.warning },
});
