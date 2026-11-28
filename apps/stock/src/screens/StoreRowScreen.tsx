import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatKes, readFailureWords } from '@kiosk/core';
import { GUTTER, MartButton, MartText, MART, RADIUS, SPACE, onFill, tint } from '@kiosk/staff';
import { fetchStoreActivity, fetchStoreRows, fetchStoreSettings, postStoreMovement } from '../api/store-room-api';
import { useStockSession } from '../lib/session';
import {
  canWriteMovement,
  effectWords,
  findEcho,
  packWords,
  parseMoveQty,
  readPack,
  reasonLabel,
  reasonsFor,
  shownCount,
  todayWindow,
  wholeUnitsOnly,
  writeOutcome,
  type PackFact,
  type StoreDirection,
  type StoreReason,
  type StoreRow,
  type StoreSettings,
} from '../lib/store-room';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'StoreRow'>;

type Loaded =
  | { state: 'loading' }
  | { state: 'failed'; words: string }
  | { state: 'missing' }
  | { state: 'ready'; row: StoreRow; settings: StoreSettings };

/** One store-room row, and the take-out or put-in recorded against it. */
export function StoreRowScreen({ navigation, route }: Props) {
  const { api, branchId, userId, mayWrite, mayCatalog } = useStockSession();
  const { storeItemId } = route.params;
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [direction, setDirection] = useState<StoreDirection>('out');
  const [reasonId, setReasonId] = useState<StoreReason['id']>('restock_to_shelf');
  const [qtyText, setQtyText] = useState('');
  const [note, setNote] = useState('');
  const [noting, setNoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pack, setPack] = useState<PackFact | null>(null);
  const sending = useRef(false);

  const reload = useCallback(async () => {
    const [settings, rows] = await Promise.all([fetchStoreSettings(api), fetchStoreRows(api, branchId)]);
    if (!settings || !rows) return { kind: 'unreadable' as const };
    const row = rows.find((candidate) => candidate.id === storeItemId);
    return row ? { kind: 'ready' as const, row, settings } : { kind: 'missing' as const };
  }, [api, branchId, storeItemId]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        setPack(null);
        try {
          const next = await reload();
          if (!live) return;
          if (next.kind === 'unreadable') setLoaded({ state: 'failed', words: 'The server sent something the app could not read.' });
          else if (next.kind === 'missing') setLoaded({ state: 'missing' });
          else {
            setLoaded({ state: 'ready', row: next.row, settings: next.settings });
            const itemId = next.row.itemId;
            if (!itemId) setPack(null);
            else {
              try {
                const fact = readPack(await api.get<unknown>(`/api/v1/items/${encodeURIComponent(itemId)}`));
                if (live) setPack(fact);
              } catch {
                if (live) setPack(null);
              }
            }
          }
        } catch (error) {
          if (live) setLoaded({ state: 'failed', words: readFailureWords(error) });
        }
      })();
      return () => {
        live = false;
      };
    }, [reload, attempt, api])
  );

  useEffect(() => {
    if (loaded.state !== 'ready') return;
    navigation.setOptions({ title: loaded.row.name });
    const open = (next: StoreDirection) =>
      reasonsFor(next).filter((candidate) =>
        canWriteMovement({
          mode: loaded.settings.mode,
          linked: loaded.row.itemId != null,
          changesStock: candidate.changesStock,
          inventory: mayWrite,
          catalog: mayCatalog,
        })
      );
    if (open(direction).length > 0) return;
    const other: StoreDirection = direction === 'out' ? 'in' : 'out';
    const nextReasons = open(other);
    const first = nextReasons[0];
    if (!first) return;
    setDirection(other);
    setReasonId(first.id);
  }, [loaded, direction, mayWrite, mayCatalog, navigation]);

  const record = async (row: StoreRow, reason: StoreReason) => {
    if (sending.current) return;
    const quantity = parseMoveQty(qtyText, wholeUnitsOnly(row));
    if (quantity == null) {
      Alert.alert('Check the quantity', wholeUnitsOnly(row) ? 'Back-room-only items are counted in whole numbers.' : 'Enter how many moved.');
      return;
    }
    if (reason.id === 'other' && note.trim() === '') {
      Alert.alert('Add a note', 'Something else needs a note, so it still makes sense later.');
      return;
    }
    sending.current = true;
    setBusy(true);
    const sentAt = Date.now();
    const body = { storeItemId: row.id, direction, reason: reason.id, quantity, note: note.trim() || null, branchId };
    try {
      const movement = await postStoreMovement(api, body);
      if (!movement) {
        await settleLost(body, sentAt);
        return;
      }
      setQtyText('');
      setNote('');
      setNoting(false);
      const fresh = await reload();
      if (fresh.kind === 'ready') setLoaded({ state: 'ready', row: fresh.row, settings: fresh.settings });
      told(movement.status === 'pending', reason);
    } catch (error) {
      const outcome = writeOutcome(error);
      if (outcome.kind === 'refused') Alert.alert('Not recorded', outcome.words);
      else await settleLost(body, sentAt);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const settleLost = async (body: { storeItemId: string; reason: StoreReason['id']; quantity: number }, sentAt: number) => {
    try {
      const window = todayWindow(Date.now());
      const activity = await fetchStoreActivity(api, window);
      const echo = activity ? findEcho(activity, { ...body, actorId: userId, sentAt }) : null;
      if (echo) {
        const reason = reasonsFor('out').concat(reasonsFor('in')).find((candidate) => candidate.id === echo.reason);
        told(echo.status === 'pending', reason ?? null);
        return;
      }
    } catch {
      // The activity read failed too. The person is told the phone cannot tell.
    }
    Alert.alert('The phone cannot tell', 'Look in Today before sending this again. Sending it twice would record it twice.', [
      { text: 'Look in Today', onPress: () => navigation.navigate('StoreToday') },
      { text: 'Close', style: 'cancel' },
    ]);
  };

  if (loaded.state === 'loading') {
    return (
      <View style={styles.center}>
        <MartText variant="meta" color={MART.inkQuiet}>
          Reading this row…
        </MartText>
      </View>
    );
  }
  if (loaded.state === 'failed' || loaded.state === 'missing') {
    return (
      <View style={styles.body}>
        <MartText variant="meta" color={MART.danger}>
          {loaded.state === 'missing' ? 'That row is no longer in the store room.' : loaded.words}
        </MartText>
      </View>
    );
  }

  const { row, settings } = loaded;
  const count = shownCount(row, settings.mode);
  const allowed = (next: StoreDirection) =>
    reasonsFor(next).filter((candidate) =>
      canWriteMovement({
        mode: settings.mode,
        linked: row.itemId != null,
        changesStock: candidate.changesStock,
        inventory: mayWrite,
        catalog: mayCatalog,
      })
    );
  const reasons = allowed(direction);
  const both = allowed('out').length > 0 && allowed('in').length > 0;
  const any = allowed('out').length + allowed('in').length > 0;
  const reason = reasons.find((candidate) => candidate.id === reasonId) ?? reasons[0] ?? null;
  const facts = [
    row.barcode ? ['Barcode', row.barcode] : null,
    ['Linked product', row.inventoryItemName ?? 'Not linked'],
    row.expiryDate ? ['Expires', row.expiryDate] : null,
    row.buyingPrice == null ? null : ['Buying price', formatKes(Math.round(row.buyingPrice * 100))],
  ].filter((fact): fact is [string, string] => fact != null);
  const typed = parseMoveQty(qtyText, wholeUnitsOnly(row));

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.identity}>
        <MartText variant="display">{count.text}</MartText>
        {count.followsShelf ? (
          <MartText variant="meta" color={MART.inkQuiet}>
            Same count as the shelf. A delivery put here does not raise a separate pile.
          </MartText>
        ) : null}
        {pack ? (
          <MartText variant="meta" color={MART.inkQuiet}>
            {packWords(pack, null)}
          </MartText>
        ) : null}
      </View>

      {settings.mode == null ? (
        <View style={styles.notice}>
          <MartText variant="meta" color={MART.ink}>
            Choose how the store room works on the web before recording a movement.
          </MartText>
        </View>
      ) : !any ? (
        <View style={styles.notice}>
          <MartText variant="meta" color={MART.ink}>
            Your role cannot record a movement on this row.
          </MartText>
        </View>
      ) : (
        <View style={styles.form}>
          {both ? (
            <View style={styles.directions}>
              {(['out', 'in'] as const).map((next) => {
                const on = direction === next;
                return (
                  <Pressable
                    key={next}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      setDirection(next);
                      const first = allowed(next)[0];
                      if (first) setReasonId(first.id);
                    }}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <MartText variant="label" color={on ? onFill(MART.fallbackPrimary).primary : MART.ink}>
                      {next === 'out' ? 'Take out' : 'Put in'}
                    </MartText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {reason == null ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              Your role cannot record this direction on this row.
            </MartText>
          ) : (
            <>
              <View style={styles.reasons}>
                {reasons.map((candidate) => {
                  const on = candidate.id === reason.id;
                  return (
                    <Pressable
                      key={candidate.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => setReasonId(candidate.id)}
                      style={[styles.reason, on && styles.reasonOn]}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <MartText variant="label">{candidate.label}</MartText>
                        <MartText variant="meta" color={MART.inkQuiet}>
                          {candidate.hint}
                        </MartText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={qtyText}
                onChangeText={setQtyText}
                keyboardType="decimal-pad"
                placeholder={wholeUnitsOnly(row) ? 'Whole number' : pack ? `How many ${pack.unit}` : 'How many'}
                placeholderTextColor={MART.inkQuiet}
                accessibilityLabel="Quantity"
                style={styles.input}
              />
              {pack ? (
                <MartText variant="meta" color={MART.inkQuiet}>
                  {packWords(pack, typed)}
                </MartText>
              ) : null}
              {reason.id === 'other' || noting ? (
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder={reason.id === 'other' ? 'Note, required' : 'Note'}
                  placeholderTextColor={MART.inkQuiet}
                  accessibilityLabel="Note"
                  style={styles.input}
                />
              ) : (
                <Pressable accessibilityRole="button" onPress={() => setNoting(true)} style={styles.noteLink}>
                  <MartText variant="label" color={MART.fallbackPrimaryLift}>
                    Add a note
                  </MartText>
                </Pressable>
              )}
              <MartButton label={effectWords(reason)} busy={busy} disabled={busy} onPress={() => void record(row, reason)} />
            </>
          )}
        </View>
      )}

      {facts.length > 0 ? (
        <View style={styles.facts}>
          {facts.map(([label, value]) => (
            <Fact key={label} label={label} value={value} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function told(pending: boolean, reason: StoreReason | null) {
  if (pending) {
    Alert.alert('Waiting for approval', 'It is recorded. The till has not changed until someone approves it.');
    return;
  }
  if (reason && !reason.changesStock) {
    Alert.alert('Recorded', `${reasonLabel(reason.id)}. The till did not change.`);
    return;
  }
  Alert.alert('Recorded', reason?.direction === 'in' ? 'Added to on-hand.' : 'Written off.');
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <MartText variant="meta" color={MART.inkQuiet}>
        {label}
      </MartText>
      <MartText variant="meta" style={styles.factValue} numberOfLines={2}>
        {value}
      </MartText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: MART.paper },
  body: { padding: GUTTER, gap: SPACE.xl, paddingBottom: SPACE.xxxl, backgroundColor: MART.paper },
  identity: { gap: SPACE.xs },
  notice: { padding: SPACE.md, borderRadius: RADIUS.md, backgroundColor: tint(MART.warning, 0.14) },
  form: { gap: SPACE.md },
  facts: { gap: SPACE.sm, paddingTop: SPACE.sm },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.sm },
  factValue: { flexShrink: 1, textAlign: 'right' },
  directions: { flexDirection: 'row', gap: SPACE.sm },
  chip: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  chipOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  reasons: { gap: SPACE.xs },
  reason: { paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md, borderRadius: RADIUS.md },
  reasonOn: { backgroundColor: MART.paperSunken },
  input: {
    minHeight: 48,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
    color: MART.ink,
    fontSize: 20,
  },
  noteLink: { minHeight: 44, justifyContent: 'center' },
});
