import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Text, theme } from '@kiosk/ui';
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
import { AuthBackBar } from '../components/AuthBackBar';
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

  return (
    <View style={styles.container}>
      <AuthBackBar onBack={step === 'confirm' ? () => setStep('enter') : onCancel} backLabel={step === 'confirm' ? 'Back' : 'Cancel'} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="h1" accessibilityRole="header">
          Pair this phone
        </Text>
        <Text variant="muted" style={styles.shop}>
          {tenant.displayName}
        </Text>

        {step === 'confirm' && preview ? (
          <View style={styles.card} accessibilityLabel="Pairing details">
            <Text variant="caption" style={styles.cardLabel}>
              This phone will be a till at
            </Text>
            <Text variant="h2">{preview.shopName}</Text>
            <Text variant="body" style={styles.cardLine}>
              Branch: {preview.branchName}
            </Text>
            <Text variant="body" style={styles.cardLine}>
              You will sign in as: {preview.roleName}
            </Text>
            {preview.tillName ? (
              <Text variant="body" style={styles.cardLine}>
                Till name: {preview.tillName}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            <Text variant="body" style={styles.help}>
              Enter the code your manager gave you{renderScanner ? ', or scan their QR code' : ''}.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Pairing code"
              value={text}
              onChangeText={(value) => {
                setText(value);
                if (message) setMessage(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              maxLength={24}
              returnKeyType="go"
              onSubmitEditing={() => void look(text)}
              editable={!busy}
              accessibilityLabel="Pairing code"
            />
          </>
        )}

        {message ? (
          <Text variant="body" style={styles.problem} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}

        {step === 'confirm' ? (
          <Button title={busy ? 'Pairing...' : 'Pair this phone'} onPress={() => void pairNow()} disabled={busy} />
        ) : (
          <>
            <Button title={busy ? 'Checking...' : 'Continue'} onPress={() => void look(text)} disabled={busy || text.trim().length === 0} />
            {renderScanner ? (
              <Button title="Scan QR code" variant="secondary" onPress={() => setStep('scan')} disabled={busy} style={styles.secondary} />
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  content: { flexGrow: 1, justifyContent: 'center' },
  shop: { marginBottom: theme.spacing.lg },
  help: { marginBottom: theme.spacing.md, color: theme.colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    fontSize: 18,
    minHeight: 48,
    letterSpacing: 2,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  cardLabel: { color: theme.colors.textMuted, marginBottom: theme.spacing.xs },
  cardLine: { marginTop: theme.spacing.sm },
  problem: { color: theme.colors.danger, marginBottom: theme.spacing.md },
  secondary: { marginTop: theme.spacing.md },
});
