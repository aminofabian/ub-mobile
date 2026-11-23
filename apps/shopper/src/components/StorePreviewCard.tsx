import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StoreSnapshot } from '@kiosk/core';
import { TENANT_HOST_SUFFIX } from '../lib/config';
import { coverageLimits, shopWebUrl } from '../lib/coverage';
import { cardFromStore } from '../lib/store-card';
import { ELEVATION, MART, RADIUS, SPACE, TYPE } from '../theme/mart';
import { ActionButton } from './ActionButton';
import { StoreAvatar } from './StoreAvatar';

/**
 * The shop a link, a QR code, a shop code or a tap found, shown before it is opened. Nothing changes until
 * the person presses Open shop (plan §5.7). When the shop does things this app does not, it says so here.
 */
export function StorePreviewCard({
  store,
  onOpen,
  onDismiss,
  busy = false,
  error,
  note,
  openLabel = 'Open shop',
  dismissLabel = 'Not this shop',
}: {
  store: StoreSnapshot;
  onOpen: () => void;
  onDismiss: () => void;
  busy?: boolean;
  error?: string | null;
  /** A line under the details, for example where the basket stays. */
  note?: string;
  openLabel?: string;
  dismissLabel?: string;
}) {
  const card = cardFromStore(store, TENANT_HOST_SUFFIX);
  const limits = coverageLimits(store);
  const webUrl = shopWebUrl(store.host);

  return (
    <View style={styles.card}>
      <View style={styles.identity}>
        <StoreAvatar card={card} size={56} />
        <View style={styles.copy}>
          <Text numberOfLines={2} style={styles.name}>
            {card.name}
          </Text>
          <Text numberOfLines={1} style={styles.address}>
            {card.address}
          </Text>
        </View>
      </View>

      {limits.length > 0 ? (
        <View style={styles.coverage} accessibilityRole="summary">
          <Text style={styles.coverageHead}>WHAT THIS APP COVERS</Text>
          {limits.map((line) => (
            <View key={line} style={styles.limit}>
              <Ionicons name="information-circle-outline" size={16} color={MART.inkMuted} style={styles.limitIcon} />
              <Text style={styles.limitText}>{line}</Text>
            </View>
          ))}
          {webUrl ? (
            <Pressable
              onPress={() => void Linking.openURL(webUrl).catch(() => undefined)}
              accessibilityRole="link"
              accessibilityLabel={`Open ${card.address} in your browser`}
              style={styles.webLink}
            >
              <Text style={styles.webLinkText}>Open {card.address} in your browser</Text>
              <Ionicons name="open-outline" size={14} color={MART.fallbackPrimary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {note ? <Text style={styles.note}>{note}</Text> : null}
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <ActionButton label={openLabel} onPress={onOpen} busy={busy} />
        <ActionButton label={dismissLabel} onPress={onDismiss} kind="quiet" disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    gap: SPACE.lg,
    ...ELEVATION.ruled,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...TYPE.title,
    color: MART.ink,
  },
  address: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
  coverage: {
    padding: SPACE.md,
    gap: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperSunken,
  },
  coverageHead: {
    ...TYPE.shelf,
    color: MART.inkMuted,
  },
  limit: {
    flexDirection: 'row',
    gap: SPACE.sm,
  },
  limitIcon: {
    marginTop: 2,
  },
  limitText: {
    ...TYPE.body,
    flex: 1,
    color: MART.ink,
  },
  webLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    minHeight: 32,
  },
  webLinkText: {
    ...TYPE.label,
    color: MART.fallbackPrimary,
  },
  note: {
    ...TYPE.meta,
    color: MART.inkMuted,
  },
  error: {
    ...TYPE.meta,
    color: MART.danger,
  },
  actions: {
    gap: SPACE.sm,
  },
});
