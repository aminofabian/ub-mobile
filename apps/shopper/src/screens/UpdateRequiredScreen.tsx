import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { UpdateState } from '@kiosk/core';
import { StateBlock } from '../components/StateBlock';
import { MART, SPACE } from '../theme/mart';

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
  const next = update.storeUrl ? 'Update it, then open the app again.' : `Open ${store} and update ${appName}.`;

  return (
    <View style={[styles.shell, { paddingTop: insets.top, paddingBottom: insets.bottom + SPACE.xl }]}>
      <StateBlock
        tone="note"
        icon="cloud-download"
        title="Please update to continue"
        body={`${reason} ${next}`}
        actionLabel={update.storeUrl ? 'Update' : undefined}
        onAction={
          update.storeUrl
            ? () => void Linking.openURL(update.storeUrl as string).catch(() => undefined)
            : undefined
        }
        style={styles.block}
      />
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: MART.paper,
  },
  block: {
    paddingTop: 0,
  },
});
