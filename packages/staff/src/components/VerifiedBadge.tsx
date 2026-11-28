import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MART, tint } from '../theme/mart';
import { MartText } from '../theme/mart-ui';

/**
 * A customer whose details have been checked — by a person at the shop, or by entering a code sent to their own number.
 *
 * Both roads end in the same status here: the badge is about the person being known, not about which method proved it. It
 * is deliberately quiet — a small check in a tinted capsule — because verification is information, not a warning: most
 * shops do not require it, and a customer without it is not in any trouble.
 */
export function VerifiedBadge({ verified, compact = false }: { verified: boolean; compact?: boolean }) {
  if (!verified) return null;
  return (
    <View style={[styles.badge, compact && styles.compact]} accessibilityLabel="Verified customer">
      <Ionicons name="checkmark-circle" size={compact ? 11 : 13} color={MART.success} />
      {compact ? null : (
        <MartText variant="shelf" color={MART.success}>
          VERIFIED
        </MartText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: tint(MART.success, 0.12),
  },
  compact: { paddingHorizontal: 3, paddingVertical: 2 },
});
