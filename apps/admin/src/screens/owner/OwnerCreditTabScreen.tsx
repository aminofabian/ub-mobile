import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { ApiClient } from '@kiosk/core';
import { Ionicons } from '@expo/vector-icons';
import { Field, Notice, OwnerButton, SectionHead, Segmented, type NoticeTone } from '../../components/owner-ui';
import { ActivityIndicator, Pressable } from 'react-native';
import { VerifiedBadge } from '@kiosk/staff';
import { readCustomerCard, setCustomerPhoneVerified } from '@kiosk/core';
import { fetchCustomerCard } from '../../lib/credit';
import { checkPayment, confirmPaymentWords, doubtActions, PAYMENT_CHANNELS, reminderText, type PaymentChannel } from '../../lib/credit';
import { doubtKey, forgetDoubt, recallDoubt, rememberDoubt } from '../../lib/doubt-memory';
import { createGate } from '../../lib/gate';
import { openLink } from '../../lib/open-link';
import { fetchBalance, postTabPayment } from '../../lib/owner-api';
import { centsToTyped, kesOrDash } from '../../lib/owner-money';
import { callUrl, whatsappUrl } from '../../lib/phone';
import { judgePayment, recordPayment, type PaymentOutcome, type PaymentTools } from '../../lib/record-payment';
import { useLoaded } from '../../lib/use-loaded';
import { GUTTER, HAIRLINE, MART, RADIUS, SHADOW, SPACE, tint } from '../../theme/mart';
import { Appear, MartText } from '../../theme/mart-ui';

type Props = {
  api: ApiClient;
  shopName: string;
  host: string;
  customerId: string;
  name: string;
  /** What the list said they owed when it was opened. Replaced by what the server says now as soon as that is read. */
  owedCents: number;
  phone: string | null;
  /** The signed-in person's role may record payments. */
  canRecord: boolean;
};

/** A payment that got no answer, and what looking at the tab afterwards found. */
type Doubt = Extract<PaymentOutcome, { kind: 'unsettled' }>;

/**
 * One customer's tab. The owner sees what is owed, can call or remind the customer, and records a payment that was made
 * in cash or by M-Pesa.
 *
 * Recording a payment is the one write here that moves money, and the server does not recognise a repeat of it. So it is
 * sent once, only after the owner has confirmed it, and only after the balance has been read again just before. If no
 * answer comes back, nothing is sent a second time: the screen reads the balance and says what it found, and the owner
 * decides. The screen cannot be left while the answer is awaited, and a payment whose answer was lost is remembered by
 * customer, so leaving and coming back does not forget it.
 */
