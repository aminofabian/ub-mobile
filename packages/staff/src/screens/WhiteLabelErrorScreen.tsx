import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text, theme } from '@kiosk/ui';
import { getTenantDisplayName } from '@kiosk/core';

interface WhiteLabelErrorScreenProps {
  message: string;
  onRetry: () => void;
}

export function WhiteLabelErrorScreen({ message, onRetry }: WhiteLabelErrorScreenProps) {
  const displayName = getTenantDisplayName();

  return (
    <View style={styles.container}>
      <Text variant="h1">{displayName ?? 'Store unavailable'}</Text>
      <Text variant="body" style={styles.message}>
        {message}
      </Text>
      <Button title="Try again" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  message: {
    marginVertical: theme.spacing.lg,
    color: theme.colors.textMuted,
  },
});
