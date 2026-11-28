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
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
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
import { doneFeel, failFeel, stepFeel } from '../lib/haptics';
import { FONT, GUTTER, MART, martFromTenant, onFill, RADIUS, SETTLE, SPACE, TYPE } from '../theme/mart';
import { Capsule } from './Capsule';
import { Field } from './Field';
import { SHEET_SCRIM, SheetPanel } from './SheetPanel';
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

/**
 * Two or three choices in one capsule. The chosen one is a filled lobe that slides to the next choice.
 * `fill` is the lobe's colour: ink by default, or the shop's colour.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  fill = MART.ink,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  fill?: string;
  /** What the group chooses, for a screen reader. */
  label?: string;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const slot = width > 0 ? (width - SEG_PAD * 2) / options.length : 0;
  const at = useSharedValue(index);
  useEffect(() => {
    at.value = withSpring(index, SETTLE);
  }, [at, index]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: at.value * slot }] }));
  const on = onFill(fill);

  return (
    <View
      style={segStyles.track}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {slot > 0 ? (
        <Animated.View pointerEvents="none" style={[segStyles.here, { width: slot, backgroundColor: fill }, slide]} />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!selected) stepFeel();
              onChange(option.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            style={segStyles.slot}
          >
            <Text style={[segStyles.text, { color: selected ? on.primary : MART.ink }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const SEG_PAD = 4;

const segStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: SEG_PAD,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
  },
  here: {
    position: 'absolute',
    top: SEG_PAD,
    bottom: SEG_PAD,
    left: SEG_PAD,
    borderRadius: RADIUS.pill,
  },
  slot: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...TYPE.label,
  },
});

const LANES = [
  { value: 'join', label: 'Join' },
  { value: 'in', label: 'Sign in' },
] as const;

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

  // One buzz for each thing that goes wrong, and one when the shopper is in.
  useEffect(() => {
    if (error) failFeel();
  }, [error]);

  function authed() {
    doneFeel();
    onAuthed();
  }

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
      authed();
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
      setError('Add your name so the shop knows who to call.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Add an email for receipts and your account.');
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
          setError('Check your email to confirm your account, then sign in. Your details are saved on this phone.');
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
      authed();
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
        ? 'Sign in'
        : 'Create your account';

  const hint =
    lane === 'in'
      ? 'Same email as the website. PIN or password.'
      : step === 'phone'
        ? 'We’ll text a 4-digit code to this line.'
        : step === 'code'
          ? `Code sent to ${masked || formatPhoneDisplay(phone)}. We’ll fill it from the text.`
          : 'Email and where to deliver. That’s the last step.';
  const action =
    lane === 'in'
      ? 'Sign in'
      : step === 'phone'
        ? 'Text me a code'
        : step === 'code'
          ? 'Confirm code'
          : 'Create account';
  // A step with one field says what is wrong under that field; a step with several says it under them all.
  const oneField = lane === 'join' && step !== 'details';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.dim} onPress={onClose} accessibilityLabel="Close" />
        <SheetPanel
          title={title}
          hint={hint}
          onClose={onClose}
          style={{
            maxHeight: sheetMax,
            marginBottom: keyboardHeight,
            paddingBottom: SPACE.lg + (keyboardHeight > 0 ? SPACE.sm : insets.bottom),
          }}
        >
          <View style={styles.lanes}>
            <Segmented
              options={LANES}
              value={lane}
              label="Join or sign in"
              onChange={(next) => {
                setLane(next);
                if (next === 'join') resetJoin();
                else setError(null);
              }}
            />
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
            onContentSizeChange={() => {
              if (keyboardHeight > 0) scrollRef.current?.scrollToEnd({ animated: true });
            }}
          >
            {lane === 'in' ? (
              <>
                <Field
                  {...PLAIN}
                  label="Email"
                  icon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="username"
                />
                <Field
                  {...PLAIN}
                  label="PIN or password"
                  icon="lock-closed-outline"
                  value={secret}
                  onChangeText={setSecret}
                  secureTextEntry
                  keyboardType={looksLikeStaffPin(secret) ? 'number-pad' : 'default'}
                />
              </>
            ) : step === 'phone' ? (
              <Field
                {...PLAIN}
                label="Phone"
                icon="call-outline"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="07…"
                autoComplete="tel"
                textContentType="telephoneNumber"
                error={error}
              />
            ) : step === 'code' ? (
              <Field
                {...PLAIN}
                label="4-digit code"
                value={code}
                onChangeText={onCodeChange}
                keyboardType="number-pad"
                placeholder="••••"
                autoFocus
                maxLength={4}
                autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                textContentType="oneTimeCode"
                importantForAutofill="yes"
                inputMode="numeric"
                onSubmitEditing={() => void confirmCode()}
                error={error}
                style={styles.code}
              />
            ) : (
              <>
                <Field
                  {...PLAIN}
                  label="Full name"
                  icon="person-outline"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoComplete="name"
                />
                <Field
                  {...PLAIN}
                  label="Email"
                  icon="mail-outline"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoComplete="email"
                />
                <Field
                  {...PLAIN}
                  label="Estate / street"
                  icon="location-outline"
                  value={shipping}
                  onChangeText={setShipping}
                  placeholder="e.g. Mirema Drive, opposite the church"
                />
              </>
            )}

            {error && !oneField ? (
              <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <Capsule
              label={action}
              chip="arrow-forward"
              fill={mart.primary}
              busy={busy}
              onPress={() => {
                if (lane === 'in') void signIn();
                else if (step === 'phone') void sendCode();
                else if (step === 'code') void confirmCode();
                else void finishJoin();
              }}
            />
            {lane === 'join' && step !== 'phone' ? (
              <Pressable
                onPress={() => {
                  setError(null);
                  submittingCode.current = false;
                  setStep(step === 'details' ? 'code' : 'phone');
                }}
                accessibilityRole="button"
                accessibilityLabel="Back"
                style={({ pressed }) => [styles.back, pressed && styles.pressed]}
              >
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            ) : null}
          </View>
        </SheetPanel>
      </View>
    </Modal>
  );
}

/** What every field in this sheet shares: nothing is corrected, capitalised or spell-checked for the shopper. */
const PLAIN = {
  autoCapitalize: 'none',
  autoCorrect: false,
  spellCheck: false,
  returnKeyType: 'done',
} as const;

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: SHEET_SCRIM },
  lanes: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xs,
  },
  scroll: {
    flexShrink: 1,
  },
  body: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.md,
    gap: SPACE.lg,
  },
  code: {
    fontFamily: FONT.black,
    fontSize: 30,
    letterSpacing: 14,
    textAlign: 'center',
  },
  errorBox: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.dangerSurface,
  },
  error: { ...TYPE.label, color: MART.danger },
  actions: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.sm,
  },
  back: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  backText: { ...TYPE.label, color: MART.ink, textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
});
