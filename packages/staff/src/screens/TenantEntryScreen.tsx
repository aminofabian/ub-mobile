import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View, Alert  } from 'react-native';
import { describeStoreResult, openStore, resolveTenantByEmail, type TenantContext } from '@kiosk/core';
import { confirmLeavingUnsent } from '../lib/store-switch';
import { FONT, MART, onFill, RADIUS, SPACE, tint, TYPE, WEIGHT } from '../theme/mart';
import { MartButton, MartText, Screen } from '../theme/mart-ui';
import { Field } from '../theme/Field';
import { Entrance } from '../theme/Entrance';

interface TenantEntryScreenProps {
  baseURL: string;
  appTitle: string;
  onTenantResolved: (tenant: TenantContext) => void;
}

export function TenantEntryScreen({ baseURL, appTitle, onTenantResolved }: TenantEntryScreenProps) {
  const [input, setInput] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailFallback, setShowEmailFallback] = useState(false);

  const brand = MART.fallbackPrimary;
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);
  const on = onFill(brand);
  const initials = useMemo(() => {
    const parts = appTitle.trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? 'K').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
  }, [appTitle]);

  /** Opens the store and tells the screen, or tells the person why it could not be opened. */
  const open = async (value: string, keepUnsent = false): Promise<void> => {
    const result = await openStore(value, baseURL, { audience: 'staff', keepUnsent });
    if (result.kind === 'opened') {
      onTenantResolved(result.store);
      return;
    }
    if (result.kind === 'blocked') {
      if (await confirmLeavingUnsent(result.unsent)) {
        await open(value, true);
      }
      return;
    }
    Alert.alert('Could not open store', describeStoreResult(result, value));
  };

  const resolve = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      await open(input.trim());
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not resolve tenant');
    } finally {
      setLoading(false);
    }
  };

  const resolveByEmail = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const result = await resolveTenantByEmail(baseURL, email.trim());
      await open(result.host);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not find tenant for email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {/* The shop's front door: a plaque with the app's mark, who it is, and a greeting that knows the hour. */}
        <View style={[styles.pass, { backgroundColor: brand }]}>
          <View style={[styles.orb, styles.orbOne, { backgroundColor: on.primary, opacity: 0.1 }]} />
          <View style={[styles.orb, styles.orbTwo, { backgroundColor: on.primary, opacity: 0.08 }]} />

          <Entrance>
            <View style={styles.passTop}>
              <View style={[styles.plaque, { backgroundColor: on.primary }]}>
                <MartText variant="title" color={brand} style={styles.plaqueMark}>
                  {initials}
                </MartText>
              </View>
              <View style={styles.passNames}>
                <MartText variant="shelf" color={on.secondary} style={styles.passEyebrow}>
                  STAFF · KIOSK
                </MartText>
                <MartText variant="heading" color={on.primary}>
                  {appTitle}
                </MartText>
              </View>
            </View>
          </Entrance>

          <Entrance delay={70}>
            <MartText variant="display" color={on.primary} style={styles.passTitle}>
              {greeting}.
            </MartText>
            <MartText variant="body" color={on.secondary} style={styles.passHint}>
              Open your shop to sign in. Your basket, shift and shelf are waiting where you left them.
            </MartText>
          </Entrance>
        </View>

        <Entrance delay={140} style={styles.formBody}>
          {showEmailFallback ? (
            <Field
              on="tile"
              label="Find your shop by email"
              icon="mail-outline"
              placeholder="you@shop.co.ke"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="go"
              onSubmitEditing={resolveByEmail}
              editable={!loading}
              accessibilityLabel="Staff email"
            />
          ) : (
            <Field
              on="tile"
              label="Find your shop"
              icon="storefront-outline"
              placeholder="e.g. tumaini-mini-mart"
              value={input}
              onChangeText={setInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={resolve}
              editable={!loading}
              accessibilityLabel="Business slug or host"
            />
          )}

          <MartButton
            label={loading ? 'Opening…' : showEmailFallback ? 'Find my shop' : 'Open shop'}
            busy={loading}
            style={styles.submit}
            onPress={showEmailFallback ? resolveByEmail : resolve}
          />
          <MartButton
            label={showEmailFallback ? 'Use a shop name instead' : 'I only know my email'}
            kind="quiet"
            disabled={loading}
            onPress={() => setShowEmailFallback((v) => !v)}
          />

          <View style={styles.cardFoot}>
            <View style={[styles.footDot, { backgroundColor: tint(brand, 0.5) }]} />
            <MartText variant="meta" color={MART.inkQuiet} style={styles.footText}>
              {showEmailFallback
                ? 'Your email must be on the shop’s staff list.'
                : 'The slug is in the shop’s web address — ask the owner if unsure.'}
            </MartText>
          </View>
        </Entrance>

        <Entrance delay={220} style={styles.footer}>
          <View style={styles.footerMark}>
            <View style={[styles.footerDot, { backgroundColor: brand }]} />
            <MartText variant="shelf" color={MART.inkQuiet}>
              POWERED BY KIOSK
            </MartText>
          </View>
        </Entrance>
      </ScrollView>
    </Screen>
  );
}

const EDGE = SPACE.xxl; // 28 — a calmer page inset than the 20 gutter for the auth screens.

const styles = StyleSheet.create({
  // No page padding: the header and the card span full width and set their own EDGE inset, so their
  // content shares one left line.
  container: {
    paddingHorizontal: 0,
    paddingBottom: SPACE.lg,
  },
  form: { flexGrow: 1 },
  pass: {
    paddingHorizontal: EDGE,
    // Clears the status bar on both platforms: an iPhone's Dynamic Island needs far more room than Android's bar.
    paddingTop: Platform.select({ ios: 72, android: 40, default: 72 }),
    paddingBottom: SPACE.xxxl,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    gap: SPACE.xs,
    overflow: 'hidden',
    shadowColor: MART.fallbackPrimary,
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbOne: { width: 180, height: 180, top: -70, right: -50 },
  orbTwo: { width: 110, height: 110, top: 40, right: 60 },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 999,
    top: -160,
    left: -80,
    opacity: 0.5,
  },
  // The plaque: a cream card the monogram is struck into, like a shop's nameplate.
  plaque: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: MART.ink,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  plaqueMark: { letterSpacing: -0.5 },
  passNames: { flex: 1, gap: 2 },
  passTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    marginBottom: SPACE.lg,
  },
  passMark: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  passMonogram: {
    ...TYPE.label,
    fontFamily: FONT.black,
    fontWeight: WEIGHT.black,
  },
  passEyebrow: { letterSpacing: 1.4, opacity: 0.85 },
  passTitle: { letterSpacing: -1.2 },
  passHint: { marginTop: SPACE.xs, maxWidth: 300 },
  formBody: {
    // card inset 16 + inner padding 12 = 28, so card content aligns with the header's EDGE (28).
    gap: SPACE.lg,
    marginTop: -32,
    marginHorizontal: SPACE.lg,
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.xl,
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    shadowColor: MART.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE.sm },
  cardFoot: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, marginTop: SPACE.xs },
  footDot: { width: 6, height: 6, borderRadius: 999, marginTop: 6 },
  footText: { flex: 1, lineHeight: 17 },
  submit: {
    marginTop: SPACE.sm,
    shadowColor: MART.fallbackPrimary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: SPACE.xxl,
    paddingHorizontal: SPACE.lg,
    alignItems: 'center',
    gap: SPACE.lg,
  },
  footerText: {
    textAlign: 'center',
    maxWidth: 300,
  },
  footerMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  footerDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
});
