import React, { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Text, theme } from '@kiosk/ui';
import { describeFailure, isApiError, type ApiClient, type SetupContext } from '@kiosk/core';
import { closeShift, fetchCurrentShift, fetchLastClosed, openShift } from '../api/pos-api';
import { formatMoney, toCents } from '../lib/money';
import {
  SHOW_EXPECTED_BEFORE_COUNT,
  describeVariance,
  parseOpeningFloat,
  planClose,
  suggestedFloat,
  unsentAtClose,
} from '../lib/shift-cash';
import { formatWhen } from '../lib/when';
import { usePosStore } from '../store/pos-store';
import { useUnsentSales } from '../hooks/useUnsentSales';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Shift'> & {
  api: ApiClient;
  branchId: string;
  tenantName: string;
  /** The shop runs without shifts: the till never asks the person to open one. */
  shiftsDisabled: boolean;
  /** What a "set this up first" answer needs to say where the step is finished. */
  setupContext: SetupContext;
  onLogout: () => void;
};

/** What the till knows about the shift. "unknown" is a failed check, which is not the same as no shift. */
type Check = 'loading' | 'open' | 'none' | 'unknown';

/** Closing happens in two steps: count, then review the difference before it is final. */
type Closing = 'idle' | 'counting' | 'review';

export function ShiftScreen({ navigation, api, branchId, tenantName, shiftsDisabled, setupContext, onLogout }: Props) {
  const { currentShift, setShift } = usePosStore();
  const unsent = useUnsentSales();
  const [check, setCheck] = useState<Check>('loading');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const [floatText, setFloatText] = useState('');
  const [lastCounted, setLastCounted] = useState<number | null>(null);

  const [closing, setClosing] = useState<Closing>('idle');
  const [countedText, setCountedText] = useState('');
  const [takenOutText, setTakenOutText] = useState('');
  const [reasonText, setReasonText] = useState('');

  const hold = (on: boolean) => {
    busyRef.current = on;
    setBusy(on);
  };

  /** Asks the server whether a shift is open. A failed check says nothing about the shift, so it changes nothing. */
  const refreshShift = useCallback(async (): Promise<Check> => {
    setCheck('loading');
    try {
      const shift = await fetchCurrentShift(api, branchId);
      setShift(shift);
      setCheck('open');
      return 'open';
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        setShift(null);
        setCheck('none');
        return 'none';
      }
      setCheck('unknown');
      return 'unknown';
    }
  }, [api, branchId, setShift]);

  React.useEffect(() => {
    if (!shiftsDisabled) void refreshShift();
  }, [refreshShift, shiftsDisabled]);

  // With no shift open, find out what the last one counted, as a starting point for the float.
  React.useEffect(() => {
    if (shiftsDisabled || check !== 'none') return;
    let alive = true;
    fetchLastClosed(api, branchId)
      .then((last) => {
        if (alive) setLastCounted(suggestedFloat(last));
      })
      .catch(() => {
        // Only a suggestion: with none, the float is typed.
      });
    return () => {
      alive = false;
    };
  }, [api, branchId, check, shiftsDisabled]);

  const handleOpenShift = async () => {
    if (busyRef.current) return;
    const entry = parseOpeningFloat(floatText);
    if (!entry.ok) {
      Alert.alert('Cash in the till', entry.message);
      return;
    }
    hold(true);
    try {
      const shift = await openShift(api, branchId, entry.cents / 100);
      setShift(shift);
      setCheck('open');
      setFloatText('');
      Alert.alert('Shift opened', `Float ${formatMoney(entry.cents)}. You can now start selling.`);
    } catch (e) {
      // It may have opened and the answer been lost: look before reporting a failure.
      if ((await refreshShift()) === 'open') {
        Alert.alert('Shift opened', 'A shift is open. You can start selling.');
      } else {
        const failure = describeFailure(e, { title: 'Error', body: 'Could not open shift' }, setupContext);
        Alert.alert(failure.title, failure.body);
      }
    } finally {
      hold(false);
    }
  };

  const expectedCash = currentShift?.expectedClosingCash;

  const review = () => {
    const plan = planClose({ expected: expectedCash, countedText, takenOutText, reasonText: '' });
    if (plan.step === 'invalid') {
      Alert.alert('Close the shift', plan.message);
      return;
    }
    setClosing('review');
  };

  const handleCloseShift = async () => {
    if (busyRef.current || !currentShift?.id) return;
    const plan = planClose({ expected: expectedCash, countedText, takenOutText, reasonText });
    if (plan.step === 'invalid') {
      Alert.alert('Close the shift', plan.message);
      return;
    }
    if (plan.step === 'reason') {
      Alert.alert('Say why', plan.message);
      return;
    }
    const shiftId = currentShift.id;

    const go = async () => {
      hold(true);
      try {
        const closed = await closeShift(api, shiftId, plan.body);
        setShift(null);
        setCheck('none');
        setClosing('idle');
        setCountedText('');
        setTakenOutText('');
        setReasonText('');
        const expected = typeof closed.expectedClosingCash === 'number' ? toCents(closed.expectedClosingCash) : plan.expectedCents;
        const counted = typeof closed.countedClosingCash === 'number' ? toCents(closed.countedClosingCash) : plan.countedCents;
        const variance = expected !== null && counted !== null ? counted - expected : plan.varianceCents;
        Alert.alert(
          'Shift closed',
          `Counted ${formatMoney(counted ?? plan.countedCents)}. ${describeVariance(variance)}. ${formatMoney(plan.leftInTillCents)} stays in the till.`
        );
      } catch (e) {
        // It may have closed and the answer been lost: look before reporting a failure.
        if ((await refreshShift()) === 'none') {
          setClosing('idle');
          Alert.alert('Shift closed', 'This shift is already closed.');
        } else {
          const failure = describeFailure(e, { title: 'Error', body: 'Could not close shift' }, setupContext);
          Alert.alert(failure.title, failure.body);
        }
      } finally {
        hold(false);
      }
    };

    const warning = unsentAtClose(unsent.total);
    if (warning) {
      Alert.alert('Close with unsent sales?', warning, [
        { text: 'Keep the shift open', style: 'cancel' },
        { text: 'Close anyway', style: 'destructive', onPress: () => void go() },
      ]);
      return;
    }
    await go();
  };

  const closePlan = closing === 'review' ? planClose({ expected: expectedCash, countedText, takenOutText, reasonText }) : null;
  const sellingKnown = check === 'open' || (check === 'unknown' && currentShift !== null);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text variant="h1">{tenantName}</Text>

      {shiftsDisabled ? (
        <Button title="Start selling" onPress={() => navigation.navigate('Pos')} style={styles.action} />
      ) : (
        <>
          <Card style={styles.card}>
            <Text variant="h2">Current shift</Text>
            {check === 'loading' && !currentShift ? <Text variant="muted">Checking...</Text> : null}
            {sellingKnown && currentShift ? (
              <>
                <Text variant="body">Opened: {formatWhen(currentShift.openedAt)}</Text>
                {currentShift.openedByName ? <Text variant="body">By: {currentShift.openedByName}</Text> : null}
                {typeof currentShift.openingCash === 'number' ? (
                  <Text variant="body">Float: {formatMoney(toCents(currentShift.openingCash) ?? 0)}</Text>
                ) : null}
                {SHOW_EXPECTED_BEFORE_COUNT && typeof expectedCash === 'number' ? (
                  <Text variant="body">Expected cash: {formatMoney(toCents(expectedCash) ?? 0)}</Text>
                ) : null}
                {check === 'unknown' ? (
                  <Text variant="muted">Could not refresh just now. This is the shift as it was last seen.</Text>
                ) : null}
              </>
            ) : null}
            {check === 'none' ? <Text variant="muted">No shift is open.</Text> : null}
            {check === 'unknown' && !currentShift ? (
              <Text variant="muted">
                Could not check whether a shift is open. That is not the same as no shift: check the connection and try again.
              </Text>
            ) : null}
          </Card>

          {check === 'none' ? (
            <Card style={styles.card}>
              <Text variant="h2">Open a shift</Text>
              <Text variant="muted">Count the cash in the till and type it.</Text>
              <TextInput
                value={floatText}
                onChangeText={setFloatText}
                keyboardType="decimal-pad"
                placeholder="Cash in the till now"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                accessibilityLabel="Cash in the till now"
              />
              <View style={styles.chips}>
                {lastCounted !== null ? (
                  <TouchableOpacity
                    style={styles.chip}
                    onPress={() => setFloatText(String(lastCounted / 100))}
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${formatMoney(lastCounted)}, what the last shift counted`}
                  >
                    <Text variant="caption">Last shift counted {formatMoney(lastCounted)}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() => setFloatText('0')}
                  accessibilityRole="button"
                  accessibilityLabel="No float"
                >
                  <Text variant="caption">No float</Text>
                </TouchableOpacity>
              </View>
              <Button title={busy ? 'Opening...' : 'Open shift'} onPress={() => void handleOpenShift()} disabled={busy} />
            </Card>
          ) : null}

          {check === 'unknown' && !currentShift ? (
            <Button title="Check again" onPress={() => void refreshShift()} disabled={busy} style={styles.action} />
          ) : null}
        </>
      )}

      {!shiftsDisabled && check === 'unknown' && !currentShift ? (
        <Button
          title="Start selling without checking"
          variant="secondary"
          onPress={() => navigation.navigate('Pos')}
          style={styles.action}
        />
      ) : null}

      {!shiftsDisabled && sellingKnown && currentShift ? (
        <>
          <Button title="Start selling" onPress={() => navigation.navigate('Pos')} style={styles.action} />

          {closing === 'idle' ? (
            <Button title="Close shift" variant="danger" onPress={() => setClosing('counting')} disabled={busy} style={styles.action} />
          ) : (
            <Card style={styles.card}>
              <Text variant="h2">Close the shift</Text>
              {closing === 'counting' ? (
                <>
                  <Text variant="muted">Count the cash in the drawer and type the total.</Text>
                  <TextInput
                    value={countedText}
                    onChangeText={setCountedText}
                    keyboardType="decimal-pad"
                    placeholder="Cash counted"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.input}
                    accessibilityLabel="Cash counted"
                  />
                  <TextInput
                    value={takenOutText}
                    onChangeText={setTakenOutText}
                    keyboardType="decimal-pad"
                    placeholder="Cash you are taking out"
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.input}
                    accessibilityLabel="Cash taken out"
                  />
                  <View style={styles.chips}>
                    <TouchableOpacity
                      style={styles.chip}
                      onPress={() => setTakenOutText('0')}
                      accessibilityRole="button"
                      accessibilityLabel="Nothing taken out"
                    >
                      <Text variant="caption">Nothing taken out</Text>
                    </TouchableOpacity>
                  </View>
                  <Button title="Review" onPress={review} style={styles.action} />
                  <Button title="Cancel" variant="secondary" onPress={() => setClosing('idle')} style={styles.action} />
                </>
              ) : closePlan && closePlan.step !== 'invalid' ? (
                <>
                  <Text variant="body">Expected: {formatMoney(closePlan.expectedCents)}</Text>
                  <Text variant="body">Counted: {formatMoney(closePlan.countedCents)}</Text>
                  <Text variant="h2" style={closePlan.step === 'reason' ? styles.warn : undefined}>
                    {describeVariance(closePlan.varianceCents)}
                  </Text>
                  <Text variant="body">Taken out: {formatMoney(closePlan.takenOutCents)}</Text>
                  <Text variant="body">Stays in the till: {formatMoney(closePlan.leftInTillCents)}</Text>
                  {closePlan.step === 'reason' ? (
                    <TextInput
                      value={reasonText}
                      onChangeText={setReasonText}
                      placeholder="Why does it not match?"
                      placeholderTextColor={theme.colors.textMuted}
                      style={styles.input}
                      accessibilityLabel="Reason for the difference"
                    />
                  ) : null}
                  {unsentAtClose(unsent.total) ? <Text variant="body" style={styles.warn}>{unsentAtClose(unsent.total)}</Text> : null}
                  <Button
                    title={busy ? 'Closing...' : 'Close shift'}
                    variant="danger"
                    onPress={() => void handleCloseShift()}
                    disabled={busy || closePlan.step !== 'ready'}
                    style={styles.action}
                  />
                  <Button title="Count again" variant="secondary" onPress={() => setClosing('counting')} disabled={busy} style={styles.action} />
                </>
              ) : (
                <Button title="Count again" variant="secondary" onPress={() => setClosing('counting')} style={styles.action} />
              )}
            </Card>
          )}
        </>
      ) : null}

      <Button
        title="Grocery invoices"
        variant="secondary"
        onPress={() => navigation.navigate('GroceryInvoices')}
        style={styles.action}
      />
      <Button
        title={unsent.total > 0 ? `Unsent sales (${unsent.total})` : 'Unsent sales'}
        variant="secondary"
        onPress={() => navigation.navigate('Conflicts')}
        style={styles.action}
      />
      {shiftsDisabled ? null : (
        <Button title="Refresh" variant="secondary" onPress={() => void refreshShift()} disabled={busy} style={styles.action} />
      )}
      <Button title="Sign out" variant="secondary" onPress={onLogout} style={styles.action} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    flexGrow: 1,
  },
  card: {
    marginBottom: theme.spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginVertical: theme.spacing.sm,
    minHeight: 48,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
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
  action: {
    marginTop: theme.spacing.sm,
  },
  warn: { color: theme.colors.danger },
});
