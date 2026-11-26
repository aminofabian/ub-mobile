import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Gloss, MartText, FONT, MART, RADIUS, SHADOW, SPACE, WEIGHT, SpoilsScreen } from '@kiosk/staff';
import { useGrocerySession } from '../lib/session';

/** The list of stock to write off, the same screen the Stock app has. Only for someone the shop lets do it. */
export function SpoilsRoute() {
  const { api, tenantId, branchId, userId, modes, renderScanner } = useGrocerySession();
  if (!modes.includes('spoils')) {
    return (
      <View style={styles.fill}>
        <Gloss />
        <View style={styles.card}>
          <MartText variant="title" style={styles.title}>
            Write-off not available
          </MartText>
          <MartText variant="meta" color={MART.inkQuiet} style={styles.copy}>
            Writing stock off is not switched on for you at this shop. Ask the owner if you need to record spoils.
          </MartText>
        </View>
      </View>
    );
  }
  return (
    <SpoilsScreen
      api={api}
      tenantId={tenantId}
      branchId={branchId}
      ownerId={userId}
      {...(renderScanner ? { renderScanner } : {})}
    />
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper, padding: SPACE.md },
  card: {
    marginTop: SPACE.xl,
    padding: SPACE.xl,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    gap: SPACE.sm,
    ...SHADOW.card,
  },
  title: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  copy: { maxWidth: 320 },
});
