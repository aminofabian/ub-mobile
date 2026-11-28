import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { ApiClient } from '@kiosk/core';
import { MART, MartText, SPACE } from '@kiosk/staff';
import { fetchCurrentShift, fetchLastClosed, openShift } from '../api/pos-api';
import { feel } from '../lib/feel';
import { formatMoney } from '../lib/money';
import { parseOpeningFloat, suggestedFloat } from '../lib/shift-cash';
import { usePosStore } from '../store/pos-store';
import { CashierButton, CashierChip, CashierField, TABULAR_NUMS } from './CashierPrimitives';
import { DenominationCounter } from './DenominationCounter';
import { Prompt } from './Prompt';

type Props = {
  visible: boolean;
  api: ApiClient;
  branchId: string;
  /**
   * Why the till is asking: `retry` — the shop refused the sale for want of a shift and nothing was recorded, so
   * the sale is sent again the moment the shift is open; `later` — the sale is already saved on the phone and will
   * go on its own.
   */
  reason: 'retry' | 'later' | null;
  onClose: () => void;
  onOpened: () => void;
};

/**
 * The shift, opened where it is needed.
 *
 * A cashier who has not opened a shift used to be told so and sent away — the customer waiting, the sale in limbo,
 * a tab to find. This is that sentence turned into the thing to do: count the float here (by note and coin, in the
 * sheet the close uses too), open the shift, and the sale the cashier was already taking carries on.
 */
export function OpenShiftSheet({ visible, api, branchId, reason, onClose, onOpened }: Props) {
  const [floatText, setFloatText] = useState('');
  const [suggested, setSuggested] = useState<number | null>(null);
  /** Which step of the sheet is showing: the float amount, or the note-and-coin counter inside it. */
  const [counting, setCounting] = useState(false);
  const [busy, setBusy] = useState(false);

  // A fresh sheet each time it opens: no float carried over from the last shift.
  useEffect(() => {
    if (!visible) return;
    setFloatText('');
    setBusy(false);
    let alive = true;
    fetchLastClosed(api, branchId)
      .then((last) => {
        if (alive) setSuggested(suggestedFloat(last));
      })
      .catch(() => {
        // Only a hint: with none, the float is typed.
      });
    return () => {
      alive = false;
    };
  }, [visible, api, branchId]);

  /** Opens the shift with a float of `cents`; the typed amount and the empty till take the same path. */
  const openWith = async (cents: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const shift = await openShift(api, branchId, cents / 100);
      usePosStore.getState().setShift(shift);
      feel.success();
      onOpened();
    } catch (error) {
      // It may have opened and the answer been lost: look before reporting a failure.
      try {
        const shift = await fetchCurrentShift(api, branchId);
        usePosStore.getState().setShift(shift);
        feel.success();
        onOpened();
      } catch {
        Alert.alert(
          'Could not open the shift',
          error instanceof Error && error.message
            ? error.message
            : 'The shop did not answer. Check the connection and try again.'
        );
      }
    } finally {
      setBusy(false);
    }
  };

  /** A till that starts the day with nothing in it: no counting, no typing. */
  const openWithNothing = () => void openWith(0);

  /** The typed float: checked as an amount before anything is sent to the shop. */
  const open = async () => {
    if (busy) return;
    const entry = parseOpeningFloat(floatText);
    if (!entry.ok) {
      Alert.alert('Cash in the till', entry.message);
      return;
    }
    await openWith(entry.cents);
  };

  return (
    <Prompt
      visible={visible}
      title={counting ? 'Count the float' : 'Open a shift'}
      onClose={counting ? () => setCounting(false) : onClose}
    >
      {counting ? (
        // The same counter the close uses, shown in this sheet rather than in a second modal over it.
        <DenominationCounter
          mode="open"
          embedded
          doneLabel="Use this float"
          onCancel={() => setCounting(false)}
          onDone={(total) => {
            setFloatText(String(total));
            setCounting(false);
          }}
        />
      ) : (
        <View style={styles.body}>
          <MartText variant="body" color={MART.inkMuted}>
            {reason === 'retry'
              ? 'No shift is open, so the shop did not take this sale. Open one here and the sale is sent straight after.'
              : 'No shift is open. The sale is saved on this phone and goes on its own once a shift is open.'}
          </MartText>

          <CashierField
            label="Cash in the till now"
            value={floatText}
            onChangeText={setFloatText}
            keyboardType="decimal-pad"
            placeholder="0"
            accessibilityLabel="Cash in the till now"
            style={TABULAR_NUMS}
          />

          {suggested !== null ? (
            <CashierChip
              icon="time-outline"
              label={`Last close: ${formatMoney(suggested)}`}
              onPress={() => setFloatText(formatMoney(suggested).replace(/,/g, ''))}
              accessibilityLabel={`Use the last close, ${formatMoney(suggested)}, as the float`}
              style={styles.suggestion}
            />
          ) : null}

          <CashierChip
            icon="calculator-outline"
            label="Count by note & coin"
            onPress={() => setCounting(true)}
            accessibilityLabel="Count the float by note and coin"
            style={styles.countChip}
          />

          <CashierButton
            title={busy ? 'Opening…' : reason === 'retry' ? 'Open shift and send the sale' : 'Open shift'}
            busy={busy}
            disabled={busy}
            onPress={() => void open()}
            style={styles.open}
          />
          {/* A till that starts the day with nothing in it: one tap, no counting. */}
          <CashierButton
            title="Open with an empty till"
            variant="secondary"
            disabled={busy}
            onPress={() => void openWithNothing()}
            style={styles.notNow}
          />
          <CashierButton title="Not now" variant="ghost" onPress={onClose} disabled={busy} />
        </View>
      )}
    </Prompt>
  );
}

const styles = StyleSheet.create({
  body: { gap: SPACE.sm },
  suggestion: { alignSelf: 'flex-start' },
  countChip: { alignSelf: 'flex-start' },
  open: { marginTop: SPACE.md },
  notNow: { marginTop: SPACE.xs },
});
