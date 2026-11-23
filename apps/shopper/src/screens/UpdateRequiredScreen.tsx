import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { UpdateState } from '@kiosk/core';
import { ActionButton } from '../components/ActionButton';
import { MART, RADIUS, SPACE, TYPE } from '../theme/mart';

/**
 * Shown instead of the app when the platform says this version must be updated (plan §5.12.2). The
 * Shopper holds no queued work, so nothing is left unsaved by stopping here.
 */
export function UpdateRequiredScreen({
  update,
  appName,
}: {
  update: Extract<UpdateState, { required: true }>;
  appName: string;
}) {
  const insets = useSafeAreaInsets();
  const store = Platform.OS === 'ios' ? 'the App Store' : 'Google Play';
  const reason =
    update.reason === 'blocked'
      ? `This version of ${appName} has a problem that a newer version fixes.`
      : `This version of ${appName} is too old to keep working.`;

  return (
    <View style={[styles.shell, { paddingTop: insets.top + SPACE.xxxl, paddingBottom: insets.bottom + SPACE.xl }]}>
      <View style={styles.icon}>
        <Ionicons name="arrow-up-circle-outline" size={26} color={MART.inkMuted} />
      </View>
      <Text style={styles.title}>Please update to continue</Text>
      <Text style={styles.body}>{reason}</Text>
      <Text style={styles.body}>
        {update.storeUrl ? 'Update it, then open the app again.' : `Open ${store} and update ${appName}.`}
      </Text>
      {update.storeUrl ? (
        <View style={styles.actions}>
          <ActionButton label="Update" onPress={() => void Linking.openURL(update.storeUrl as string).catch(() => undefined)} />
        </View>
      ) : null}
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
    backgroundColor: MART.paper,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperSunken,
    marginBottom: SPACE.lg,
  },
  title: {
    ...TYPE.display,
    color: MART.ink,
  },
  body: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: MART.inkMuted,
  },
  actions: {
    marginTop: SPACE.xl,
  },
});
