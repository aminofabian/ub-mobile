import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GUTTER, MART, RADIUS, SPACE, tint, MartText } from '@kiosk/staff';
import { describeFailure, isApiError, type ApiClient, type SetupContext } from '@kiosk/core';
import { CARD_SURFACE, CashierButton, CashierChip, CashierField, CashierRow, TABULAR_NUMS } from '../components/CashierPrimitives';
import { MilestonePill, MilestoneProgress } from '../components/Recognition';
import { DenominationSheet } from '../components/DenominationSheet';
import { closeShift, fetchCurrentShift, fetchLastClosed, logDrawerOpen, openShift } from '../api/pos-api';
import { formatMoney, toCents } from '../lib/money';
import { mayDrawout, mayManageCredit } from '../lib/shop-flags';
import { DrawoutSheet } from '../components/DrawoutSheet';
import type { TillPerson } from '../lib/till-person';
import { SHIFT_NEEDS_CONNECTION, SHIFT_UNKNOWN_OFFLINE } from '../lib/offline-words';
import { CHECK_WAIT_MS, waitFor } from '../lib/reach';
import {
  SHOW_EXPECTED_BEFORE_COUNT,
  describeVariance,
  needsReason,
  parseOpeningFloat,
  planClose,
  suggestedFloat,
  unsentAtClose,
  type ClosePlan,
} from '../lib/shift-cash';
import {
  EMPTY_PULSE,
  loadShiftPulse,
  milestoneWords,
  nextMilestone,
  recordShiftClosePulse,
  type MilestoneKey,
  type ShiftPulse,
} from '../lib/shift-pulse';
import { formatWhen } from '../lib/when';
import { usePosStore } from '../store/pos-store';
import { reachSink, useReach } from '../store/reach-store';
import { useUnsentSales } from '../hooks/useUnsentSales';
import { feel } from '../lib/feel';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = {
  navigation: NativeStackScreenProps<CashierStackParamList>['navigation'];
  api: ApiClient;
  tenantId: string;
  branchId: string;
  tenantName: string;
  /** The shop runs without shifts: the till never asks the person to open one. */
  shiftsDisabled: boolean;
  /** What a "set this up first" answer needs to say where the step is finished. */
  setupContext: SetupContext;
  /** Who is signed in: what the shop lets them do (gates the credit book, etc.). */
  person: TillPerson;
  onLogout: () => void;
};

/** What the till knows about the shift. "unknown" is a failed check, which is not the same as no shift. */
type Check = 'loading' | 'open' | 'none' | 'unknown';

/** Closing happens in two steps: count, then review the difference before it is final. */
type Closing = 'idle' | 'counting' | 'review';

/** A quiet "detail" line inside a card: a label on the left, its value on the right. */
function Detail({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.detail}>
      <MartText variant="meta" color={MART.inkQuiet}>
        {label}
      </MartText>
      <MartText variant={strong ? 'heading' : 'label'} color={MART.ink} style={TABULAR_NUMS}>
        {value}
      </MartText>
    </View>
  );
}

/** A note set on the paper under a heading — a hint, a caveat, an offline line. */
function Note({ children, tone = 'quiet' }: { children: React.ReactNode; tone?: 'quiet' | 'warn' }) {
  return (
    <MartText variant="meta" color={tone === 'warn' ? MART.danger : MART.inkQuiet} style={styles.note}>
      {children}
    </MartText>
  );
}

