import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Text, theme } from '@kiosk/ui';
import {
  loginWithPassword,
  loginWithPin,
  resendVerificationEmail,
  type KnownStaff,
  type SignedInUser,
} from '@kiosk/core';
import { AuthBackBar } from '../components/AuthBackBar';
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
  const [method, setMethod] = useState<SignInMethod>('pin');
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
  const ready = canSubmitSignIn({ method, email, pin, password });

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
    <View style={styles.container}>
      <AuthBackBar onSecondary={onChangeStore} secondaryLabel="Change store" />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text variant="h1" accessibilityRole="header">
          Sign in
        </Text>
        {shopName ? (
          <Text variant="muted" style={styles.context}>
            {shopName}
          </Text>
        ) : null}
        {notice ? (
          <Text variant="body" style={styles.notice} accessibilityLiveRegion="polite">
            {notice}
          </Text>
        ) : null}

        {knownStaff.length > 0 ? (
          <View style={styles.chips}>
            {knownStaff.map((person) => (
              <Pressable
                key={person.email}
                onPress={() => pick(person)}
                accessibilityRole="button"
                accessibilityLabel={`Sign in as ${person.name || person.email}`}
                accessibilityState={{ selected: typed === person.email }}
                style={({ pressed }) => [styles.chip, typed === person.email && styles.chipSelected, pressed && styles.pressed]}
              >
                <Text style={styles.chipName}>{person.name || person.email}</Text>
                {person.name ? (
                  <Text variant="caption" style={styles.chipEmail} numberOfLines={1}>
                    {person.email}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
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
        {known ? (
          <Pressable onPress={notYou} accessibilityRole="button" accessibilityLabel="Not you? Remove from this phone" hitSlop={8} style={styles.notYou}>
            <Text variant="caption" style={styles.link}>
              Not you? Remove from this phone
            </Text>
          </Pressable>
        ) : null}

        {method === 'pin' ? (
          <TextInput
            ref={secretInput}
            style={styles.input}
            placeholder="PIN"
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
          <TextInput
            ref={secretInput}
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (problem) setProblem(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!busy}
            accessibilityLabel="Password"
          />
        )}

        {problem ? (
          <View accessibilityLiveRegion="polite" style={styles.problemBox}>
            <Text variant="body" style={styles.problem}>
              {problem.message}
            </Text>
            {problem.action === 'resend_verification' ? (
              <Button title="Send the link again" variant="secondary" onPress={resend} disabled={busy} style={styles.problemAction} />
            ) : null}
            {problem.action === 'pair' && onPair ? (
              <Button title="Pair this phone" variant="secondary" onPress={onPair} disabled={busy} style={styles.problemAction} />
            ) : null}
            {resent ? (
              <Text variant="caption" style={styles.resent}>
                {resent}
              </Text>
            ) : null}
          </View>
        ) : null}

        <Button title={busy ? 'Signing in...' : 'Sign in'} onPress={submit} disabled={!ready || busy} style={styles.submit} />
        {allowPassword ? (
          <Button
            title={method === 'pin' ? 'Use password instead' : 'Use PIN instead'}
            variant="secondary"
            onPress={switchMethod}
            disabled={busy}
            style={styles.secondary}
          />
        ) : null}
        {pairingEnabled && onPair && problem?.action !== 'pair' ? (
          <Pressable onPress={onPair} accessibilityRole="button" accessibilityLabel="Pair this phone with a code" hitSlop={8} style={styles.pairLink}>
            <Text variant="caption" style={styles.link}>
              New phone? Pair it with a code
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  form: { flexGrow: 1, justifyContent: 'center' },
  context: { marginBottom: theme.spacing.md },
  notice: { marginBottom: theme.spacing.md, color: theme.colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: theme.spacing.md },
  chip: {
    minHeight: 48,
    maxWidth: '100%',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
  },
  chipSelected: { borderColor: theme.colors.primary },
  chipName: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  chipEmail: { color: theme.colors.textMuted },
  pressed: { opacity: 0.6 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    fontSize: 16,
    minHeight: 48,
  },
  notYou: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', marginTop: -theme.spacing.sm, marginBottom: theme.spacing.md },
  link: { color: theme.colors.primaryDark, fontWeight: '600' },
  problemBox: { marginBottom: theme.spacing.md },
  problem: { color: theme.colors.danger },
  problemAction: { marginTop: theme.spacing.sm },
  resent: { marginTop: theme.spacing.sm, color: theme.colors.textMuted },
  submit: {},
  secondary: { marginTop: theme.spacing.md },
  pairLink: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', marginTop: theme.spacing.md },
});
