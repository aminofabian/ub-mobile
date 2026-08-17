import React, { useEffect } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Text, theme } from '@kiosk/ui';

interface AuthBackBarProps {
  onBack?: () => void;
  backLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
}

export function AuthBackBar({
  onBack,
  backLabel = 'Back',
  onSecondary,
  secondaryLabel,
}: AuthBackBarProps) {
  useEffect(() => {
    if (!onBack) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  if (!onBack && !onSecondary) {
    return <View style={styles.spacer} />;
  }

  return (
    <View style={styles.bar}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          hitSlop={8}
          style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
        >
          <Text style={styles.label}>{backLabel}</Text>
        </Pressable>
      ) : (
        <View />
      )}
      {onSecondary && secondaryLabel ? (
        <Pressable
          onPress={onSecondary}
          accessibilityRole="button"
          accessibilityLabel={secondaryLabel}
          hitSlop={8}
          style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
        >
          <Text style={styles.secondary}>{secondaryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  spacer: {
    height: Platform.OS === 'android' ? StatusBar.currentHeight ?? 16 : 48,
  },
  bar: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 12) + 8 : 52,
    paddingBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  hit: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingRight: theme.spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryDark,
  },
  secondary: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primaryDark,
  },
});
