import { Ionicons } from '@expo/vector-icons';
import {
  getTenantHeaders,
  loginWithPassword,
  loginWithPin,
  registerAccount,
  resendVerificationEmail,
} from '@kiosk/core';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { sendShopperCode, verifyShopperCode } from '../api/shopper-auth';
import { useSession } from '../hooks/useSession';
import { API_BASE_URL } from '../lib/config';
import { formatPhoneDisplay, looksLikeKenyanMobile, toKenyanLocal07 } from '../lib/phone';
import {
  randomDeviceSecret,
  saveDeviceSecret,
  saveShopperProfile,
} from '../lib/shopper-profile';
import { useTenant } from '../lib/TenantContext';
import {
  ELEVATION,
  MART,
  martFromTenant,
  ON_BRAND,
  RADIUS,
  SPACE,
  TYPE,
} from '../theme/mart';
import { saveTabPhone as rememberTillPhone } from '../lib/remembered-phone';

export type AuthIntent = 'pass' | 'checkout';

type Gate = {
  openAuth: (intent?: AuthIntent) => Promise<boolean>;
};

const AuthGateContext = createContext<Gate | null>(null);

export function useAuthGate(): Gate {
  const ctx = useContext(AuthGateContext);
  if (!ctx) {
    throw new Error('useAuthGate must be used within AuthGateProvider');
  }
  return ctx;
}

function looksLikeStaffPin(secret: string): boolean {
  return /^\d{4,6}$/.test(secret.trim());
}

