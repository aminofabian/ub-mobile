import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTenantDisplayName } from '@kiosk/core';
import { MART, RADIUS, SPACE, tint } from '../theme/mart';
import { MartButton, MartText, Screen } from '../theme/mart-ui';
import { Entrance } from '../theme/Entrance';

interface WhiteLabelErrorScreenProps {
  message: string;
  onRetry: () => void;
}

export function WhiteLabelErrorScreen({ message, onRetry }: WhiteLabelErrorScreenProps) {
  const displayName = getTenantDisplayName();

  return (
    <Screen>
      <View style={styles.content}>
        <Entrance delay={0} style={styles.card}>
          <View style={[styles.badge, { backgroundColor: tint(MART.danger, 0.12) }]}>
            <Ionicons name="cloud-offline-outline" size={30} color={MART.danger} />
          </View>
          <MartText variant="title" accessibilityRole="header" style={styles.title}>
            {displayName ?? 'Store unavailable'}
          </MartText>
          <MartText variant="body" color={MART.inkMuted} style={styles.message}>
            {message}
          </MartText>
          <MartButton label="Try again" onPress={onRetry} style={styles.retry} />
        </Entrance>

        <View style={styles.footerMark}>
          <View style={[styles.footerDot, { backgroundColor: MART.fallbackPrimary }]} />
          <MartText variant="shelf" color={MART.inkQuiet}>
            POWERED BY KIOSK
          </MartText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
    gap: SPACE.xxl,
  },
  card: {
    alignItems: 'center',
    gap: SPACE.lg,
    padding: SPACE.xxl,
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    shadowColor: MART.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center' },
  message: { textAlign: 'center' },
  retry: { alignSelf: 'stretch', marginTop: SPACE.sm },
  footerMark: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm },
  footerDot: { width: 10, height: 10, borderRadius: 999 },
});
