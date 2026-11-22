import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '@kiosk/ui';
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
    <TouchableOpacity
      onPress={() => navigation.navigate('Conflicts')}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      style={[styles.pill, stuck ? styles.stuck : styles.waiting]}
    >
      <Text style={[styles.text, stuck ? styles.stuckText : styles.waitingText]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
    minHeight: 32,
    justifyContent: 'center',
  },
  waiting: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  stuck: { backgroundColor: theme.colors.warning },
  text: { fontSize: 13, fontWeight: '600' },
  waitingText: { color: theme.colors.text },
  stuckText: { color: '#212529' },
});
