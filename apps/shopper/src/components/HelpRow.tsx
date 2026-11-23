import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlatformSupport } from '@kiosk/core';
import { supportLinks, type SupportLink } from '../lib/support-links';
import { MART, RADIUS, SPACE, TYPE } from '../theme/mart';

const ICONS: Record<SupportLink['kind'], React.ComponentProps<typeof Ionicons>['name']> = {
  phone: 'call-outline',
  whatsapp: 'logo-whatsapp',
  email: 'mail-outline',
  web: 'help-circle-outline',
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
    <View style={styles.row} accessibilityRole="summary">
      <Text style={styles.label}>Need help?</Text>
      <View style={styles.links}>
        {links.map((link) => (
          <Pressable
            key={link.kind}
            onPress={() => open(link)}
            accessibilityRole="link"
            accessibilityLabel={link.label}
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Ionicons name={ICONS[link.kind]} size={16} color={MART.fallbackPrimary} />
            <Text style={styles.linkText}>{link.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: SPACE.sm,
    paddingTop: SPACE.lg,
    borderTopWidth: 1,
    borderTopColor: MART.border,
  },
  label: {
    ...TYPE.label,
    color: MART.inkMuted,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  pressed: {
    backgroundColor: MART.paperSunken,
  },
  linkText: {
    ...TYPE.label,
    color: MART.fallbackPrimary,
  },
});
