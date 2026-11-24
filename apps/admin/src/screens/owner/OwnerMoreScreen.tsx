import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Notice, Row, SectionHead } from '../../components/owner-ui';
import type { OwnerAccess } from '../../lib/owner-access';
import { GUTTER, HAIRLINE, MART, RADIUS, SPACE, tint } from '../../theme/mart';
import { Appear, MartText } from '../../theme/mart-ui';

type Props = {
  shopName: string;
  host: string;
  personName: string;
  roleName: string;
  branchName: string | null;
  access: OwnerAccess;
  onReceive: () => void;
  onOrderFromSuppliers: () => void;
  onOpenStaff: () => void;
  onOpenReports: () => void;
  onOpenSettings: () => void;
  /** Ends the session. Resolves true once it has ended, false when the person chose to stay signed in. */
  onSignOut: () => Promise<boolean>;
};

/**
 * What is not a figure or a list: who is signed in, the two purchasing screens, the parts of the shop that are managed on
 * the web (each a plain link, opened in the phone's browser where the owner signs in again) and signing out.
 */
export function OwnerMoreScreen({
  shopName,
  host,
  personName,
  roleName,
  branchName,
  access,
  onReceive,
  onOrderFromSuppliers,
  onOpenStaff,
  onOpenReports,
  onOpenSettings,
  onSignOut,
}: Props) {
  const [leaving, setLeaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const signOut = () => {
    if (leaving) return;
    Alert.alert('Sign out?', `You will be signed out of ${shopName} on this phone.`, [
      { text: 'Stay signed in', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setLeaving(true);
          setProblem(null);
          onSignOut()
            .catch(() => {
              setProblem('Could not sign out. Try again.');
              return false;
            })
            .finally(() => setLeaving(false));
        },
      },
    ]);
  };

  const initials =
    (personName.trim().split(/\s+/)[0]?.[0] ?? '?').toUpperCase() + (personName.trim().split(/\s+/)[1]?.[0] ?? '').toUpperCase();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Appear delay={0} style={styles.who}>
        <View style={[styles.avatar, { backgroundColor: tint(MART.fallbackPrimary, 0.12) }]}>
          <MartText variant="title" color={MART.fallbackPrimary}>
            {initials}
          </MartText>
        </View>
        <View style={{ flex: 1, gap: SPACE.xxs }}>
          <MartText variant="meta" color={MART.inkQuiet}>
            Signed in
          </MartText>
          <MartText variant="heading" numberOfLines={2}>
            {personName}
          </MartText>
          <MartText variant="meta" color={MART.inkMuted} numberOfLines={2}>
            {[roleName, branchName, shopName]
              .filter((part): part is string => Boolean(part && part.length > 0))
              .filter((part, i, all) => all.indexOf(part) === i)
              .join(' · ')}
          </MartText>
        </View>
      </Appear>

      {access.receive ? (
        <Appear delay={70} style={{ gap: SPACE.md }}>
          <SectionHead>Suppliers</SectionHead>
          <Row icon="cube-outline" title="Receive a delivery" subtitle="Check a supplier's order in against what arrived" onPress={onReceive} />
          <Row icon="cart-outline" title="Order from suppliers" subtitle="Make up an order to send to a supplier" onPress={onOrderFromSuppliers} />
        </Appear>
      ) : null}

      <Appear delay={140} style={{ gap: SPACE.md }}>
        <SectionHead>Manage</SectionHead>
        <Row icon="bar-chart-outline" title="Reports" subtitle="Takings, profit and your best sellers" onPress={onOpenReports} />
        <Row icon="people-outline" title="Staff" subtitle="Who works here and their roles" onPress={onOpenStaff} />
        <Row icon="settings-outline" title="Shop settings" subtitle="Prices, receipts, branches and payments" onPress={onOpenSettings} />
      </Appear>

      <Appear delay={210} style={{ gap: SPACE.md }}>
        {problem ? <Notice tone="bad">{problem}</Notice> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          accessibilityState={{ busy: leaving, disabled: leaving }}
          disabled={leaving}
          onPress={signOut}
          style={({ pressed }) => [styles.signOut, pressed && !leaving ? styles.signOutPressed : null]}
        >
          {leaving ? (
            <ActivityIndicator color={MART.danger} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={MART.danger} />
              <MartText variant="label" color={MART.danger}>
                Sign out
              </MartText>
            </>
          )}
        </Pressable>
      </Appear>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  content: {
    padding: GUTTER,
    paddingBottom: SPACE.xxxl,
    gap: SPACE.xl,
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    padding: SPACE.lg,
    borderRadius: RADIUS.xl,
    backgroundColor: MART.paperElevated,
    ...HAIRLINE,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Restrained but unmistakable: a bordered pill in a muted danger tint, centred with room around it.
  signOut: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    minHeight: 48,
    paddingHorizontal: SPACE.xl,
    marginTop: SPACE.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: tint(MART.danger, 0.35),
    backgroundColor: tint(MART.danger, 0.06),
  },
  signOutPressed: {
    backgroundColor: tint(MART.danger, 0.12),
  },
});
