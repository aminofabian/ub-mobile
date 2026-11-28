import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getOrCreateTillDeviceId,
  parsePairingCode,
  parsePairingScan,
  previewPairing,
  redeemPairing,
  rememberTillRegistered,
  type PairingPreview,
  type TenantContext,
} from '@kiosk/core';
import { FONT, MART, onFill, RADIUS, SPACE, tint, TYPE } from '../theme/mart';
import { MartButton, MartText, Screen } from '../theme/mart-ui';
import { Field } from '../theme/Field';
import { Entrance } from '../theme/Entrance';
import { describeCodeProblem, describePairingFailure, describeWrongShop, isSameShop } from '../lib/pair-copy';

export interface PairScannerProps {
  /** The text of a QR code the camera read. */
  onScanned: (text: string) => void;
  onCancel: () => void;
}

/** Draws the camera. Only apps that ship the camera module give one; the others type the code. */
export type PairScannerRenderer = (props: PairScannerProps) => React.ReactNode;

interface PairScreenProps {
  baseURL: string;
  /** The open shop: a code for any other shop is refused, never followed. */
  tenant: TenantContext;
  renderScanner?: PairScannerRenderer;
  onPaired: (branchName: string) => void;
  onCancel: () => void;
}

type Step = 'enter' | 'scan' | 'confirm';

export function PairScreen({ baseURL, tenant, renderScanner, onPaired, onCancel }: PairScreenProps) {
  const [step, setStep] = useState<Step>('enter');
  const [text, setText] = useState('');
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<PairingPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  // A second tap, or a QR read twice, must not send a second request while the first is out.
  const sending = useRef(false);

  const brand = MART.fallbackPrimary;
  const on = onFill(brand);
  const initials = useMemo(() => {
    const parts = tenant.displayName.trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] ?? 'K').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
  }, [tenant.displayName]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const look = async (candidate: string) => {
    if (busy || sending.current) return;
    const parsed = parsePairingCode(candidate);
    if (parsed.kind !== 'ok') {
      setMessage(describeCodeProblem(parsed));
      setStep('enter');
      return;
    }
    sending.current = true;
    setBusy(true);
    setMessage(null);
    const found = await previewPairing(parsed.code, baseURL);
    sending.current = false;
    if (!mounted.current) return;
    setBusy(false);
    if (found.kind !== 'found') {
      setMessage(describePairingFailure(found));
      setStep('enter');
      return;
    }
    if (!isSameShop(found.preview.shop, tenant, found.preview.shopId)) {
      setMessage(describeWrongShop(found.preview.shopName, tenant.displayName));
      setStep('enter');
      return;
    }
    setCode(parsed.code);
    setPreview(found.preview);
    setStep('confirm');
  };

  const scanned = (scan: string) => {
    // The camera closes as soon as it has read something. Left open it would sit frozen on the code while the
    // server is asked, with nothing to say what is happening; the form shows "Checking..." and, if the lookup
    // fails, the reason.
    setStep('enter');
    const fromQr = parsePairingScan(scan);
    if (!fromQr) {
      setMessage("That QR code isn't a pairing code. Scan the one your manager made for this phone.");
      return;
    }
    setText(fromQr);
    void look(fromQr);
  };

  const pairNow = async () => {
    if (!preview || busy || sending.current) return;
    sending.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const deviceKey = await getOrCreateTillDeviceId(tenant.businessId);
      if (!deviceKey.trim()) {
        // This phone could not make or read its own till id. A new code would not help; starting the app again might.
        sending.current = false;
        if (!mounted.current) return;
        setBusy(false);
        setMessage("Couldn't set this phone up as a till. Close the app, open it again and try again.");
        return;
      }
      const result = await redeemPairing(code, deviceKey, baseURL);
      sending.current = false;
      if (!mounted.current) return;
      if (result.kind !== 'paired') {
        setBusy(false);
        setMessage(describePairingFailure(result));
        // The code is still good when the problem was the connection or the pace: the person taps again. For any
        // other answer it is used up or wrong, and a new one has to be typed.
        setStep(result.kind === 'offline' || result.kind === 'rate_limited' ? 'confirm' : 'enter');
        return;
      }
      // The server has paired the phone. Not being able to note it here must not look like a failure.
      await rememberTillRegistered(tenant.businessId, preview.branchId).catch(() => undefined);
      onPaired(preview.branchName);
    } catch {
      sending.current = false;
      if (!mounted.current) return;
      setBusy(false);
      setMessage("Couldn't pair this phone. Try again.");
    }
  };

  if (step === 'scan' && renderScanner) {
    return <View style={styles.fill}>{renderScanner({ onScanned: scanned, onCancel: () => setStep('enter') })}</View>;
  }

  const back = step === 'confirm' ? () => setStep('enter') : onCancel;
  const backLabel = step === 'confirm' ? 'Back' : 'Cancel';

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Entrance delay={0} style={[styles.pass, { backgroundColor: brand }]}>
          <View style={[styles.glow, { backgroundColor: on.wash }]} pointerEvents="none" />
          <View style={[styles.orb, styles.orbOne, { backgroundColor: on.wash }]} pointerEvents="none" />
          <View style={[styles.orb, styles.orbTwo, { backgroundColor: on.hairline }]} pointerEvents="none" />
          <View style={styles.passTop}>
            <View style={styles.passBrand}>
              <View style={[styles.passRing, { borderColor: on.hairline }]}>
                <View style={[styles.passMark, { backgroundColor: on.primary }]}>
                  <MartText style={[styles.passMonogram, { color: brand }]}>{initials}</MartText>
                </View>
              </View>
              <MartText variant="shelf" color={on.secondary} numberOfLines={1} style={styles.passStore}>
                {tenant.displayName.toUpperCase()}
              </MartText>
            </View>
            <Pressable
              onPress={back}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              hitSlop={8}
              style={({ pressed }) => [
                styles.storeChip,
                { borderColor: on.hairline, backgroundColor: on.wash },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="chevron-back" size={14} color={on.primary} />
              <MartText variant="shelf" color={on.primary} style={styles.storeChipText}>
                {backLabel}
              </MartText>
            </Pressable>
          </View>
          <MartText variant="display" color={on.primary} style={styles.passTitle}>
            Pair this phone
          </MartText>
          <MartText variant="body" color={on.secondary} style={styles.passHint}>
            {step === 'confirm' ? 'Check the details, then confirm.' : 'Turn this phone into a till for the shop.'}
          </MartText>
        </Entrance>

        <Entrance delay={90} style={styles.formBody}>
          {step === 'confirm' && preview ? (
            <View style={styles.summary} accessibilityLabel="Pairing details">
              <View style={[styles.summaryBadge, { backgroundColor: tint(brand, 0.12) }]}>
                <Ionicons name="phone-portrait-outline" size={22} color={brand} />
              </View>
              <MartText variant="meta" color={MART.inkQuiet}>
                This phone will be a till at
              </MartText>
              <MartText variant="title">{preview.shopName}</MartText>
              <View style={styles.summaryRows}>
                <SummaryRow icon="git-branch-outline" label="Branch" value={preview.branchName} />
                <SummaryRow icon="person-outline" label="You sign in as" value={preview.roleName} />
                {preview.tillName ? (
                  <SummaryRow icon="pricetag-outline" label="Till name" value={preview.tillName} />
                ) : null}
              </View>
            </View>
          ) : (
            <Field
              on="tile"
              label="Pairing code"
              icon="key-outline"
              placeholder="Enter the code"
              value={text}
              onChangeText={(value) => {
                setText(value);
                if (message) setMessage(null);
              }}
              hint={`Your manager made this code${renderScanner ? ', or scan their QR code below' : ' for this phone'}.`}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              maxLength={24}
              returnKeyType="go"
              onSubmitEditing={() => void look(text)}
              editable={!busy}
              style={styles.codeInput}
              accessibilityLabel="Pairing code"
            />
          )}

          {message ? (
            <View style={styles.problemBox} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle-outline" size={18} color={MART.danger} />
              <MartText variant="body" color={MART.danger} style={styles.problemText}>
                {message}
              </MartText>
            </View>
          ) : null}

          {step === 'confirm' ? (
            <MartButton
              label={busy ? 'Pairing…' : 'Pair this phone'}
              busy={busy}
              onPress={() => void pairNow()}
              disabled={busy}
              style={styles.submit}
            />
          ) : (
            <>
              <MartButton
                label={busy ? 'Checking…' : 'Continue'}
                busy={busy}
                onPress={() => void look(text)}
                disabled={busy || text.trim().length === 0}
                style={styles.submit}
              />
              {renderScanner ? (
                <MartButton label="Scan QR code" kind="quiet" onPress={() => setStep('scan')} disabled={busy} />
              ) : null}
            </>
          )}
        </Entrance>

        <Entrance delay={180} style={styles.footer}>
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

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={18} color={MART.inkQuiet} />
      <MartText variant="meta" color={MART.inkQuiet} style={styles.summaryRowLabel}>
        {label}
      </MartText>
      <MartText variant="label" numberOfLines={1} style={styles.summaryRowValue}>
        {value}
      </MartText>
    </View>
  );
}

