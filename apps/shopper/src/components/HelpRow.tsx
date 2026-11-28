import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import type { PlatformSupport } from '@kiosk/core';
import { supportLinks, type SupportLink } from '../lib/support-links';
import { MART, RADIUS, SPACE, TYPE, ZONE } from '../theme/mart';
import { PressScale } from './Capsule';
import { Lobe } from './Coast';

const MARKS: Record<
  SupportLink['kind'],
  { icon: React.ComponentProps<typeof Ionicons>['name']; zone: string; shape: number }
> = {
  phone: { icon: 'call', zone: ZONE.leaf, shape: 0 },
  whatsapp: { icon: 'logo-whatsapp', zone: ZONE.leaf, shape: 1 },
  email: { icon: 'mail', zone: ZONE.pond, shape: 2 },
  web: { icon: 'help-circle', zone: ZONE.lilac, shape: 3 },
};

/**
 * "Need help?" with the platform's contact. It shows only the ways the server sent: there is nothing to
 * show until it sends one, and no contact is invented in the meantime (plan §5.12.4 row 11).
 */
export function HelpRow({ support }: { support: PlatformSupport | undefined }) {
  const links = supportLinks(support);
  if (links.length === 0) {
    return null;
  }

  function open(link: SupportLink) {
    Linking.openURL(link.url).catch(() => {
      Alert.alert('Could not open that', `Nothing on this phone can open ${link.label.toLowerCase()} right now.`);
    });
  }

  return (
    <View style={styles.block} accessibilityRole="summary">
      <Text accessibilityRole="header" style={styles.label}>
        Need help?
      </Text>
      <View style={styles.tile}>
        {links.map((link, index) => {
          const mark = MARKS[link.kind];
          return (
            <PressScale
              key={link.kind}
              onPress={() => open(link)}
              accessibilityRole="link"
              accessibilityLabel={link.label}
              style={[styles.row, index > 0 && styles.rule]}
            >
              <Lobe color={mark.zone} size={36} shape={mark.shape}>
                <Ionicons name={mark.icon} size={17} color={MART.ink} />
              </Lobe>
              <Text numberOfLines={1} style={styles.linkText}>
                {link.label}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={MART.ink} />
            </PressScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: SPACE.md,
    paddingTop: SPACE.lg,
  },
  label: {
    ...TYPE.heading,
    color: MART.ink,
  },
  tile: {
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    paddingHorizontal: SPACE.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 56,
  },
  rule: {
    borderTopWidth: 1,
    borderTopColor: MART.border,
  },
  linkText: {
    ...TYPE.label,
    flex: 1,
    color: MART.ink,
  },
});
