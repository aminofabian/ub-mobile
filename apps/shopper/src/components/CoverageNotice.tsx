import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TenantContext } from '@kiosk/core';
import { coverageLimits, shopWebUrl } from '../lib/coverage';
import { GUTTER, MART, RADIUS, SPACE, TYPE } from '../theme/mart';

/**
 * On the shop's home page: what the shop does that this app does not, in plain words, with a way to the
 * shop's website. It draws nothing unless the server has said the shop runs tables, bookings, rooms,
 * prescriptions or a clinic, so a shop that sells goods looks as it always did.
 */
export function CoverageNotice({ tenant }: { tenant: TenantContext }) {
  const limits = coverageLimits(tenant);
  if (limits.length === 0) {
    return null;
  }
  const webUrl = shopWebUrl(tenant.host);

  return (
    <View style={styles.box} accessibilityRole="summary">
      <Text style={styles.head}>What this app covers</Text>
      {limits.map((line) => (
        <View key={line} style={styles.line}>
          <Ionicons name="information-circle-outline" size={16} color={MART.info} style={styles.icon} />
          <Text style={styles.text}>{line}</Text>
        </View>
      ))}
      {webUrl ? (
        <Pressable
          onPress={() => void Linking.openURL(webUrl).catch(() => undefined)}
          accessibilityRole="link"
          accessibilityLabel={`Open ${tenant.host} in your browser`}
          style={styles.link}
        >
          <Text style={styles.linkText}>Open {tenant.host} in your browser</Text>
          <Ionicons name="open-outline" size={14} color={MART.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: GUTTER,
    marginTop: SPACE.lg,
    padding: SPACE.lg,
    gap: SPACE.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.infoSurface,
  },
  head: {
    ...TYPE.heading,
    color: MART.ink,
  },
  line: {
    flexDirection: 'row',
    gap: SPACE.sm,
  },
  icon: {
    marginTop: 3,
  },
  text: {
    ...TYPE.body,
    flex: 1,
    color: MART.ink,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    minHeight: 44,
  },
  linkText: {
    ...TYPE.label,
    color: MART.ink,
    textDecorationLine: 'underline',
  },
});