function tokenFromVerifyUrl(url?: string | null): string | null {
  if (!url) return null;
  const match = url.match(/[?&]token=([^&]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function AuthGateProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [intent, setIntent] = useState<AuthIntent>('pass');
  const settleRef = useRef<(ok: boolean) => void>(undefined);
  const { refreshAuth } = useSession();

  const finish = useCallback((ok: boolean) => {
    settleRef.current?.(ok);
    settleRef.current = undefined;
    setVisible(false);
    if (ok) refreshAuth();
  }, [refreshAuth]);

  const openAuth = useCallback((next: AuthIntent = 'pass') => {
    setIntent(next);
    setVisible(true);
    return new Promise<boolean>((resolve) => {
      settleRef.current = resolve;
    });
  }, []);

  const value = useMemo(() => ({ openAuth }), [openAuth]);

  return (
    <AuthGateContext.Provider value={value}>
      {children}
      <AuthSheet
        visible={visible}
        intent={intent}
        onClose={() => finish(false)}
        onAuthed={() => finish(true)}
      />
    </AuthGateContext.Provider>
  );
}

function AuthSheet({
  visible,
  intent,
  onClose,
  onAuthed,
}: {
  visible: boolean;
  intent: AuthIntent;
  onClose: () => void;
  onAuthed: () => void;
}) {
  const tenant = useTenant();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const scrollRef = useRef<ScrollView>(null);
  const mart = martFromTenant(tenant);
  const sheetMax = Math.min(
    Dimensions.get('window').height * 0.92,
    Dimensions.get('window').height - keyboardHeight - SPACE.sm
  );
  const [lane, setLane] = useState<'in' | 'join'>('join');
  const [step, setStep] = useState<'phone' | 'code' | 'details'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [secret, setSecret] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [shipping, setShipping] = useState('');
  const [masked, setMasked] = useState('');
  const submittingCode = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setLane('join');
    setStep('phone');
    setError(null);
    setCode('');
    submittingCode.current = false;
  }, [visible, intent]);

  function resetJoin() {
    setStep('phone');
    setCode('');
    setError(null);
  }

  async function signIn() {
    if (!email.trim() || !secret.trim()) {
      setError('Enter the email and PIN or password for this shop.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (looksLikeStaffPin(secret)) {
        await loginWithPin(API_BASE_URL, email.trim(), secret.trim(), '');
      } else {
        await loginWithPassword(API_BASE_URL, email.trim(), secret);
      }
      onAuthed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    if (!looksLikeKenyanMobile(phone)) {
      setError('Enter a Kenyan mobile, e.g. 0712 345 678.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sent = await sendShopperCode(tenant, phone);
      setMasked(sent.maskedHint || formatPhoneDisplay(phone));
      submittingCode.current = false;
      setCode('');
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a code.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(raw?: string) {
    const value = (raw ?? code).replace(/\D/g, '').slice(0, 4);
    if (!/^\d{4}$/.test(value)) {
      setError('Enter the 4-digit code from the text.');
      return;
    }
    if (submittingCode.current) return;
    submittingCode.current = true;
    setBusy(true);
    setError(null);
    try {
      await verifyShopperCode(tenant, phone, value);
      setStep('details');
    } catch (e) {
      submittingCode.current = false;
      setError(e instanceof Error ? e.message : 'That code didn’t match.');
    } finally {
      setBusy(false);
    }
  }

  function onCodeChange(next: string) {
    const value = next.replace(/\D/g, '').slice(0, 4);
    setCode(value);
    if (value.length === 4) void confirmCode(value);
  }

  async function finishJoin() {
    if (!name.trim() || name.trim().length < 2) {
      setError('Add your name so the till knows who to call.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Add an email for receipts and your store card.');
      return;
    }
    if (!shipping.trim()) {
      setError('Add an estate or street so we know where to send orders.');
      return;
    }
    setBusy(true);
    setError(null);
    const local = toKenyanLocal07(phone) || phone.trim();
    const password = randomDeviceSecret();
    try {
      const result = await registerAccount(API_BASE_URL, name.trim(), email.trim(), password);
      const token = tokenFromVerifyUrl(result.verificationUrl);
      if (token) {
        await fetch(`${API_BASE_URL}/api/v1/auth/verify-email`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...getTenantHeaders(tenant),
          },
          body: JSON.stringify({ token }),
        });
      }
      try {
        await loginWithPassword(API_BASE_URL, email.trim(), password);
      } catch {
        if (result.status === 'INVITED') {
          await resendVerificationEmail(API_BASE_URL, email.trim());
          setError('Check your email to confirm the card, then sign in. Your details are saved on this phone.');
          await saveDeviceSecret(password);
          await saveShopperProfile({ name, email, phone: local, shipping });
          await rememberTillPhone(local);
          setBusy(false);
          return;
        }
        throw new Error('Account created — sign in with that email.');
      }
      await saveDeviceSecret(password);
      await saveShopperProfile({ name, email, phone: local, shipping });
      await rememberTillPhone(local);
      onAuthed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish joining.');
    } finally {
      setBusy(false);
    }
  }

  const title =
    intent === 'checkout'
      ? lane === 'in'
        ? 'Sign in to check out'
        : 'Join to check out'
      : lane === 'in'
        ? 'Your store card'
        : 'Get a store card';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dim} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            {
              maxHeight: sheetMax,
              marginBottom: keyboardHeight,
              paddingBottom: SPACE.lg + (keyboardHeight > 0 ? SPACE.sm : insets.bottom),
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={MART.inkMuted} />
            </Pressable>
          </View>
          <Text style={styles.sheetHint}>
            {lane === 'in'
              ? 'Same email as the website. PIN or password.'
              : step === 'phone'
                ? 'We’ll text a 4-digit code to this line.'
                : step === 'code'
                  ? `Code sent to ${masked || formatPhoneDisplay(phone)}. We’ll fill it from the text.`
                  : 'Email and where to deliver. That’s the last step.'}
          </Text>

          <View style={styles.lanes}>
            <Pressable
              onPress={() => {
                setLane('join');
                resetJoin();
              }}
              style={[styles.lane, lane === 'join' && styles.laneOn]}
            >
              <Text style={[styles.laneText, lane === 'join' && styles.laneTextOn]}>Join</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setLane('in');
                setError(null);
              }}
              style={[styles.lane, lane === 'in' && styles.laneOn]}
            >
              <Text style={[styles.laneText, lane === 'in' && styles.laneTextOn]}>Sign in</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            onContentSizeChange={() => {
              if (keyboardHeight > 0) scrollRef.current?.scrollToEnd({ animated: true });
            }}
          >
            {lane === 'in' ? (
              <>
                <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />
                <Field
                  label="PIN or password"
                  value={secret}
                  onChange={setSecret}
                  secure
                  keyboardType={looksLikeStaffPin(secret) ? 'number-pad' : 'default'}
                />
              </>
            ) : step === 'phone' ? (
              <Field
                label="Phone"
                value={phone}
                onChange={setPhone}
                keyboardType="phone-pad"
                placeholder="07…"
                autoComplete="tel"
                textContentType="telephoneNumber"
              />
            ) : step === 'code' ? (
              <Field
                label="4-digit code"
                value={code}
                onChange={onCodeChange}
                keyboardType="number-pad"
                placeholder="••••"
                autoFocus
                maxLength={4}
                autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                textContentType="oneTimeCode"
                importantForAutofill="yes"
                inputMode="numeric"
                onSubmitEditing={() => void confirmCode()}
              />
            ) : (
              <>
                <Field label="Full name" value={name} onChange={setName} autoCapitalize="words" />
                <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" />
                <Field
                  label="Estate / street"
                  value={shipping}
                  onChange={setShipping}
                  placeholder="e.g. Mirema Drive, opposite the church"
                />
              </>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <Pressable
            onPress={() => {
              if (lane === 'in') void signIn();
              else if (step === 'phone') void sendCode();
              else if (step === 'code') void confirmCode();
              else void finishJoin();
            }}
            disabled={busy}
            style={[styles.cta, { backgroundColor: mart.primary, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={styles.ctaText}>
              {busy
                ? 'Please wait…'
                : lane === 'in'
                  ? 'Come in'
                  : step === 'phone'
                    ? 'Text me a code'
                    : step === 'code'
                      ? 'Confirm code'
                      : 'Save card'}
            </Text>
          </Pressable>
          {lane === 'join' && step !== 'phone' ? (
            <Pressable
              onPress={() => {
                setError(null);
                submittingCode.current = false;
                setStep(step === 'details' ? 'code' : 'phone');
              }}
              style={styles.back}
            >
              <Text style={[styles.backText, { color: mart.primary }]}>Back</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
  secure,
  autoFocus,
  maxLength,
  autoComplete,
  textContentType,
  importantForAutofill,
  inputMode,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
  secure?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  textContentType?: React.ComponentProps<typeof TextInput>['textContentType'];
  importantForAutofill?: React.ComponentProps<typeof TextInput>['importantForAutofill'];
  inputMode?: React.ComponentProps<typeof TextInput>['inputMode'];
  onSubmitEditing?: React.ComponentProps<typeof TextInput>['onSubmitEditing'];
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={MART.inkQuiet}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
        secureTextEntry={secure}
        autoCorrect={false}
        spellCheck={false}
        autoFocus={autoFocus}
        maxLength={maxLength}
        autoComplete={autoComplete}
        textContentType={textContentType}
        importantForAutofill={importantForAutofill}
        inputMode={inputMode}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,20,18,0.45)' },
  sheet: {
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.sm,
    ...ELEVATION.lifted,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: MART.borderStrong,
    marginBottom: SPACE.md,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
  },
  sheetTitle: { ...TYPE.title, flex: 1, color: MART.ink },
  sheetHint: { ...TYPE.body, marginTop: SPACE.xs, color: MART.inkMuted },
  lanes: {
    marginTop: SPACE.lg,
    flexDirection: 'row',
    padding: 3,
    backgroundColor: MART.paperSunken,
    borderRadius: RADIUS.md,
  },
  lane: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
  },
  laneOn: { backgroundColor: MART.paperElevated },
  laneText: { ...TYPE.label, fontWeight: '700', color: MART.inkMuted },
  laneTextOn: { color: MART.ink },
  body: { paddingTop: SPACE.lg, paddingBottom: SPACE.md, gap: SPACE.md },
  field: { gap: SPACE.xs },
  fieldLabel: { ...TYPE.label, fontWeight: '700', color: MART.ink },
  input: {
    minHeight: 52,
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderColor: MART.border,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paper,
    ...TYPE.body,
    fontSize: 17,
    color: MART.ink,
  },
  error: { ...TYPE.meta, color: MART.danger },
  cta: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { ...TYPE.heading, color: ON_BRAND.primary },
  back: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { ...TYPE.label, fontWeight: '700' },
});