export function ShiftScreen({ navigation, api, tenantId, branchId, tenantName, shiftsDisabled, setupContext, person, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  const canManageCredit = mayManageCredit(person.permissions);
  const [openingDrawer, setOpeningDrawer] = useState(false);
  const [pulse, setPulse] = useState<ShiftPulse>(EMPTY_PULSE);
  const [closedSummary, setClosedSummary] = useState<{
    counted: string;
    varianceText: string;
    leftInTill: string;
    clean: boolean;
    allSent: boolean;
    earned: MilestoneKey[];
  } | null>(null);

  // Record that the drawer was opened by hand (to make change) — the shift keeps the log.
  const openDrawer = () => {
    if (openingDrawer) return;
    setOpeningDrawer(true);
    logDrawerOpen(api, branchId, currentShift?.id)
      .then(() => Alert.alert('Drawer opened', 'The open was logged against this shift.'))
      .catch(() => Alert.alert('Could not log it', 'The drawer open was not recorded. Try again.'))
      .finally(() => setOpeningDrawer(false));
  };
  const { currentShift, setShift, flags } = usePosStore();
  const canDrawout = mayDrawout(flags, person.permissions);
  const [showDrawout, setShowDrawout] = useState(false);
  const unsent = useUnsentSales();
  const offline = useReach((state) => state.offline);
  const [check, setCheck] = useState<Check>('loading');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // The shift as the server last said it. State is only read on the next render; a step that has just asked needs it now.
  const latestShift = useRef<{ expectedClosingCash?: number | null } | null>(null);
  // What the cashier counted before the expected cash was shown, so a closed shift can say if the count was changed after.
  const firstCount = useRef<number | null>(null);

  const [floatText, setFloatText] = useState('');
  const [lastCounted, setLastCounted] = useState<number | null>(null);

  const [closing, setClosing] = useState<Closing>('idle');
  const [countedText, setCountedText] = useState('');
  const [takenOutText, setTakenOutText] = useState('');
  const [reasonText, setReasonText] = useState('');
  /** Which cash-counting sheet is open, if any: the opening float or the closing drawer. */
  const [denomSheet, setDenomSheet] = useState<'open' | 'close' | null>(null);

  const hold = (on: boolean) => {
    busyRef.current = on;
    setBusy(on);
  };

  /**
   * Asks the server whether a shift is open. A failed check says nothing about the shift, so it changes nothing.
   * `quiet` keeps the screen as it is while it asks (no "Checking..."), for a check made in the middle of closing.
   */
  const refreshShift = useCallback(
    async (quiet = false): Promise<Check> => {
      if (!quiet) setCheck('loading');
      try {
        // A check that is not answered says nothing about the shift: it ends as "unknown", and is not waited on for ever.
        const shift = await waitFor(() => fetchCurrentShift(api, branchId), CHECK_WAIT_MS, reachSink);
        latestShift.current = shift;
        setShift(shift);
        setCheck('open');
        return 'open';
      } catch (error) {
        if (isApiError(error) && error.status === 404) {
          latestShift.current = null;
          setShift(null);
          setCheck('none');
          return 'none';
        }
        setCheck('unknown');
        return 'unknown';
      }
    },
    [api, branchId, setShift]
  );

  // On arriving, and again whenever the person comes back to this screen (from the till, or from a sale that needs a
  // shift): the shift is read as it is now. Only the first look says "Checking...".
  useFocusEffect(
    useCallback(() => {
      if (!shiftsDisabled) void refreshShift(true);
      void loadShiftPulse(tenantId, branchId, person.userId).then(setPulse);
    }, [refreshShift, shiftsDisabled, tenantId, branchId, person.userId])
  );

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
      setClosedSummary(null);
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

  /**
   * What the till expects, read now. It moves with every cash sale and payout, so the figure from when this screen
   * opened is not the one to count against.
   */
  const readExpectedNow = async (): Promise<
    { ok: true; expected: number | null | undefined } | { ok: false; message: string }
  > => {
    const seen = await refreshShift(true);
    if (seen === 'open') return { ok: true, expected: latestShift.current?.expectedClosingCash };
    if (seen === 'none') {
      setClosing('idle');
      firstCount.current = null;
      return { ok: false, message: 'This shift is already closed.' };
    }
    return { ok: false, message: "Couldn't read what the till expects just now. Check the connection and try again." };
  };

  const review = async () => {
    if (busyRef.current) return;
    hold(true);
    try {
      const now = await readExpectedNow();
      if (!now.ok) {
        Alert.alert('Close the shift', now.message);
        return;
      }
      const plan = planClose({ expected: now.expected, countedText, takenOutText, reasonText: '' });
      if (plan.step === 'invalid') {
        Alert.alert('Close the shift', plan.message);
        return;
      }
      // The first count is kept, so the closed shift can say if it was changed after the expected cash was shown.
      if (firstCount.current === null) firstCount.current = plan.countedCents;
      setClosing('review');
    } finally {
      hold(false);
    }
  };

  const handleCloseShift = async () => {
    if (busyRef.current || !currentShift?.id) return;
    const shiftId = currentShift.id;
    const shown = closePlan && closePlan.step !== 'invalid' ? closePlan.expectedCents : null;

    // What the till expects may have moved since the difference was shown (another sale, a payout). It is read again,
    // and if it moved the difference is shown again, not closed on a figure the cashier has not seen.
    hold(true);
    let plan: ClosePlan | null = null;
    try {
      const now = await readExpectedNow();
      if (!now.ok) {
        Alert.alert('Close the shift', now.message);
        return;
      }
      plan = planClose({
        expected: now.expected,
        countedText,
        takenOutText,
        reasonText,
        firstCountedCents: firstCount.current,
      });
    } finally {
      hold(false);
    }
    if (!plan) return;
    if (plan.step === 'invalid') {
      Alert.alert('Close the shift', plan.message);
      return;
    }
    if (shown !== null && plan.expectedCents !== shown) {
      Alert.alert(
        'The expected cash changed',
        'A sale or a payout was recorded while you were counting. The difference on the screen is updated: look at it again before you close.'
      );
      return;
    }
    if (plan.step === 'reason') {
      Alert.alert('Say why', plan.message);
      return;
    }

    const go = async () => {
      hold(true);
      try {
        const closed = await closeShift(api, shiftId, plan.body);
        setShift(null);
        setCheck('none');
        setClosing('idle');
        firstCount.current = null;
        setCountedText('');
        setTakenOutText('');
        setReasonText('');
        const expected = typeof closed.expectedClosingCash === 'number' ? toCents(closed.expectedClosingCash) : plan.expectedCents;
        const counted = typeof closed.countedClosingCash === 'number' ? toCents(closed.countedClosingCash) : plan.countedCents;
        const variance = expected !== null && counted !== null ? counted - expected : plan.varianceCents;
        const { next, clean, allSent, earned } = await recordShiftClosePulse(tenantId, branchId, person.userId, {
          varianceCents: variance,
          unsentCount: unsent.total,
          closedAt: new Date().toISOString(),
        });
        setPulse(next);
        if (allSent && clean) feel.success();
        else feel.warn();
        setClosedSummary({
          counted: formatMoney(counted ?? plan.countedCents),
          varianceText: describeVariance(variance),
          leftInTill: formatMoney(plan.leftInTillCents),
          clean,
          allSent,
          earned,
        });
      } catch (e) {
        // It may have closed and the answer been lost: look before reporting a failure.
        if ((await refreshShift()) === 'none') {
          setClosing('idle');
          firstCount.current = null;
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
    <ScrollView
      contentContainerStyle={[styles.container, { paddingBottom: Math.max(GUTTER, insets.bottom + SPACE.md) }]}
      keyboardShouldPersistTaps="handled"
    >
      <MartText variant="display" style={styles.pageTitle}>
        {tenantName}
      </MartText>

      {!shiftsDisabled && pulse && nextMilestone(pulse) ? (
        // The shift's progression is the spine of this screen: how far to the next milestone, in one glance.
        <View style={styles.spine}>
          <MilestoneProgress
            label={nextMilestone(pulse)!.milestone.label}
            have={nextMilestone(pulse)!.have}
            need={nextMilestone(pulse)!.need}
          />
        </View>
      ) : null}

      {closedSummary ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={[styles.cardIcon, closedSummary.allSent && styles.cleanIcon]}>
              <Ionicons
                name={closedSummary.allSent ? 'checkmark-done' : 'cloud-upload-outline'}
                size={18}
                color={closedSummary.allSent ? MART.success : MART.warning}
              />
            </View>
            <View style={{ flex: 1 }}>
              <MartText variant="heading">Shift closed</MartText>
              <MartText variant="meta" color={MART.inkMuted}>
                {closedSummary.allSent ? 'All sales sent. ' : 'Some sales are still sending. '}
                {closedSummary.varianceText}
              </MartText>
            </View>
          </View>
          {closedSummary.earned.length > 0 ? <MilestonePill label={milestoneWords(closedSummary.earned[0])} /> : null}
          <View style={styles.details}>
            <Detail label="Counted" value={`KES ${closedSummary.counted}`} />
            <Detail label="Stays in the till" value={`KES ${closedSummary.leftInTill}`} strong />
          </View>
          <CashierButton title="Done" variant="secondary" onPress={() => setClosedSummary(null)} style={styles.action} />
        </View>
      ) : null}

      {shiftsDisabled ? (
        <CashierButton title="Start selling" onPress={() => navigation.navigate('Pos')} style={styles.action} />
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons name="time-outline" size={18} color={MART.fallbackPrimary} />
              </View>
              <MartText variant="heading">Current shift</MartText>
            </View>
            {check === 'loading' && !currentShift ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={MART.fallbackPrimary} />
                <MartText variant="meta" color={MART.inkQuiet}>
                  Checking shift…
                </MartText>
              </View>
            ) : null}
            {sellingKnown && currentShift ? (
              <View style={styles.details}>
                <Detail label="Opened" value={formatWhen(currentShift.openedAt)} />
                {currentShift.openedByName ? <Detail label="By" value={currentShift.openedByName} /> : null}
                {typeof currentShift.openingCash === 'number' ? (
                  <Detail label="Float" value={formatMoney(toCents(currentShift.openingCash) ?? 0)} />
                ) : null}
                {SHOW_EXPECTED_BEFORE_COUNT && typeof expectedCash === 'number' ? (
                  <Detail label="Expected cash" value={formatMoney(toCents(expectedCash) ?? 0)} strong />
                ) : null}
                {check === 'unknown' ? (
                  <Note>Could not refresh just now. This is the shift as it was last seen.</Note>
                ) : null}
              </View>
            ) : null}
            {check === 'none' ? <Note>No shift is open.</Note> : null}
            {check === 'unknown' && !currentShift ? (
              <Note>
                {offline
                  ? SHIFT_UNKNOWN_OFFLINE
                  : 'Could not check whether a shift is open. That is not the same as no shift: check the connection and try again.'}
              </Note>
            ) : null}
          </View>

          {check === 'none' ? (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.cardIcon}>
                  <Ionicons name="cash-outline" size={18} color={MART.fallbackPrimary} />
                </View>
                <MartText variant="heading">Open a shift</MartText>
              </View>
              <Note>Count the cash in the till and type it.</Note>
              {lastCounted !== null ? (
                <Note>
                  The last shift counted {formatMoney(lastCounted)} when it closed, before any cash was taken out.
                </Note>
              ) : null}
              <CashierField
                value={floatText}
                onChangeText={setFloatText}
                keyboardType="decimal-pad"
                placeholder="Cash in the till now"
                accessibilityLabel="Cash in the till now"
                containerStyle={styles.fieldGap}
                style={TABULAR_NUMS}
              />
              <View style={styles.chips}>
                <CashierChip
                  label="No float"
                  selected={floatText.trim() === '0'}
                  onPress={() => setFloatText('0')}
                  accessibilityLabel="No float"
                />
                <CashierChip
                  icon="calculator-outline"
                  label="Count by note & coin"
                  onPress={() => setDenomSheet('open')}
                  accessibilityLabel="Count by note and coin"
                />
              </View>
              {offline ? <Note>{SHIFT_NEEDS_CONNECTION}</Note> : null}
              <CashierButton
                title={busy ? 'Opening...' : 'Open shift'}
                busy={busy}
                onPress={() => void handleOpenShift()}
                disabled={busy || offline}
              />
            </View>
          ) : null}

          {check === 'unknown' && !currentShift ? (
            <CashierButton title="Check again" onPress={() => void refreshShift()} disabled={busy} style={styles.action} />
          ) : null}
        </>
      )}

      {/* The person's own work at this shop, as plain counts — and the next milestone, when there is one. */}
      {pulse.salesRung > 0 || pulse.closesFinished > 0 ? (
        <View style={styles.card}>
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <MartText variant="meta" color={MART.inkQuiet}>
                Sales this shift
              </MartText>
              <MartText variant="title" style={TABULAR_NUMS}>
                {pulse.salesInShift}
              </MartText>
            </View>
            <View style={styles.metric}>
              <MartText variant="meta" color={MART.inkQuiet}>
                Closes finished
              </MartText>
              <MartText variant="title" style={TABULAR_NUMS}>
                {pulse.closesFinished}
              </MartText>
            </View>
          </View>
        </View>
      ) : null}

            {!shiftsDisabled && check === 'unknown' && !currentShift ? (
        <CashierButton
          title="Start selling without checking"
          variant="secondary"
          onPress={() => navigation.navigate('Pos')}
          style={styles.action}
        />
      ) : null}

      {!shiftsDisabled && sellingKnown && currentShift ? (
        <>
          <CashierButton title="Start selling" onPress={() => navigation.navigate('Pos')} style={styles.action} />

          {closing === 'idle' ? (
            <>
              {offline ? <Note>{SHIFT_NEEDS_CONNECTION}</Note> : null}
              <CashierButton
                title="Close shift"
                variant="danger"
                onPress={() => setClosing('counting')}
                disabled={busy || offline}
                style={styles.action}
              />
            </>
          ) : (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.cardIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color={MART.fallbackPrimary} />
                </View>
                <MartText variant="heading">Close the shift</MartText>
              </View>
              {closing === 'counting' ? (
                <>
                  <Note>Count the cash in the drawer and type the total, or count it by note and coin.</Note>
                  <CashierField
                    value={countedText}
                    onChangeText={setCountedText}
                    keyboardType="decimal-pad"
                    placeholder="Cash counted"
                    accessibilityLabel="Cash counted"
                    containerStyle={styles.fieldGap}
                    style={TABULAR_NUMS}
                  />
                  <CashierChip
                    icon="calculator-outline"
                    label="Count by note & coin"
                    onPress={() => setDenomSheet('close')}
                    accessibilityLabel="Count the drawer by note and coin"
                    style={styles.countChipWrap}
                  />
                  <CashierField
                    value={takenOutText}
                    onChangeText={setTakenOutText}
                    keyboardType="decimal-pad"
                    placeholder="Cash you are taking out"
                    accessibilityLabel="Cash taken out"
                    containerStyle={styles.fieldGap}
                    style={TABULAR_NUMS}
                  />
                  <View style={styles.chips}>
                    <CashierChip
                      label="Nothing taken out"
                      selected={takenOutText.trim() === '0'}
                      onPress={() => setTakenOutText('0')}
                      accessibilityLabel="Nothing taken out"
                    />
                  </View>
                  <CashierButton title="Review" onPress={() => void review()} disabled={busy} style={styles.action} />
                  <CashierButton
                    title="Cancel"
                    variant="secondary"
                    onPress={() => {
                      firstCount.current = null;
                      setClosing('idle');
                    }}
                    style={styles.action}
                  />
                </>
              ) : closePlan && closePlan.step !== 'invalid' ? (
                <>
                  <View style={styles.details}>
                    <Detail label="Expected" value={formatMoney(closePlan.expectedCents)} />
                    <Detail label="Counted" value={formatMoney(closePlan.countedCents)} />
                  </View>
                  <View style={[styles.varianceBar, needsReason(closePlan.varianceCents) && styles.varianceWarn]}>
                    <MartText variant="heading" color={needsReason(closePlan.varianceCents) ? MART.danger : MART.success} style={TABULAR_NUMS}>
                      {describeVariance(closePlan.varianceCents)}
                    </MartText>
                  </View>
                  <View style={styles.details}>
                    <Detail label="Taken out" value={formatMoney(closePlan.takenOutCents)} />
                    <Detail label="Stays in the till" value={formatMoney(closePlan.leftInTillCents)} strong />
                  </View>
                  {needsReason(closePlan.varianceCents) ? (
                    <CashierField
                      value={reasonText}
                      onChangeText={setReasonText}
                      placeholder="Why does it not match?"
                      accessibilityLabel="Reason for the difference"
                      containerStyle={styles.fieldGap}
                    />
                  ) : null}
                  {unsentAtClose(unsent.total) ? <Note tone="warn">{unsentAtClose(unsent.total)}</Note> : null}
                  <CashierButton
                    title={busy ? 'Closing...' : 'Close shift'}
                    busy={busy}
                    variant="danger"
                    onPress={() => void handleCloseShift()}
                    disabled={busy || closePlan.step !== 'ready'}
                    style={styles.action}
                  />
                  <CashierButton title="Count again" variant="secondary" onPress={() => setClosing('counting')} disabled={busy} style={styles.action} />
                </>
              ) : (
                <CashierButton title="Count again" variant="secondary" onPress={() => setClosing('counting')} style={styles.action} />
              )}
            </View>
          )}
        </>
      ) : null}

      {/* Everything secondary, as a list to scan — the two real actions are the buttons above. */}
      <View style={styles.rowCard}>
        {canManageCredit ? (
          <CashierRow icon="book-outline" title="Credit book" onPress={() => navigation.navigate('CreditTabs')} />
        ) : null}
        <CashierRow
          icon="cash-outline"
          title={openingDrawer ? 'Opening…' : 'Open drawer'}
          onPress={openDrawer}
          busy={openingDrawer}
          disabled={openingDrawer}
        />
        {canDrawout && currentShift?.id ? (
          <CashierRow icon="arrow-up-circle-outline" title="Cash pay-out" onPress={() => setShowDrawout(true)} />
        ) : null}
        <CashierRow icon="receipt-outline" title="Grocery invoices" onPress={() => navigation.navigate('GroceryInvoices')} />
        <CashierRow
          icon="cloud-upload-outline"
          title={unsent.total > 0 ? `Unsent sales (${unsent.total})` : 'Unsent sales'}
          onPress={() => navigation.navigate('Conflicts')}
        />
        <CashierRow icon="print-outline" title="Receipt printer" onPress={() => navigation.navigate('PrinterSettings')} />
        {shiftsDisabled ? null : (
          <CashierRow icon="refresh" title="Refresh" onPress={() => void refreshShift()} disabled={busy} />
        )}
        <CashierRow icon="log-out-outline" title="Sign out" tone="danger" onPress={onLogout} />
      </View>

      {denomSheet ? (
        <DenominationSheet
          mode={denomSheet}
          expectedTotal={denomSheet === 'close' && typeof expectedCash === 'number' ? Math.round(expectedCash) : null}
          onCancel={() => setDenomSheet(null)}
          onDone={(total) => {
            if (denomSheet === 'open') setFloatText(String(total));
            else setCountedText(String(total));
            setDenomSheet(null);
          }}
        />
      ) : null}

      <DrawoutSheet
        api={api}
        shiftId={currentShift?.id ?? null}
        visible={showDrawout}
        onClose={() => setShowDrawout(false)}
        onRecorded={() => void refreshShift()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: GUTTER,
    backgroundColor: MART.paper,
    flexGrow: 1,
    gap: SPACE.md,
  },
  spine: { gap: SPACE.md, marginBottom: SPACE.lg },
  pageTitle: { marginBottom: SPACE.xs },
  // Two plain counts side by side: the label quiet above, the figure leading.
  metrics: {
    flexDirection: 'row',
    gap: SPACE.lg,
  },
  metric: {
    flex: 1,
    gap: 2,
  },
  card: {
    ...CARD_SURFACE,
    padding: SPACE.lg,
    gap: SPACE.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    marginBottom: SPACE.xs,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    backgroundColor: tint(MART.fallbackPrimary, 0.1),
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanIcon: {
    backgroundColor: MART.successSurface,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.xs,
  },
  details: { gap: SPACE.xs },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.md,
  },
  note: { marginTop: SPACE.xxs },
  varianceBar: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    backgroundColor: MART.successSurface,
    marginVertical: SPACE.xs,
  },
  varianceWarn: { backgroundColor: MART.dangerSurface },
  fieldGap: { marginVertical: SPACE.xs },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
    marginBottom: SPACE.xs,
  },
  countChipWrap: {
    alignSelf: 'flex-start',
    marginBottom: SPACE.xs,
  },
  // A card of secondary actions: 8pt of air around quiet rows.
  rowCard: {
    ...CARD_SURFACE,
    padding: SPACE.xs,
    gap: 2,
    marginTop: SPACE.sm,
  },
  action: {
    marginTop: SPACE.xs,
  },
});