export function OwnerCreditTabScreen({ api, shopName, host, customerId, name, owedCents, phone, canRecord }: Props) {
  const navigation = useNavigation();
  const balance = useLoaded(() => fetchBalance(api, customerId), 60_000);
  /** The customer as the server holds them: their numbers, and which of them are verified. */
  const card = useLoaded(() => fetchCustomerCard(api, customerId), 60_000);
  const person = card.loaded.state === 'ok' ? card.loaded.value : null;
  const [verifying, setVerifying] = useState(false);
  const [verifyProblem, setVerifyProblem] = useState<string | null>(null);
  const memoryKey = doubtKey(host, customerId);
  const [typed, setTyped] = useState('');
  const [channel, setChannel] = useState<PaymentChannel>('cash');
  const [reference, setReference] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [doubt, setDoubt] = useState<Doubt | null>(() => recallDoubt(memoryKey));
  /** What the phone is waiting on: a payment on its way, a look at the tab, or nothing. Read at once, never at the next draw. */
  const working = useRef<'send' | 'check' | null>(null);
  /** Shut while the "Record this payment?" question is on screen, so a second tap cannot put up a second one. */
  const asking = useMemo(createGate, []);

  // A payment is on its way, or the tab is being looked at for one: leaving now would hide what happened to it.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (working.current === null) return;
        event.preventDefault();
        Alert.alert(
          working.current === 'send' ? 'Still recording' : 'Still checking',
          'Wait for the answer first, so you know what became of the payment.'
        );
      }),
    [navigation]
  );

  const known = balance.loaded.state === 'ok';
  const owed = balance.loaded.state === 'ok' ? balance.loaded.value : owedCents;
  const stale = balance.loaded.state === 'failed' || (balance.loaded.state === 'ok' && balance.loaded.stale);
  const settled = known && owed === 0;
  // A reminder carries a figure in the shop's name, so it is only offered when the figure was read fresh and is more than nothing.
  const canRemind = phone !== null && known && !stale && owed > 0;

  const clearForm = () => {
    setTyped('');
    setReference('');
    setAmountError(null);
  };

  const tools = (): PaymentTools => ({
    readOwed: () => fetchBalance(api, customerId),
    send: (body) => postTabPayment(api, body),
  });

  /** Shows what became of a payment, and locks or unlocks the form to match. */
  const show = (outcome: PaymentOutcome) => {
    if (outcome.kind === 'unsettled') {
      rememberDoubt(memoryKey, outcome);
      setDoubt(outcome);
      setNotice(null);
    } else {
      forgetDoubt(memoryKey);
      setDoubt(null);
      setNotice({ tone: outcome.kind === 'recorded' ? 'ok' : outcome.kind === 'refused' ? 'bad' : outcome.tone, text: outcome.words });
      if (outcome.kind === 'recorded') clearForm();
    }
    void balance.reload();
  };

  /** One thing at a time: a payment on its way, or a check of the tab, never two. */
  const guarded = async (kind: 'send' | 'check', job: () => Promise<PaymentOutcome>) => {
    if (working.current !== null) return;
    working.current = kind;
    setBusy(true);
    setNotice(null);
    try {
      show(await job());
    } finally {
      working.current = null;
      setBusy(false);
    }
  };

  const send = () => guarded('send', () => recordPayment(tools(), { customerId, name, typed, channel, reference }));

  const checkAgain = () => {
    if (doubt === null) return Promise.resolve();
    return guarded('check', () => judgePayment(tools(), doubt));
  };

  /** The owner has looked at the tab themselves and lets the warning go. */
  const carryOn = () => {
    forgetDoubt(memoryKey);
    setDoubt(null);
    void balance.reload();
  };

  const record = () => {
    if (working.current !== null || doubt !== null || recallDoubt(memoryKey) !== null) return;
    if (!asking.enter()) return;
    const check = checkPayment(owed, typed);
    if (!check.ok) {
      asking.leave();
      setAmountError(check.words);
      return;
    }
    setAmountError(null);
    const words = confirmPaymentWords({ name, paidCents: check.cents, channel, owedAfterCents: owed - check.cents });
    const done = () => asking.leave();
    Alert.alert(
      words.title,
      words.message,
      [
        { text: 'Not yet', style: 'cancel', onPress: done },
        {
          text: 'Record payment',
          onPress: () => {
            done();
            void send();
          },
        },
      ],
      { cancelable: true, onDismiss: done }
    );
  };

  const call = () => void openLink(callUrl(phone), `This phone cannot make calls. The number is ${phone ?? 'not known'}.`);
  const remind = () =>
    void openLink(
      whatsappUrl(phone, reminderText({ shop: shopName, name, owedCents: owed })),
      `WhatsApp could not be opened for ${phone ?? 'a customer with no number'}. Call them instead.`
    );

  const toggleVerified = async (phoneId: string, verified: boolean) => {
    setVerifying(true);
    setVerifyProblem(null);
    try {
      const updated = await setCustomerPhoneVerified(api, { customerId, phoneId, verified });
      if (!updated) {
        setVerifyProblem('The server did not answer with the customer, so nothing is shown as changed.');
        return;
      }
      card.reload();
    } catch (error) {
      setVerifyProblem(error instanceof Error && error.message ? error.message : 'Could not change the verification.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets
    >
      <Appear delay={0} style={styles.who}>
        <View style={[styles.avatar, { backgroundColor: tint(MART.fallbackPrimary, 0.12) }]}>
          <MartText variant="title" color={MART.fallbackPrimary}>
            {(name.trim()[0] ?? '?').toUpperCase()}
          </MartText>
        </View>
        <View style={{ flex: 1, gap: SPACE.xxs }}>
          <MartText variant="title" numberOfLines={2}>
            {name}
          </MartText>
          <MartText variant="meta" color={MART.inkQuiet}>
            {phone ?? 'No phone number'}
          </MartText>
          {person?.verified ? <VerifiedBadge verified /> : null}
        </View>
      </Appear>

      {canRecord && person ? (
        <Appear delay={60} style={styles.verify}>
          {person.phones
            .filter((entry) => entry.phone)
            .slice(0, 1)
            .map((entry) => (
              <Pressable
                key={entry.id}
                onPress={() => void toggleVerified(entry.id, !entry.verifiedAt)}
                disabled={verifying}
                accessibilityRole="switch"
                accessibilityState={{ checked: entry.verifiedAt !== null }}
                accessibilityLabel={entry.verifiedAt ? 'Mark this customer as not verified' : 'Mark this customer as verified'}
                style={({ pressed }) => [styles.verifyRow, pressed && { opacity: 0.75 }]}
              >
                <Ionicons
                  name={entry.verifiedAt ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={entry.verifiedAt ? MART.success : MART.inkQuiet}
                />
                <View style={{ flex: 1, gap: 1 }}>
                  <MartText variant="label">Mark as verified</MartText>
                  <MartText variant="meta" color={MART.inkQuiet}>
                    {entry.verifiedAt
                      ? 'A number on this customer has been checked.'
                      : 'Check the customer is who they say they are, then mark them.'}
                  </MartText>
                </View>
                {verifying ? <ActivityIndicator color={MART.inkQuiet} /> : null}
              </Pressable>
            ))}
          {verifyProblem ? (
            <MartText variant="meta" color={MART.danger}>
              {verifyProblem}
            </MartText>
          ) : null}
        </Appear>
      ) : null}

      <Appear delay={70} style={styles.owed}>
        <View style={styles.owedHead}>
          <View style={styles.owedHeadLeft}>
            <View style={[styles.owedMark, { backgroundColor: tint(settled ? MART.success : MART.fallbackPrimary, 0.1) }]}>
              <Ionicons name={settled ? 'checkmark' : 'wallet-outline'} size={16} color={settled ? MART.success : MART.fallbackPrimary} />
            </View>
            <MartText variant="shelf" color={MART.inkQuiet}>
              {settled ? 'SETTLED' : 'OWES'}
            </MartText>
          </View>
        </View>
        <MartText variant="display" numberOfLines={1} adjustsFontSizeToFit color={MART.ink} style={styles.owedValue}>
          {kesOrDash(owed)}
        </MartText>
        {stale ? (
          <MartText variant="meta" color={MART.warning}>
            {known ? 'Could not refresh. This is the last figure read.' : 'This is the figure from the list. Could not read it fresh.'}
          </MartText>
        ) : null}
      </Appear>

      {phone ? (
        <View style={styles.actions}>
          <OwnerButton kind="quiet" label="Call" accessibilityLabel={`Call ${name}`} onPress={call} style={{ flex: 1 }} />
          {canRemind ? <OwnerButton kind="quiet" label="Remind on WhatsApp" accessibilityLabel={`Remind ${name} on WhatsApp`} onPress={remind} style={{ flex: 2 }} /> : null}
        </View>
      ) : null}

      {notice ? (
        <Notice tone={notice.tone} action={{ label: 'Dismiss', onPress: () => setNotice(null) }}>
          {notice.text}
        </Notice>
      ) : null}

      {doubt ? (
        <View style={{ gap: SPACE.md }}>
          <Notice tone="warn">{doubt.words}</Notice>
          {doubtActions(doubt.verdict).map((action) =>
            action.key === 'check' ? (
              <OwnerButton key={action.key} kind="quiet" label={action.label} busy={busy} onPress={() => void checkAgain()} />
            ) : (
              <OwnerButton key={action.key} kind="quiet" label={action.label} disabled={busy} onPress={carryOn} />
            )
          )}
        </View>
      ) : null}

      {canRecord ? (
        settled ? (
          <Notice tone="ok">Nothing is owed on this tab.</Notice>
        ) : (
          <View style={styles.form}>
            <SectionHead accent={MART.fallbackPrimary}>Record a payment</SectionHead>
            <Field
              icon="cash-outline"
              label="Amount paid (KES)"
              value={typed}
              onChangeText={(text) => {
                setTyped(text);
                setAmountError(null);
              }}
              error={amountError}
              keyboardType="decimal-pad"
              placeholder="0.00"
              editable={!busy && doubt === null}
              returnKeyType="done"
            />
            <OwnerButton
              kind="quiet"
              label="The full amount"
              disabled={busy || doubt !== null}
              onPress={() => {
                setTyped(centsToTyped(owed));
                setAmountError(null);
              }}
            />
            <Segmented options={PAYMENT_CHANNELS} value={channel} onChange={setChannel} disabled={busy || doubt !== null} />
            {channel === 'mpesa' ? (
              <Field
                label="M-Pesa code (if you have it)"
                value={reference}
                onChangeText={setReference}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={128}
                editable={!busy && doubt === null}
              />
            ) : null}
            <OwnerButton label="Record payment" busy={busy} disabled={doubt !== null} onPress={record} />
            <MartText variant="meta" color={MART.inkQuiet}>
              This lowers what {name} owes. Cash or M-Pesa that has already been paid to you is what belongs here.
            </MartText>
          </View>
        )
      ) : (
        <Notice tone="info">Your role can see this tab but not record payments.</Notice>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  verify: { gap: 6 },
  verifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  screen: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  content: {
    padding: GUTTER,
    paddingBottom: SPACE.xxxl,
    gap: SPACE.lg,
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  owed: {
    gap: SPACE.sm,
    padding: SPACE.xl,
    borderRadius: RADIUS.xl,
    backgroundColor: MART.paperElevated,
    ...HAIRLINE,
    ...SHADOW.card,
  },
  owedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  owedHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexShrink: 1 },
  owedMark: { width: 32, height: 32, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  owedValue: { fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  actions: {
    flexDirection: 'row',
    gap: SPACE.md,
  },
  form: {
    gap: SPACE.md,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    ...HAIRLINE,
    ...SHADOW.card,
  },
});