const EDGE = SPACE.xxl; // 28

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: { paddingHorizontal: 0, paddingBottom: SPACE.lg },
  form: { flexGrow: 1 },
  pass: {
    paddingHorizontal: EDGE,
    paddingTop: 72, // clears the status bar / Dynamic Island without a SafeAreaProvider dependency
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
  glow: { position: 'absolute', width: 320, height: 320, borderRadius: 999, top: -160, left: -80, opacity: 0.5 },
  orb: { position: 'absolute', borderRadius: 999 },
  orbOne: { width: 180, height: 180, top: -70, right: -50 },
  orbTwo: { width: 110, height: 110, top: 40, right: 60 },
  passTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
    marginBottom: SPACE.lg,
  },
  passBrand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  passRing: { width: 56, height: 56, borderRadius: 999, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  passMark: { width: 44, height: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  passMonogram: { ...TYPE.label, fontFamily: FONT.black },
  passStore: { flex: 1 },
  passTitle: {},
  passHint: {},
  storeChip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xxs,
    justifyContent: 'center',
    paddingHorizontal: SPACE.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
  },
  storeChipText: { letterSpacing: 0.2 },
  pressed: { opacity: 0.6 },
  formBody: {
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
  codeInput: { letterSpacing: 2 },
  summary: {
    gap: SPACE.sm,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paper,
  },
  summaryBadge: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.xs,
  },
  summaryRows: { gap: SPACE.sm, marginTop: SPACE.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  summaryRowLabel: { width: 112 },
  summaryRowValue: { flex: 1, textAlign: 'right' },
  problemBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.dangerSurface,
  },
  problemText: { flex: 1 },
  submit: {
    marginTop: SPACE.xs,
    shadowColor: MART.fallbackPrimary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  footer: { marginTop: 'auto', paddingTop: SPACE.xxl, alignItems: 'center' },
  footerMark: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  footerDot: { width: 10, height: 10, borderRadius: 999 },
});
