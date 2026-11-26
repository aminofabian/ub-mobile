import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View  } from 'react-native';
import { CardGloss } from '../theme/CardGloss';
import { askOwner } from '../lib/till-request';
import { Ionicons } from '@expo/vector-icons';
import { FONT, MART, onFill, RADIUS, SPACE, tint, TYPE, WEIGHT } from '../theme/mart';
import { MartButton, MartText, Screen } from '../theme/mart-ui';
import { Field } from '../theme/Field';
import { Entrance } from '../theme/Entrance';
import {
  loginWithPassword,
  loginWithPin,
  resendVerificationEmail,
  type KnownStaff,
  type SignedInUser,
} from '@kiosk/core';
import { canSubmitSignIn, cleanEmail, cleanPin, isEmailComplete, type SignInMethod } from '../lib/sign-in-form';
import { NO_WRONG_TRIES, countWrongTries, describeSignInProblem, type SignInProblem, type WrongTries } from '../lib/sign-in-problems';

export interface SignedInDetails {
  /** The person the server named, when it did. */
  user: SignedInUser | null;
  /** What was typed, tidied. */
  email: string;
  /** The shop the sign-in was sent for. The shell uses the answer only if that shop is still the one open. */
  shop: string;
}

interface SignInScreenProps {
  baseURL: string;
  /** The shop this screen is for (its slug). A sign-in is bound to it from the moment it is sent. */
  shop: string;
  shopName?: string | null;
  /** A password beside the PIN (the Cashier and Admin offer it). */
  allowPassword?: boolean;
  /** The platform says pairing works. */
  pairingEnabled?: boolean;
  /** People who signed in on this phone at this shop before, newest first. */
  knownStaff: KnownStaff[];
  /** Why the person is here again, for example that the session ended. */
  notice?: string | null;
  onSignedIn: (details: SignedInDetails) => void;
  /** "Not you?": take one person off the list. */
  onForgetStaff?: (email: string) => void;
  onPair?: () => void;
  onChangeStore?: () => void;
}

