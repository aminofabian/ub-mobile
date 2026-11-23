import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Text, theme } from '@kiosk/ui';
import { initiateStkPush, waitForStk } from '@kiosk/payments';
import { REFUSED, holdWhileSending, outbox } from '@kiosk/offline';
import { generateIdempotencyKey } from '@kiosk/core';
import type { ApiClient, SetupContext } from '@kiosk/core';
import { createSale, ensureCustomerByPhone, findCustomerByPhone } from '../api/pos-api';
import { describeLookupFailure } from '../lib/lookup-failure';
import { formatMoney, fromCents, totalCents as basketTotal } from '../lib/money';
import { checkCash, sharesFor, type PayMode } from '../lib/pay-inputs';
import { normalizeKenyanPhone } from '../lib/phone';
import { describeQueuedSale } from '../lib/queued-sale-notice';
import {
  buildSaleBody,
  createKeyKeeper,
  customerKey,
  describeKeptRefusal,
  describeSaleRefusal,
  describeTotalMismatch,
  leaveGuard,
  saveThenSend,
  totalMismatch,
} from '../lib/sale-flow';
import { saleLabel } from '../lib/sale-summary';
import { serverWords } from '../lib/server-words';
import { PUSH_TIMEOUT_MS, PushTimedOut, describePushFailure, describeStkOutcome } from '../lib/stk-step';
import { cashSuggestions, describePlanProblem, mpesaCodeLooksOdd, normalizeMpesaCode, planPayments } from '../lib/tender';
import { withTimeout } from '../lib/with-timeout';
import { usePosStore } from '../store/pos-store';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Payment'> & {
  api: ApiClient;
  branchId: string;
  /** What a "set this up first" answer needs to say where the step is finished. */
  setupContext: SetupContext;
};

/** Where the M-Pesa prompt has got to. */
type Stk =
  | { stage: 'idle' }
  | { stage: 'sending' }
  | { stage: 'waiting'; id: string }
  /** A prompt is out and nobody knows if it was paid. */
  | { stage: 'unconfirmed'; id: string; message: string }
  /** The server did not say whether the prompt went out. */
  | { stage: 'maybe_sent'; message: string }
  /** Known: no prompt is out, or M-Pesa said it did not go through. */
  | { stage: 'failed'; message: string }
  | { stage: 'wrong_amount'; message: string }
  | { stage: 'code_needed'; message: string }
  | { stage: 'paid'; code: string };

const MODES: { mode: PayMode; title: string }[] = [
  { mode: 'cash', title: 'Cash' },
  { mode: 'mpesa', title: 'M-Pesa' },
  { mode: 'split', title: 'Cash + M-Pesa' },
  { mode: 'credit', title: 'Credit' },
];

/** A sale never waits longer than this to find out who the M-Pesa number belongs to. */
const LINK_TIMEOUT_MS = 4_000;

