import React, { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  loginWithPassword,
  loginWithPin,
  logout,
  registerAccount,
  resendVerificationEmail,
  clearTokens,
  getTenantDisplayName,
} from '@kiosk/core';
import { API_BASE_URL } from '../lib/config';
import { brandName } from '../lib/brand';
import { doneFeel, failFeel } from '../lib/haptics';
import { FONT, MART, onFill, RADIUS, SPACE, TYPE } from '../theme/mart';
import { Capsule, ChipButton, Tag } from './Capsule';
import { Field } from './Field';

type AuthMode = 'login' | 'register';

/** Same rule as the website: 4–6 digits is a till PIN; anything else is a password. */
function looksLikeStaffPin(secret: string): boolean {
  return /^\d{4,6}$/.test(secret.trim());
}

function PinSlots({ value, accent }: { value: string; accent: string }) {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  return (
    <View style={styles.slots} accessibilityElementsHidden>
      {Array.from({ length: 6 }, (_, i) => (
        <View key={i} style={[styles.slot, Boolean(digits[i]) && { backgroundColor: accent }]} />
      ))}
    </View>
  );
}

export function AccountAuthPanel({
  signedIn,
  primary,
  storeName,
  logoUrl,
  onAuthChange,
}: {
  signedIn: boolean;
  primary: string;
  storeName: string;
  logoUrl?: string | null;
  onAuthChange: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);

  const pinMode = mode === 'login' && looksLikeStaffPin(secret);
  const initials = useMemo(() => {
    const parts = storeName.trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? 'P').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
  }, [storeName]);

  const submit = async () => {
    if (!email.trim() || !secret.trim()) {
      Alert.alert(
        'Missing fields',
        mode === 'login' ? 'Enter email and your PIN or password.' : 'Enter email and password.'
      );
      return;
    }
    if (mode === 'register' && !name.trim()) {
      Alert.alert('Missing name', 'Enter your name to create an account.');
      return;
    }
    if (mode === 'register' && secret.trim().length < 8) {
      Alert.alert('Password too short', 'Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const result = await registerAccount(API_BASE_URL, name.trim(), email.trim(), secret);
        Alert.alert(
          'Account created',
          result.verificationUrl
            ? `Check your email to verify your account.\n\nDev link:\n${result.verificationUrl}`
            : 'Check your email to verify your account before signing in.'
        );
        setMode('login');
        setSecret('');
      } else if (looksLikeStaffPin(secret)) {
        await loginWithPin(API_BASE_URL, email.trim(), secret.trim(), '');
        doneFeel();
        onAuthChange();
      } else {
        await loginWithPassword(API_BASE_URL, email.trim(), secret);
        doneFeel();
        onAuthChange();
      }
    } catch (e) {
      failFeel();
      const message = e instanceof Error ? e.message : 'Something went wrong';
      const needsVerification = /email not verified|verify/i.test(message);
      if (needsVerification && email.trim()) {
        Alert.alert('Sign in failed', message, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Resend verification',
            onPress: () => {
              void resendVerificationEmail(API_BASE_URL, email.trim())
                .then((result) => {
                  Alert.alert(
                    'Verification sent',
                    result.verificationUrl
                      ? `Open this link to verify:\n\n${result.verificationUrl}`
                      : 'Check your email for a new verification link.'
                  );
                })
                .catch((err) => {
                  Alert.alert(
                    'Could not resend',
                    err instanceof Error ? err.message : 'Try again later.'
                  );
                });
            },
          },
        ]);
      } else {
        Alert.alert(mode === 'register' ? 'Sign up failed' : 'Sign in failed', message);
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await logout(API_BASE_URL);
    } catch {
      await clearTokens();
    }
    onAuthChange();
  };

  if (signedIn) {
    return (
      <Capsule
        label="Sign out"
        kind="quiet"
        size="md"
        chip="log-out-outline"
        onPress={() => void signOut()}
      />
    );
  }

  const on = onFill(primary);

  return (
    <View style={styles.gate}>
      <View style={[styles.pass, { backgroundColor: primary }]}>
        <View style={styles.passTop}>
          <View style={[styles.passMark, { backgroundColor: on.primary }]}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.passLogo} contentFit="contain" />
            ) : (
              <Text style={[styles.passMonogram, { color: primary }]}>{initials}</Text>
            )}
          </View>
          <Text numberOfLines={1} style={[styles.passStore, { color: on.secondary }]}>
            {storeName}
          </Text>
        </View>
        <Text style={[styles.passTitle, { color: on.primary }]}>
          {mode === 'login' ? 'Your account' : 'Create an account'}
        </Text>
        <Text style={[styles.passHint, { color: on.secondary }]}>
          {mode === 'login'
            ? 'Same account as the website. PIN or password.'
            : 'Wallet, loyalty, and pickup in one place.'}
        </Text>
        <Tag
          label={`${brandName(getTenantDisplayName() ?? storeName)} member`}
          color={on.primary}
          style={styles.passChip}
        />
      </View>

      <View style={styles.form}>
        <Text accessibilityRole="header" style={styles.formTitle}>
          {mode === 'login' ? 'Sign in' : 'Join the shop'}
        </Text>
        <Text style={styles.formHint}>
          {mode === 'login'
            ? 'Email plus a 4–6 digit PIN, or your password.'
            : 'We’ll send a verification note to this email.'}
        </Text>

        <View style={styles.fields}>
          {mode === 'register' ? (
            <Field
              on="tile"
              icon="person-outline"
              placeholder="Full name"
              value={name}
              onChangeText={setName}
              accessibilityLabel="Full name"
              autoComplete="name"
            />
          ) : null}

          <Field
            on="tile"
            icon="mail-outline"
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            accessibilityLabel="Email"
          />

          <Field
            on="tile"
            icon={pinMode ? 'keypad-outline' : 'lock-closed-outline'}
            placeholder={mode === 'login' ? (pinMode ? '' : 'PIN or password') : 'Password'}
            value={secret}
            onChangeText={setSecret}
            secureTextEntry={!showSecret && !pinMode}
            keyboardType={pinMode ? 'number-pad' : 'default'}
            autoComplete={mode === 'login' ? 'password' : 'new-password'}
            textContentType="password"
            accessibilityLabel={mode === 'login' ? 'PIN or password' : 'Password'}
            style={pinMode ? styles.pinInput : undefined}
            hint={pinMode ? 'That looks like a PIN. We’ll sign you in with it.' : null}
            trailing={
              <ChipButton
                icon={showSecret ? 'eye-off-outline' : 'eye-outline'}
                label={showSecret ? 'Hide what you typed' : 'Show what you typed'}
                onPress={() => setShowSecret((open) => !open)}
                outline
                size={36}
              />
            }
          />

          {pinMode ? <PinSlots value={secret} accent={primary} /> : null}
        </View>

        <Capsule
          label={mode === 'login' ? 'Sign in' : 'Create account'}
          chip="arrow-forward"
          fill={primary}
          busy={loading}
          onPress={() => void submit()}
        />

        <Pressable
          onPress={() => {
            setMode((current) => (current === 'login' ? 'register' : 'login'));
            setSecret('');
            setShowSecret(false);
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.switchBtn, pressed && styles.pressed]}
        >
          <Text style={styles.switchText}>
            {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gate: {
    overflow: 'hidden',
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.lg,
  },
  pass: {
    padding: SPACE.xl,
  },
  passTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
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
  },
  passLogo: {
    width: 32,
    height: 32,
  },
  passStore: {
    ...TYPE.label,
    flex: 1,
  },
  passTitle: {
    ...TYPE.display,
    marginTop: SPACE.xl,
  },
  passHint: {
    ...TYPE.body,
    marginTop: SPACE.sm,
  },
  passChip: {
    marginTop: SPACE.lg,
  },
  form: {
    padding: SPACE.lg,
    paddingTop: SPACE.xl,
  },
  formTitle: {
    ...TYPE.title,
    color: MART.ink,
  },
  formHint: {
    ...TYPE.body,
    marginTop: SPACE.xs,
    color: MART.inkMuted,
  },
  fields: {
    marginTop: SPACE.lg,
    marginBottom: SPACE.lg,
    gap: SPACE.md,
  },
  pinInput: {
    fontFamily: FONT.black,
    fontSize: 22,
    letterSpacing: 8,
  },
  slots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACE.sm,
  },
  slot: {
    width: 14,
    height: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
  },
  switchBtn: {
    minHeight: 48,
    marginTop: SPACE.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchText: {
    ...TYPE.label,
    color: MART.ink,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.6,
  },
});