export function SignInScreen({
  baseURL,
  shop,
  shopName,
  allowPassword = false,
  pairingEnabled = false,
  knownStaff,
  notice,
  onSignedIn,
  onForgetStaff,
  onPair,
  onChangeStore,
}: SignInScreenProps) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [method, setMethod] = useState<SignInMethod>('password');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<SignInProblem | null>(null);
  const [resent, setResent] = useState<string | null>(null);
  const secretInput = useRef<TextInput>(null);
  const mounted = useRef(true);
  // Two quick taps must not send two attempts: the server counts each wrong PIN.
  const sending = useRef(false);
  // Wrong PINs or passwords in a row for one person: after a few the account may be locked, and the server says
  // the same "doesn't match" even to the right PIN.
  const wrongTries = useRef<WrongTries>(NO_WRONG_TRIES);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const typed = cleanEmail(email);
  const known = knownStaff.find((person) => person.email === typed);
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  }, []);
  const firstName = known?.name?.trim().split(/\s+/)[0] ?? null;
  const ask = {
    shopName: shopName ?? shop,
    branchName: null,
    reason:
      problem?.kind === 'not_approved_till'
        ? problem.message
        : 'This phone cannot sell until it is registered as a till.',
  };
  const ready = canSubmitSignIn({ method, email, pin, password });

  // The brand green fills the pass header; its text colour is worked out from it.
  const brand = MART.fallbackPrimary;
  const on = onFill(brand);
  const initials = useMemo(() => {
    const parts = (shopName ?? '').trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? 'K').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
  }, [shopName]);

  const submit = async () => {
    if (!ready || busy || sending.current) return;
    sending.current = true;
    const startedFor = shop;
    setBusy(true);
    setProblem(null);
    setResent(null);
    try {
      const result =
        method === 'pin' ? await loginWithPin(baseURL, typed, pin) : await loginWithPassword(baseURL, typed, password);
      // Not held back when the person has left this screen: the shell decides what an answer for a screen that
      // is gone, or a shop that is closed, is worth.
      onSignedIn({ user: result.user, email: typed, shop: startedFor });
    } catch (error) {
      if (!mounted.current) return;
      const context = { method, shopName: shopName ?? undefined, pairingEnabled };
      wrongTries.current = countWrongTries(wrongTries.current, typed, describeSignInProblem(error, context).kind);
      const found = describeSignInProblem(error, {
        ...context,
        failedTries: wrongTries.current.email === typed ? wrongTries.current.count : 0,
      });
      setProblem(found);
      if (found.clearSecret) {
        setPin('');
        setPassword('');
        secretInput.current?.focus();
      }
    } finally {
      sending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const resend = async () => {
    if (!isEmailComplete(typed) || busy) return;
    setBusy(true);
    try {
      await resendVerificationEmail(baseURL, typed);
      if (mounted.current) setResent('Sent. Check your email for the link.');
    } catch {
      if (mounted.current) setResent("Couldn't send it. Try again in a minute.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const pick = (person: KnownStaff) => {
    setEmail(person.email);
    setProblem(null);
    setResent(null);
    setTimeout(() => secretInput.current?.focus(), 0);
  };

  const notYou = () => {
    if (!known) return;
    onForgetStaff?.(known.email);
    setEmail('');
    setPin('');
    setPassword('');
    setProblem(null);
  };

  const switchMethod = () => {
    setMethod((current) => (current === 'pin' ? 'password' : 'pin'));
    setPin('');
    setPassword('');
    setProblem(null);
    setResent(null);
  };

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Entrance delay={0} style={[styles.pass, { backgroundColor: brand }]}>
          {/* Layered translucent shapes give the flat green depth, like light catching a surface. */}
          <View style={[styles.glow, { backgroundColor: on.wash }]} pointerEvents="none" />
          <View style={[styles.orb, styles.orbOne, { backgroundColor: on.wash }]} pointerEvents="none" />
          <View style={[styles.orb, styles.orbTwo, { backgroundColor: on.hairline }]} pointerEvents="none" />
          {/* A lacquered sweep across the shop's colour, so the header is a surface and not a flat block. */}
          <View style={styles.lacquer} pointerEvents="none" />
          <View style={styles.passTop}>
            <View style={styles.passBrand}>
              <View style={[styles.plaque, { backgroundColor: on.primary }]}>
                <MartText variant="title" color={brand} style={styles.plaqueMark}>
                  {initials}
                </MartText>
              </View>
              <View style={styles.passNames}>
                <MartText variant="shelf" color={on.secondary} numberOfLines={1} style={styles.passEyebrow}>
                  {(shopName ?? 'YOUR SHOP').toUpperCase()}
                </MartText>
                <MartText variant="heading" color={on.primary}>
                  Staff sign-in
                </MartText>
              </View>
            </View>
            {onChangeStore ? (
              <Pressable
                onPress={onChangeStore}
                accessibilityRole="button"
                accessibilityLabel="Change store"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.storeChip,
                  { borderColor: on.hairline, backgroundColor: on.wash },
                  pressed && styles.pressed,
                ]}
              >
                <MartText variant="shelf" color={on.primary} style={styles.storeChipText}>
                  Change store
                </MartText>
              </Pressable>
            ) : null}
          </View>
          <MartText variant="display" color={on.primary} style={styles.passTitle}>
            {firstName ? `${greeting}, ${firstName}.` : `${greeting}.`}
          </MartText>
          <MartText variant="body" color={on.secondary} style={styles.passHint}>
            {known
              ? 'Your PIN and the shelf are ready. Your shift picks up where it left off.'
              : 'Sign in with your email and PIN or password.'}
          </MartText>
        </Entrance>

        <View style={styles.formBody}>
          {/* The same glazed surface the shelf's cards use: warm ivory, a reflection, lit edge. */}
          <CardGloss radius={RADIUS.xl} />
          {notice ? (
            <View style={styles.noticeBox} accessibilityLiveRegion="polite">
              <MartText variant="body" color={MART.inkMuted}>
                {notice}
              </MartText>
            </View>
          ) : null}

          {knownStaff.length > 0 ? (
            <View style={styles.people}>
              <MartText variant="label" color={MART.inkMuted} style={styles.peopleLabel}>
                Who's signing in?
              </MartText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRow}>
                {knownStaff.map((person) => {
                  const on = typed === person.email;
                  const parts = (person.name || person.email).trim().split(/\s+/).filter(Boolean);
                  const mark = (parts[0]?.[0] ?? '?').toUpperCase();
                  return (
                    <Pressable
                      key={person.email}
                      onPress={() => pick(person)}
                      accessibilityRole="button"
                      accessibilityLabel={`Sign in as ${person.name || person.email}`}
                      accessibilityState={{ selected: on }}
                      style={({ pressed }) => [styles.person, on && styles.personOn, pressed && styles.pressed]}
                    >
                      <View style={[styles.personMark, on && { backgroundColor: brand }]}>
                        <MartText variant="label" color={on ? onFill(brand).primary : MART.ink}>
                          {mark}
                        </MartText>
                      </View>
                      <View style={styles.personText}>
                        <MartText variant="label" numberOfLines={1}>
                          {person.name || person.email}
                        </MartText>
                        {person.name ? (
                          <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
                            {person.email}
                          </MartText>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          <Entrance delay={90}>
            <Field
              on="tile"
              label="Email"
              icon="mail-outline"
              placeholder="you@shop.co.ke"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (problem) setProblem(null);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => secretInput.current?.focus()}
              editable={!busy}
              accessibilityLabel="Email"
            />
          </Entrance>
          {known ? (
            <Pressable onPress={notYou} accessibilityRole="button" accessibilityLabel="Not you? Remove from this phone" hitSlop={8} style={styles.notYou}>
              <MartText variant="meta" style={styles.link}>
                Not you? Remove from this phone
              </MartText>
            </Pressable>
          ) : null}

          <Entrance delay={150}>
          {method === 'pin' ? (
            <Field
              ref={secretInput}
              on="tile"
              label="PIN"
              icon="keypad-outline"
              placeholder="••••"
              value={pin}
              onChangeText={(text) => {
                setPin(cleanPin(text));
                if (problem) setProblem(null);
              }}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="off"
              importantForAutofill="no"
              returnKeyType="go"
              onSubmitEditing={submit}
              editable={!busy}
              accessibilityLabel="PIN"
            />
          ) : (
            <Field
              ref={secretInput}
              on="tile"
              label="Password"
              icon="lock-closed-outline"
              placeholder="Your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (problem) setProblem(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              textContentType="none"
              importantForAutofill="no"
              returnKeyType="go"
              onSubmitEditing={submit}
              editable={!busy}
              accessibilityLabel="Password"
            />
          )}
          </Entrance>

        {problem ? (
          <View accessibilityLiveRegion="polite" style={styles.problemBox}>
            <MartText variant="body" color={MART.danger}>
              {problem.message}
            </MartText>
            {problem.kind === 'not_approved_till' ? (
              <View style={styles.askRow}>
                <Pressable
                  onPress={() => void askOwner('whatsapp', ask)}
                  accessibilityRole="button"
                  accessibilityLabel="Ask the owner on WhatsApp"
                  style={({ pressed }) => [styles.askBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="logo-whatsapp" size={16} color={MART.fallbackPrimary} />
                  <MartText variant="label" color={MART.fallbackPrimary}>
                    WhatsApp the owner
                  </MartText>
                </Pressable>
                <Pressable
                  onPress={() => void askOwner('email', ask)}
                  accessibilityRole="button"
                  accessibilityLabel="Ask the owner by email"
                  style={({ pressed }) => [styles.askBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="mail-outline" size={16} color={MART.fallbackPrimary} />
                  <MartText variant="label" color={MART.fallbackPrimary}>
                    Email
                  </MartText>
                </Pressable>
              </View>
            ) : null}
            {problem.action === 'resend_verification' ? (
              <MartButton label="Send the link again" kind="quiet" onPress={resend} disabled={busy} style={styles.problemAction} />
            ) : null}
            {problem.action === 'pair' && onPair ? (
              <MartButton label="Pair this phone" kind="quiet" onPress={onPair} disabled={busy} style={styles.problemAction} />
            ) : null}
            {resent ? (
              <MartText variant="meta" color={MART.inkQuiet} style={styles.resent}>
                {resent}
              </MartText>
            ) : null}
          </View>
        ) : null}

        <Entrance delay={210}>
          <MartButton label={busy ? 'Signing in…' : 'Sign in'} busy={busy} onPress={submit} disabled={!ready || busy} style={styles.submit} />
        </Entrance>
        {allowPassword ? (
          <MartButton
            label={method === 'pin' ? 'Use password instead' : 'Use PIN instead'}
            kind="quiet"
            onPress={switchMethod}
            disabled={busy}
            style={styles.secondary}
          />
        ) : null}
        {pairingEnabled && onPair && problem?.action !== 'pair' ? (
          <Pressable onPress={onPair} accessibilityRole="button" accessibilityLabel="Pair this phone with a code" hitSlop={8} style={styles.pairLink}>
            <MartText variant="meta" style={styles.link}>
              New phone? Pair it with a code
            </MartText>
          </Pressable>
        ) : null}
        </View>

        <Entrance delay={270} style={styles.footer}>
          <MartText variant="meta" color={MART.inkQuiet} style={styles.footerText}>
            Trouble signing in? Ask the shop owner to reset your PIN.
          </MartText>
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
  // No page padding: the header and card span full width, each setting its own EDGE inset so their
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
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 999,
    top: -160,
    left: -80,
    opacity: 0.5,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbOne: {
    width: 180,
    height: 180,
    top: -70,
    right: -50,
  },
  orbTwo: {
    width: 110,
    height: 110,
    top: 40,
    right: 60,
  },
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
  passEyebrow: { letterSpacing: 1.4, opacity: 0.85 },
  people: { gap: SPACE.sm },
  peopleLabel: { paddingHorizontal: 2 },
  peopleRow: { gap: SPACE.sm, paddingRight: SPACE.lg },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  personOn: { borderColor: MART.fallbackPrimary, backgroundColor: tint(MART.fallbackPrimary, 0.06) },
  personMark: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperSunken,
  },
  personText: { maxWidth: 150 },
  passRing: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
    marginBottom: SPACE.lg,
  },
  // The monogram + shop name as one group, so the chip can sit opposite them.
  passBrand: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  // A quiet outlined capsule on the green: present, but it never competes with "Welcome back".
  storeChip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
  },
  storeChipText: { letterSpacing: 0.2 },
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
  passStore: { flex: 1 },
  passTitle: {},
  passHint: {},
  // A white card that rides up into the header's curve, so the screen reads as one piece.
  lacquer: {
    position: 'absolute',
    top: '-40%',
    left: '-30%',
    right: '-30%',
    height: '85%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    transform: [{ rotate: '-9deg' }],
  },
  formBody: {
    // card inset 16 + inner padding 12 = 28, aligning card content with the header's EDGE (28).
    gap: SPACE.lg,
    marginTop: -32,
    marginHorizontal: SPACE.lg,
    paddingHorizontal: SPACE.md,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.xl,
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    shadowColor: MART.ink,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  noticeBox: { gap: SPACE.sm },
  askRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  askBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.pill,
    backgroundColor: tint(MART.fallbackPrimary, 0.08),
  },
  notice: {
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.infoSurface,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    minHeight: 48,
    maxWidth: '100%',
    justifyContent: 'center',
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderWidth: 1,
    borderColor: MART.border,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
  },
  chipSelected: { borderColor: MART.fallbackPrimary, borderWidth: 1.5 },
  pressed: { opacity: 0.6 },
  notYou: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', marginTop: -SPACE.xs },
  link: { color: MART.info, fontFamily: TYPE.label.fontFamily },
  problemBox: { gap: SPACE.sm },
  problemAction: { marginTop: SPACE.xs },
  resent: {},
  submit: {
    marginTop: SPACE.sm,
    shadowColor: MART.fallbackPrimary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  secondary: {},
  pairLink: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', marginTop: SPACE.sm },
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