export function PaymentScreen({ navigation, api, branchId, setupContext }: Props) {
  const { cart, clearCart, setLastSale } = usePosStore();
  const total = useMemo(() => basketTotal(cart), [cart]);

  const [mode, setMode] = useState<PayMode>('cash');
  const [handedText, setHandedText] = useState('');
  const [mpesaText, setMpesaText] = useState('');
  const [phone, setPhone] = useState('');
  const [codeText, setCodeText] = useState('');
  const [creditPhone, setCreditPhone] = useState('');
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [stk, setStk] = useState<Stk>({ stage: 'idle' });
  const [busy, setBusy] = useState(false);

  // One tap at a time: a second tap while a sale or a prompt is on its way would send it twice.
  const busyRef = useRef(false);
  // One key per sale on this screen. The same sale is always sent under it, however often it is tried.
  const keyFor = useRef(createKeyKeeper(generateIdempotencyKey)).current;
  const waiting = useRef<AbortController | null>(null);
  // Whose sale it is, worked out once and kept, so that trying a sale again is the same sale. `who` is what decided it
  // (the way of paying, the number, the credit customer): when that changes the customer is worked out again.
  const attempt = useRef<{ who: string; customerId: string | null } | null>(null);
  // The sale is being saved on the phone and sent. The screen cannot be left until the answer is in.
  const saving = useRef(false);
  const finished = useRef(false);
  const mounted = useRef(true);
  // The customer's M-Pesa prompt was paid and confirmed. A refusal after that must never lead to another prompt.
  const mpesaPaid = useRef(false);

  // What the async steps read when they get there, so a step that started a moment ago never works from old inputs.
  const latest = useRef({ mode, total, handedText, mpesaText, codeText, customer, cart, phone });
  latest.current = { mode, total, handedText, mpesaText, codeText, customer, cart, phone };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      waiting.current?.abort();
    };
  }, []);

  // Money is in play from the moment a prompt is asked for until the sale is recorded. Leaving then can leave the
  // customer's payment without a sale.
  const holdsMoney = stk.stage !== 'idle' && stk.stage !== 'failed';
  // The way of paying cannot change while a prompt may be out: that would hide a payment the customer may make.
  const modeLocked =
    stk.stage === 'sending' ||
    stk.stage === 'waiting' ||
    stk.stage === 'unconfirmed' ||
    stk.stage === 'maybe_sent' ||
    stk.stage === 'code_needed' ||
    stk.stage === 'wrong_amount' ||
    stk.stage === 'paid';

  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      const verdict = leaveGuard({ finished: finished.current, saving: saving.current, holdsMoney });
      if (verdict === 'allow') return;
      event.preventDefault();
      if (verdict === 'wait') {
        // The sale is on its way. Leaving now would lose its answer, and ringing it up again would record it twice.
        Alert.alert('Saving the sale', 'The sale is being saved. Wait a moment, then go back if you need to.');
        return;
      }
      Alert.alert(
        'A payment is in progress',
        "Leaving now can leave the customer's M-Pesa payment without a sale. Stay and finish it, or leave anyway.",
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave anyway', style: 'destructive', onPress: () => navigation.dispatch(event.data.action) },
        ]
      );
    });
  }, [navigation, holdsMoney]);

  const say = (title: string, message: string) => Alert.alert(title, message);

  const shares = total === null ? null : sharesFor({ mode, totalCents: total, handedText, mpesaText, code: codeText });
  const cashDue = shares && shares.ok ? shares.cashCents : 0;
  const cash = cashDue > 0 ? checkCash(cashDue, handedText) : null;
  const prompting = stk.stage === 'sending' || stk.stage === 'waiting';
  const paidCode = stk.stage === 'paid' ? stk.code : null;

  /** The customer behind an M-Pesa number, if the server answers quickly. A sale never fails or waits long for it. */
  const linkByPhone = async (raw: string): Promise<string | null> => {
    const number = normalizeKenyanPhone(raw);
    if (!number) return null;
    try {
      const hit = await withTimeout(() => ensureCustomerByPhone(api, number), LINK_TIMEOUT_MS, () => new Error('slow'));
      return hit?.id ?? null;
    } catch {
      return null;
    }
  };

  /** Records the sale. Never loses it: it is saved on the phone before the server is asked. */
  const completeSale = async (codeOverride?: string) => {
    if (busyRef.current) return;
    const now = latest.current;
    if (now.total === null || now.cart.length === 0) return;
    const chosen = sharesFor({
      mode: now.mode,
      totalCents: now.total,
      handedText: now.handedText,
      mpesaText: now.mpesaText,
      code: codeOverride ?? now.codeText,
    });
    if (!chosen.ok) {
      say('Check the payment', chosen.message);
      return;
    }
    const plan = planPayments({ totalCents: now.total, tenders: chosen.tenders, customerId: now.customer?.id ?? null });
    if (!plan.ok) {
      say('Check the payment', describePlanProblem(plan));
      return;
    }

    busyRef.current = true;
    saving.current = true;
    setBusy(true);
    try {
      // Who the sale is for is worked out once and kept, so that trying the same sale again is the same sale. It is
      // worked out again when what decided it changes (the way of paying, the number, the credit customer): a customer
      // found for one way of paying is never carried into another.
      const who = customerKey({
        mode: now.mode,
        phone: normalizeKenyanPhone(now.phone),
        creditCustomerId: now.customer?.id ?? null,
      });
      let mine = attempt.current;
      if (!mine || mine.who !== who) {
        const customerId =
          now.mode === 'credit' ? (now.customer?.id ?? null) : now.mode === 'cash' ? null : await linkByPhone(now.phone);
        mine = { who, customerId };
        attempt.current = mine;
      }
      const body = buildSaleBody({
        branchId,
        cart: now.cart,
        payments: plan.payments,
        cashReceived: plan.cashReceived,
        customerId: mine.customerId,
        soldAt: new Date(),
      });
      const key = keyFor(body);
      const result = await saveThenSend({
        save: () =>
          outbox.enqueue({ id: key, method: 'POST', path: '/api/v1/sales', body, idempotencyKey: key, label: saleLabel(now.cart) }),
        send: () => {
          // The sync engine leaves this sale alone while this request is on its way, however long that takes.
          const release = holdWhileSending(key);
          const request = createSale(api, body, key);
          request.then(release, release);
          return request;
        },
        forget: () => outbox.remove(key),
        // A customer who has paid by M-Pesa has paid: the sale is kept for a manager even if the server turns it down.
        keepRefused: mpesaPaid.current,
        park: (error) =>
          outbox.update(key, {
            conflictType: REFUSED,
            lastError: serverWords(error instanceof Error ? error.message : '') || 'The server did not accept this sale.',
          }),
      });

      // The cart is only cleared if it is still the one that was sold, and the screen is only steered if it is still here.
      const clearIfSame = () => {
        if (usePosStore.getState().cart === now.cart) clearCart();
      };
      const steer = (go: () => void) => {
        if (mounted.current) go();
      };

      if (result.kind === 'sent') {
        finished.current = true;
        setLastSale(result.sale);
        clearIfSame();
        const toReceipt = () =>
          steer(() => navigation.replace('Receipt', { changeCents: plan.changeCents, soldAt: body.clientSoldAt }));
        // The server may price a sale differently from the till (an active discount): the cashier is told before the
        // receipt, because the customer may be owed money back.
        const mismatch = totalMismatch(now.total, result.sale.grandTotal);
        if (mismatch) {
          const notice = describeTotalMismatch(now.total, mismatch);
          Alert.alert(notice.title, notice.body, [{ text: 'OK', onPress: toReceipt }], { cancelable: false });
        } else {
          toReceipt();
        }
      } else if (result.kind === 'saved') {
        // The sale is kept, so the person is told what happened and never to ring it up again: a second ring would be
        // recorded as a second sale once the first one is sent.
        const notice = describeQueuedSale(result.error, setupContext);
        finished.current = true;
        clearIfSame();
        Alert.alert(notice.title, notice.body, [
          ...(notice.action === 'open_shift'
            ? [{ text: 'Open shift', onPress: () => steer(() => navigation.navigate('Shift')) }]
            : []),
          { text: 'OK', onPress: () => steer(() => navigation.navigate('Pos')) },
        ]);
      } else if (result.kind === 'refused') {
        attempt.current = null;
        if (result.kept) {
          // The customer has paid and the sale is parked on the phone for a manager: the cart is done with, and must not
          // be rung up again, because that would be a second sale with the same M-Pesa payment.
          const notice = describeKeptRefusal(result.error);
          finished.current = true;
          clearIfSame();
          Alert.alert(notice.title, notice.body, [{ text: 'OK', onPress: () => steer(() => navigation.navigate('Pos')) }], {
            cancelable: false,
          });
        } else {
          // Nothing was recorded and nothing is kept. The basket stays, so the cashier can put it right and try again.
          say('Sale not taken', describeSaleRefusal(result.error, { mpesaPaid: mpesaPaid.current }));
        }
      } else {
        say(
          'Sale not saved',
          'This sale could not be sent and could not be saved on this phone. The basket is still here. Try again, or write the sale down before you leave.'
        );
      }
    } finally {
      busyRef.current = false;
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  /** Waits for the customer to pay a prompt that was sent, and carries on from the answer. */
  const waitForPayment = async (id: string, mpesaCents: number, andComplete: boolean) => {
    const controller = new AbortController();
    waiting.current = controller;
    setStk({ stage: 'waiting', id });
    const outcome = await waitForStk(api, id, { signal: controller.signal });
    if (waiting.current === controller) waiting.current = null;
    if (!mounted.current) return;

    const step = describeStkOutcome(outcome, mpesaCents);
    switch (step.step) {
      case 'paid':
        mpesaPaid.current = true;
        setStk({ stage: 'paid', code: step.code });
        setCodeText(step.code);
        if (andComplete) {
          busyRef.current = false;
          await completeSale(step.code);
        }
        return;
      case 'code_needed':
      case 'wrong_amount':
      case 'failed':
        setStk({ stage: step.step, message: step.message });
        return;
      case 'unconfirmed':
        setStk({ stage: 'unconfirmed', id, message: step.message });
        return;
    }
  };

  const sendPrompt = async () => {
    if (busyRef.current) return;
    const now = latest.current;
    if (now.total === null) return;
    const chosen = sharesFor({ mode: now.mode, totalCents: now.total, handedText: '', mpesaText: now.mpesaText, code: 'PLACEHOLDER' });
    if (!chosen.ok) {
      say('Check the payment', chosen.message);
      return;
    }
    const number = normalizeKenyanPhone(now.phone);
    if (!number) {
      say("Customer's number", "Enter the customer's M-Pesa number, like 0712 345 678.");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setStk({ stage: 'sending' });
    try {
      let sent;
      try {
        // Each prompt is its own request with its own key. The server does not recognise a repeat, so a repeat would
        // be a second prompt on the customer's phone: it is only ever sent once the first is known not to be out.
        sent = await withTimeout(
          () =>
            initiateStkPush(api, {
              phoneNumber: number,
              amount: fromCents(chosen.mpesaCents),
              idempotencyKey: generateIdempotencyKey(),
            }),
          PUSH_TIMEOUT_MS,
          () => new PushTimedOut()
        );
      } catch (error) {
        const failure = describePushFailure(error);
        setStk(failure.sent === 'no' ? { stage: 'failed', message: failure.message } : { stage: 'maybe_sent', message: failure.message });
        return;
      }
      if (!sent.accepted || !sent.checkoutRequestId) {
        const said = serverWords(sent.message);
        setStk({ stage: 'failed', message: said ? `The prompt was not sent: ${said}` : 'The prompt was not sent.' });
        return;
      }
      await waitForPayment(sent.checkoutRequestId, chosen.mpesaCents, now.mode === 'mpesa' && chosen.cashCents === 0);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const checkAgain = async () => {
    if (busyRef.current || stk.stage !== 'unconfirmed' || total === null) return;
    const id = stk.id;
    const chosen = sharesFor({ mode, totalCents: total, handedText: '', mpesaText, code: 'PLACEHOLDER' });
    if (!chosen.ok) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await waitForPayment(id, chosen.mpesaCents, mode === 'mpesa' && chosen.cashCents === 0);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const stopWaiting = () => waiting.current?.abort();

  const startOver = (cause: 'unpaid' | 'wrong_amount' = 'unpaid') =>
    Alert.alert(
      'Start the M-Pesa payment again?',
      cause === 'wrong_amount'
        ? 'The customer has already paid M-Pesa a different amount. That money will not be matched to this sale: your manager has to sort it out. Only start again once they know.'
        : 'If the customer pays the first prompt after this, that money will not be matched to a sale. Only do this once you are sure they did not pay.',
      [
        { text: 'Keep waiting', style: 'cancel' },
        { text: 'Start again', style: 'destructive', onPress: () => setStk({ stage: 'idle' }) },
      ]
    );

  const findCustomer = async () => {
    if (busyRef.current) return;
    if (!normalizeKenyanPhone(creditPhone)) {
      say("Customer's number", "Enter the customer's phone number, like 0712 345 678.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const match = await findCustomerByPhone(api, creditPhone);
      if (match?.kind === 'one') setCustomer({ id: match.customer.id, name: match.customer.name });
      else if (match?.kind === 'several')
        say('More than one customer', 'Two or more customers have this number, so the till cannot tell who owes. Sort it out on the web first.');
      else say('No customer found', 'There is no customer with that number. Add them on the web first, then try again.');
    } catch (error) {
      const notice = describeLookupFailure(error);
      say(notice.title, notice.body);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const pickMode = (next: PayMode) => {
    if (busy || modeLocked) return;
    setMode(next);
    setStk({ stage: 'idle' });
  };

  if (total === null || cart.length === 0) {
    return (
      <View style={styles.container}>
        <Text variant="h1">Payment</Text>
        <Text variant="body">
          {cart.length === 0
            ? 'The basket is empty. Go back and add something to sell.'
            : 'An item in the basket has no price or quantity. Go back and take it out.'}
        </Text>
        <Button title="Back to the basket" onPress={() => navigation.goBack()} style={styles.gap} />
      </View>
    );
  }

  const mpesaMode = mode === 'mpesa' || mode === 'split';
  const mpesaShare = shares && shares.ok ? shares.mpesaCents : 0;
  const manualCode = normalizeMpesaCode(codeText);
  const canPrompt = mpesaMode && (stk.stage === 'idle' || stk.stage === 'failed');
  const needsCode = mpesaMode && stk.stage !== 'paid' && !prompting && stk.stage !== 'wrong_amount';
  const completeLabel = busy ? 'Saving...' : mode === 'credit' ? 'Put on credit' : 'Complete sale';

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text variant="h1">Payment</Text>
      <Text variant="h2">Total: {formatMoney(total)}</Text>

      <View style={styles.methods}>
        {MODES.map((option) => (
          <TouchableOpacity
            key={option.mode}
            onPress={() => pickMode(option.mode)}
            accessibilityRole="button"
            accessibilityLabel={option.title}
            accessibilityState={{ selected: mode === option.mode, disabled: modeLocked || busy }}
            style={[styles.chip, mode === option.mode && styles.chipOn]}
          >
            <Text variant="caption" style={mode === option.mode ? styles.chipTextOn : undefined}>
              {option.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'split' ? (
        <TextInput
          style={styles.input}
          placeholder="Paid by M-Pesa (whole shillings)"
          placeholderTextColor={theme.colors.textMuted}
          value={mpesaText}
          onChangeText={setMpesaText}
          keyboardType="decimal-pad"
          editable={!modeLocked}
          accessibilityLabel="Amount paid by M-Pesa"
        />
      ) : null}

      {mode === 'mpesa' && shares && shares.ok && shares.cashCents > 0 ? (
        <Text variant="muted" style={styles.gap}>
          M-Pesa takes whole shillings: {formatMoney(shares.mpesaCents)} by M-Pesa and {formatMoney(shares.cashCents)} in cash.
        </Text>
      ) : null}

      {cashDue > 0 && mode !== 'mpesa' ? (
        <View>
          <Text variant="body">{mode === 'split' ? `Cash to take: ${formatMoney(cashDue)}` : 'Cash'}</Text>
          <TextInput
            style={styles.input}
            placeholder="Cash handed over (leave empty if exact)"
            placeholderTextColor={theme.colors.textMuted}
            value={handedText}
            onChangeText={setHandedText}
            keyboardType="decimal-pad"
            accessibilityLabel="Cash handed over"
          />
          <View style={styles.methods}>
            {cashSuggestions(cashDue)
              .slice(0, 5)
              .map((cents, index) => (
                <TouchableOpacity
                  key={cents}
                  onPress={() => setHandedText(index === 0 ? '' : String(cents / 100))}
                  style={styles.chip}
                  accessibilityRole="button"
                  accessibilityLabel={index === 0 ? 'Exact amount' : `Handed over ${formatMoney(cents)}`}
                >
                  <Text variant="caption">{index === 0 ? 'Exact' : formatMoney(cents)}</Text>
                </TouchableOpacity>
              ))}
          </View>
          {cash?.kind === 'change' ? <Text variant="h2">Change: {formatMoney(cash.cents)}</Text> : null}
          {cash?.kind === 'short' ? <Text variant="h2" style={styles.warn}>Short by {formatMoney(cash.cents)}</Text> : null}
        </View>
      ) : null}

      {mpesaMode ? (
        <Card style={styles.card}>
          <Text variant="body">M-Pesa: {formatMoney(mpesaShare)}</Text>
          {stk.stage === 'paid' ? (
            <Text variant="body">Paid. M-Pesa code {stk.code}</Text>
          ) : (
            <TextInput
              style={styles.input}
              placeholder="Customer's M-Pesa number"
              placeholderTextColor={theme.colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!modeLocked}
              accessibilityLabel="Customer's M-Pesa number"
            />
          )}

          {stk.stage === 'sending' ? <ActivityIndicator /> : null}
          {stk.stage === 'waiting' ? (
            <View>
              <ActivityIndicator />
              <Text variant="muted">Waiting for the customer to enter their M-Pesa PIN...</Text>
              <Button title="Stop waiting" variant="secondary" onPress={stopWaiting} style={styles.gap} />
            </View>
          ) : null}
          {stk.stage === 'unconfirmed' ? (
            <View>
              <Text variant="body" style={styles.warn}>{stk.message}</Text>
              <Button title="Check again" onPress={() => void checkAgain()} disabled={busy} style={styles.gap} />
              <Button title="Customer did not pay" variant="secondary" onPress={() => startOver()} style={styles.gap} />
            </View>
          ) : null}
          {stk.stage === 'maybe_sent' ? (
            <View>
              <Text variant="body" style={styles.warn}>{stk.message}</Text>
              <Button title="No prompt arrived: start again" variant="secondary" onPress={() => startOver()} style={styles.gap} />
            </View>
          ) : null}
          {stk.stage === 'failed' || stk.stage === 'wrong_amount' || stk.stage === 'code_needed' ? (
            <Text variant="body" style={styles.warn}>{stk.message}</Text>
          ) : null}
          {stk.stage === 'wrong_amount' ? (
            <Button title="Start the payment again" variant="secondary" onPress={() => startOver('wrong_amount')} style={styles.gap} />
          ) : null}

          {canPrompt ? (
            <Button
              title={stk.stage === 'failed' ? 'Send the prompt again' : 'Send M-Pesa prompt'}
              onPress={() => void sendPrompt()}
              disabled={busy || mpesaShare <= 0}
              style={styles.gap}
            />
          ) : null}

          {needsCode ? (
            <View>
              <Text variant="muted" style={styles.gap}>
                Already paid, or no prompt? Type the code from the customer's M-Pesa message.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="M-Pesa code, like SHK7Y2ABCD"
                placeholderTextColor={theme.colors.textMuted}
                value={codeText}
                onChangeText={setCodeText}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel="M-Pesa code"
              />
              {manualCode.length >= 6 && mpesaCodeLooksOdd(manualCode) ? (
                <Text variant="muted">M-Pesa codes usually have 10 letters and numbers. Check what you typed.</Text>
              ) : null}
            </View>
          ) : null}
        </Card>
      ) : null}

      {mode === 'credit' ? (
        <Card style={styles.card}>
          {customer ? (
            <View>
              <Text variant="body">On credit to {customer.name}</Text>
              <Button title="Choose someone else" variant="secondary" onPress={() => setCustomer(null)} style={styles.gap} />
            </View>
          ) : (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Customer's phone number"
                placeholderTextColor={theme.colors.textMuted}
                value={creditPhone}
                onChangeText={setCreditPhone}
                keyboardType="phone-pad"
                accessibilityLabel="Customer's phone number"
              />
              <Button title="Find customer" variant="secondary" onPress={() => void findCustomer()} disabled={busy} />
            </View>
          )}
        </Card>
      ) : null}

      {shares && !shares.ok && (mode === 'split' || handedText.trim()) ? (
        <Text variant="muted" style={styles.gap}>{shares.message}</Text>
      ) : null}

      <Button
        title={completeLabel}
        onPress={() => void completeSale(paidCode ?? undefined)}
        disabled={
          busy ||
          prompting ||
          stk.stage === 'wrong_amount' ||
          (mpesaMode && !paidCode && manualCode.length < 6) ||
          (mode === 'credit' && !customer) ||
          cash?.kind === 'short' ||
          (shares ? !shares.ok : true)
        }
        style={styles.gap}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    flexGrow: 1,
  },
  methods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginVertical: theme.spacing.md,
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  chipTextOn: {
    color: '#ffffff',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    minHeight: 48,
    color: theme.colors.text,
  },
  card: { marginVertical: theme.spacing.md },
  gap: { marginTop: theme.spacing.sm },
  warn: { color: theme.colors.danger },
});
