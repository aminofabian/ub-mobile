import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  loginWithPassword,
  loginWithPin,
  logout,
  registerAccount,
  resendVerificationEmail,
  clearTokens,
} from '@kiosk/core';
import { API_BASE_URL } from '../lib/config';
import { MART, ON_BRAND, RADIUS, SPACE, TYPE } from '../theme/mart';

type AuthMode = 'login' | 'register';

/** Same rule as the website: 4–6 digits is a till PIN; anything else is a password. */
function looksLikeStaffPin(secret: string): boolean {
  return /^\d{4,6}$/.test(secret.trim());
}

function PinSlots({ value, accent }: { value: string; accent: string }) {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  return (
    <View style={styles.slots} accessibilityElementsHidden>
      {Array.from({ length: 6 }, (_, i) => {
        const filled = Boolean(digits[i]);
        return (
          <View
            key={i}
            style={[
              styles.slot,
              filled && { borderColor: accent, backgroundColor: `${accent}14` },
            ]}
          >
            <Text style={[styles.slotDot, filled && { color: accent }]}>
              {filled ? '•' : ''}
            </Text>
          </View>
        );
      })}
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
        onAuthChange();
      } else {
        await loginWithPassword(API_BASE_URL, email.trim(), secret);
        onAuthChange();
      }
    } catch (e) {
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
      <Pressable
        onPress={signOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={styles.quickSignOut}
      >
        <Ionicons name="log-out-outline" size={18} color={MART.inkMuted} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.gate}>
      <View style={[styles.pass, { backgroundColor: primary }]}>
        <View style={styles.passTop}>
          <View style={styles.passMark}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.passLogo} resizeMode="contain" />
            ) : (
              <Text style={styles.passMonogram}>{initials}</Text>
            )}
          </View>
          <Text style={styles.passStore}>{storeName}</Text>
        </View>
        <Text style={styles.passTitle}>
          {mode === 'login' ? 'Your store card' : 'Get a store card'}
        </Text>
        <Text style={styles.passHint}>
          {mode === 'login'
            ? 'Same account as the website — PIN or password.'
            : 'Wallet, loyalty, and pickup in one place.'}
        </Text>
        <View style={styles.passChip}>
          <Ionicons name="shield-checkmark-outline" size={12} color="#fff" />
          <Text style={styles.passChipText}>Palmart member</Text>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.formTitle}>
          {mode === 'login' ? 'Come in' : 'Join the shop'}
        </Text>
        <Text style={styles.formHint}>
          {mode === 'login'
            ? 'Email plus a 4–6 digit PIN, or your password.'
            : 'We’ll send a verification note to this email.'}
        </Text>

        {mode === 'register' ? (
          <View style={styles.field}>
            <Ionicons name="person-outline" size={18} color={MART.inkQuiet} style={styles.fieldIcon} />
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor={MART.inkQuiet}
              value={name}
              onChangeText={setName}
              accessibilityLabel="Full name"
              autoComplete="name"
            />
          </View>
        ) : null}

        <View style={styles.field}>
          <Ionicons name="mail-outline" size={18} color={MART.inkQuiet} style={styles.fieldIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={MART.inkQuiet}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            accessibilityLabel="Email"
          />
        </View>

        <View style={styles.secretWrap}>
          <View style={styles.field}>
            <Ionicons
              name={pinMode ? 'keypad-outline' : 'lock-closed-outline'}
              size={18}
              color={pinMode ? primary : MART.inkQuiet}
              style={styles.fieldIcon}
            />
            <TextInput
              style={[styles.input, styles.secretInput, pinMode && styles.pinInput]}
              placeholder={mode === 'login' ? (pinMode ? '' : 'PIN or password') : 'Password'}
              placeholderTextColor={MART.inkQuiet}
              value={secret}
              onChangeText={setSecret}
              secureTextEntry={!showSecret && !pinMode}
              keyboardType={pinMode ? 'number-pad' : 'default'}
              autoComplete={mode === 'login' ? 'password' : 'new-password'}
              textContentType="password"
              accessibilityLabel={mode === 'login' ? 'PIN or password' : 'Password'}
            />
            <Pressable
              onPress={() => setShowSecret((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={showSecret ? 'Hide secret' : 'Show secret'}
              hitSlop={8}
              style={styles.eye}
            >
              <Ionicons
                name={showSecret ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={MART.inkMuted}
              />
            </Pressable>
          </View>
        </View>

        {pinMode ? <PinSlots value={secret} accent={primary} /> : null}
        {pinMode ? (
          <Text style={[styles.pinHint, { color: primary }]}>PIN recognized — signing in like the till.</Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={loading}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: primary },
            pressed && styles.pressed,
            loading && styles.disabled,
          ]}
        >
          <Text style={styles.primaryBtnText}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Text>
          {!loading ? <Ionicons name="arrow-forward" size={16} color="#fff" /> : null}
        </Pressable>

        <Pressable
          onPress={() => {
            setMode((current) => (current === 'login' ? 'register' : 'login'));
            setSecret('');
            setShowSecret(false);
          }}
          accessibilityRole="button"
          style={styles.switchBtn}
        >
          <Text style={[styles.switchText, { color: primary }]}>
            {mode === 'login' ? 'Need a card? Create an account' : 'Already have a card? Sign in'}
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
    borderWidth: 1,
    borderColor: MART.border,
    borderRadius: RADIUS.md,
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
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: ON_BRAND.wash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passMonogram: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  passLogo: {
    width: 28,
    height: 28,
  },
  passStore: {
    ...TYPE.label,
    flex: 1,
    fontWeight: '700',
    color: ON_BRAND.secondary,
  },
  passTitle: {
    ...TYPE.title,
    marginTop: SPACE.xl,
    color: ON_BRAND.primary,
  },
  passHint: {
    ...TYPE.label,
    marginTop: SPACE.sm,
    fontWeight: '400',
    color: ON_BRAND.secondary,
  },
  passChip: {
    alignSelf: 'flex-start',
    marginTop: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
    backgroundColor: ON_BRAND.wash,
  },
  passChipText: {
    ...TYPE.shelf,
    letterSpacing: 0.2,
    color: ON_BRAND.primary,
  },
  form: {
    padding: SPACE.lg,
  },
  formTitle: {
    ...TYPE.title,
    color: MART.ink,
  },
  formHint: {
    ...TYPE.label,
    marginTop: SPACE.xs,
    marginBottom: SPACE.lg,
    fontWeight: '400',
    color: MART.inkMuted,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    marginBottom: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderColor: MART.border,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paper,
  },
  fieldIcon: {
    marginRight: SPACE.sm,
  },
  input: {
    flex: 1,
    minHeight: 52,
    ...TYPE.body,
    fontSize: 16,
    color: MART.ink,
  },
  secretWrap: {},
  secretInput: {
    paddingRight: SPACE.sm,
  },
  pinInput: {
    letterSpacing: 8,
    fontSize: 20,
    fontWeight: '700',
  },
  eye: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACE.xs,
    marginBottom: SPACE.sm,
  },
  slot: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotDot: {
    fontSize: 22,
    fontWeight: '800',
    color: MART.inkQuiet,
  },
  pinHint: {
    ...TYPE.meta,
    marginBottom: SPACE.md,
  },
  primaryBtn: {
    minHeight: 52,
    marginTop: SPACE.xs,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    borderRadius: RADIUS.md,
  },
  primaryBtnText: {
    ...TYPE.heading,
    color: ON_BRAND.primary,
  },
  switchBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchText: {
    ...TYPE.label,
  },
  pressed: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.7,
  },
  quickSignOut: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACE.xs,
  },
  signOutText: {
    ...TYPE.label,
    fontSize: 14,
    color: MART.inkMuted,
  },
});
