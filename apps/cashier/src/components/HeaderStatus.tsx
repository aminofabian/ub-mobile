import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SPACE } from '@kiosk/staff';
import { ConnectionPill } from './ConnectionPill';
import { UnsentBadge } from './UnsentBadge';
import { useReach } from '../store/reach-store';
import { useUnsentSales } from '../hooks/useUnsentSales';

/**
 * The right of every header: whether the line to the shop is down, and how many sales are waiting on
 * the phone. When both are quiet it renders nothing at all — no empty placeholder sitting in the
 * header corner.
 */
export function HeaderStatus({ look }: { look: () => Promise<boolean> }) {
  const offline = useReach((state) => state.offline);
  const { total } = useUnsentSales();
  if (!offline && total === 0) return null;
  return (
    <View style={styles.row}>
      <ConnectionPill look={look} />
      <UnsentBadge />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingRight: SPACE.sm },
});
