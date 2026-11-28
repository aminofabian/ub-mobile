import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { classifyWrite, formatQty, itemLabel, parseQty, QTY_SCALE, qtyProblemWords, readFailureWords, type StockItem } from '@kiosk/core';
import { GUTTER, ItemPicker, MartButton, MartText, MART, RADIUS, SPACE, tint, onFill } from '@kiosk/staff';
import { Ionicons } from '@expo/vector-icons';
import { createTransfer, fetchBranchList } from '../api/stock-api';
import { useStockSession } from '../lib/session';
import { destinations, MAX_TRANSFER_LINES, overdrawn, planProblemWords, planTransfer, type BranchChoice } from '../lib/transfers';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'NewTransfer'>;

type Line = { item: StockItem; units: number };
type Step = 'form' | 'pick' | 'quantity';
type Branches = { state: 'loading' } | { state: 'failed'; words: string } | { state: 'ready'; choices: BranchChoice[] };

/**
 * Sets up a transfer to another branch: where to, which items, how many. The transfer is only a draft until it is sent
 * from its own screen. The server does not read the key a transfer is made with, so asking twice can make two drafts:
 * after an answer that did not come, or could not be read, the screen offers only the Transfers list, to look first.
 */
export function NewTransferScreen({ navigation }: Props) {
  const { api, branchId, renderScanner } = useStockSession();
  const [branches, setBranches] = useState<Branches>({ state: 'loading' });
  const [step, setStep] = useState<Step>('form');
  const [destination, setDestination] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [noteText, setNoteText] = useState('');
  const [picked, setPicked] = useState<StockItem | null>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [unsure, setUnsure] = useState(false);

  const loadBranches = useCallback(async () => {
    setBranches({ state: 'loading' });
    try {
      const list = await fetchBranchList(api);
      setBranches(list ? { state: 'ready', choices: destinations(list, branchId) } : { state: 'failed', words: 'The server sent something the app could not read.' });
    } catch (failure) {
      setBranches({ state: 'failed', words: readFailureWords(failure) });
    }
  }, [api, branchId]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const addLine = useCallback(() => {
    if (!picked) return;
    const entry = parseQty(typed);
    if (!entry.ok) {
      setError(qtyProblemWords(entry.problem));
      return;
    }
    if (!picked.weighed && entry.units % QTY_SCALE !== 0) {
      setError('This item is counted in whole numbers.');
      return;
    }
    setLines((before) => {
      const same = before.find((line) => line.item.id === picked.id);
      return same ? before.map((line) => (line === same ? { item: picked, units: line.units + entry.units } : line)) : [...before, { item: picked, units: entry.units }];
    });
    setError(null);
    setPicked(null);
    setTyped('');
    setStep('form');
  }, [picked, typed]);

  const submit = useCallback(async () => {
    if (working.current || unsure) return;
    const plan = planTransfer({
      fromBranchId: branchId,
      toBranchId: destination ?? '',
      lines: lines.map((line) => ({ itemId: line.item.id, units: line.units })),
      note: noteText,
    });
    if (!plan.ok) {
      setError(planProblemWords(plan.problem));
      return;
    }
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      try {
        const created = await createTransfer(api, plan.body);
        if (!created) {
          setUnsure(true);
          setError('The transfer may have been made, but the server sent something the app could not read. Look at the Transfers list before making another.');
          return;
        }
        navigation.replace('Transfer', { transferId: created.id });
      } catch (failure) {
        const verdict = classifyWrite(failure);
        if (verdict.kind === 'refused') {
          setError(verdict.words);
        } else {
          setUnsure(true);
          setError('There was no clear answer from the server. The transfer may have been made. Look at the Transfers list before making another.');
        }
      }
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, [api, branchId, destination, lines, navigation, noteText, unsure]);

  // Back to the list when it is just underneath (it reads itself again when it comes back into view), else to a new one.
  const lookAtTransfers = useCallback(() => {
    const { routes } = navigation.getState();
    if (routes.length > 1 && routes[routes.length - 2]?.name === 'Transfers') navigation.goBack();
    else navigation.replace('Transfers');
  }, [navigation]);

  if (step === 'pick') {
    return (
      <View style={styles.fill}>
        <View style={styles.pad}>
          <MartButton label="Back" kind="quiet" onPress={() => setStep('form')} />
        </View>
        <ItemPicker
          api={api}
          branchId={branchId}
          onPick={(item) => {
            setPicked(item);
            setTyped('');
            setError(null);
            setStep('quantity');
          }}
          {...(renderScanner ? { renderScanner } : {})}
        />
      </View>
    );
  }

  if (step === 'quantity' && picked) {
    return (
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <MartText variant="title" numberOfLines={2}>
            {itemLabel(picked)}
          </MartText>
          <MartText variant="meta" color={MART.inkQuiet}>
            {picked.onHandUnits === null ? 'Shelf count not known' : `${formatQty(picked.onHandUnits)} on the shelf here`}
          </MartText>
        </View>
        {error ? <Line words={error} /> : null}
        <MartText variant="shelf" color={MART.inkQuiet} style={styles.label}>
          HOW MANY ARE BEING SENT?
        </MartText>
        <TextInput
          value={typed}
          onChangeText={setTyped}
          keyboardType="decimal-pad"
          autoFocus
          selectTextOnFocus
          placeholder="0"
          placeholderTextColor={MART.inkQuiet}
          accessibilityLabel="How many are being sent"
          style={styles.input}
        />
        <MartText variant="meta" color={MART.inkQuiet}>
          {picked.weighed ? 'This item can be counted in fractions.' : 'Whole numbers only.'}
        </MartText>
        <MartButton label="Add to the transfer" onPress={addLine} />
        <MartButton
          label="Cancel"
          kind="quiet"
          onPress={() => {
            setPicked(null);
            setError(null);
            setStep('form');
          }}
        />
      </ScrollView>
    );
  }

  const short = overdrawn(lines.map((line) => ({ name: itemLabel(line.item), units: line.units, onHandUnits: line.item.onHandUnits })));

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      {error ? <Line words={error} /> : null}

      <MartText variant="shelf" color={MART.inkQuiet} style={styles.label}>
        SEND TO
      </MartText>
      {branches.state === 'loading' ? (
        <MartText variant="meta" color={MART.inkQuiet}>
          Reading the branches…
        </MartText>
      ) : null}
      {branches.state === 'failed' ? (
        <>
          <Line words={branches.words} />
          <MartButton label="Try again" kind="quiet" onPress={() => void loadBranches()} />
        </>
      ) : null}
      {branches.state === 'ready' && branches.choices.length === 0 ? (
        <MartText variant="meta" color={MART.inkQuiet}>
          This shop has no other branch to send to.
        </MartText>
      ) : null}
      {branches.state === 'ready' && branches.choices.length > 0 ? (
        <View style={styles.chips}>
          {branches.choices.map((choice) => {
            const on = destination === choice.id;
            return (
              <Pressable
                key={choice.id}
                onPress={() => setDestination(choice.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
              >
                <MartText variant="meta" color={on ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}>
                  {choice.name}
                </MartText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <MartText variant="shelf" color={MART.inkQuiet} style={styles.label}>
        {lines.length === 0 ? 'ITEMS' : `ITEMS · ${lines.length}`}
      </MartText>
      {lines.length === 0 ? (
        <MartText variant="meta" color={MART.inkQuiet}>
          Nothing yet. Add what is going.
        </MartText>
      ) : null}
      <View style={styles.list}>
        {lines.map((line) => (
          <Pressable
            key={line.item.id}
            onPress={() => setLines((before) => before.filter((candidate) => candidate !== line))}
            accessibilityRole="button"
            accessibilityLabel={`${itemLabel(line.item)}, ${formatQty(line.units)}. Take it off the transfer`}
            style={({ pressed }) => [styles.lineRow, pressed && styles.pressed]}
          >
            <View style={{ flex: 1, gap: 1 }}>
              <MartText variant="label" numberOfLines={1}>
                {itemLabel(line.item)}
              </MartText>
              <MartText variant="meta" color={MART.inkQuiet}>
                Tap to take it off
              </MartText>
            </View>
            <MartText variant="label">{formatQty(line.units)}</MartText>
            <Ionicons name="close-circle" size={17} color={MART.inkQuiet} />
          </Pressable>
        ))}
      </View>
      {short.length > 0 ? (
        <Line tone="warn" words={`More than the shelf is known to hold: ${short.join(', ')}. The server decides whether it can go.`} />
      ) : null}
      <MartButton
        label="Add an item"
        kind="quiet"
        onPress={() => {
          setError(null);
          setStep('pick');
        }}
        disabled={lines.length >= MAX_TRANSFER_LINES}
      />

      <MartText variant="shelf" color={MART.inkQuiet} style={styles.label}>
        NOTE (OPTIONAL)
      </MartText>
      <TextInput
        value={noteText}
        onChangeText={setNoteText}
        maxLength={200}
        placeholder="Anything the other branch should know"
        placeholderTextColor={MART.inkQuiet}
        accessibilityLabel="Note"
        style={styles.noteInput}
      />

      {unsure ? (
        <>
          <MartButton label="Look at the Transfers list" onPress={lookAtTransfers} />
          <MartText variant="meta" color={MART.inkQuiet}>
            If the first one went through, making it again would make a second copy.
          </MartText>
        </>
      ) : (
        <>
          <MartButton label={busy ? 'Making it…' : 'Make the transfer'} onPress={() => void submit()} disabled={busy} busy={busy} />
          <MartText variant="meta" color={MART.inkQuiet}>
            It starts as a draft. Nothing leaves the shelf until it is sent.
          </MartText>
        </>
      )}
    </ScrollView>
  );
}

/** One line about something that went wrong, or something worth knowing. */
function Line({ words, tone = 'danger' }: { words: string; tone?: 'danger' | 'warn' }) {
  const colour = tone === 'warn' ? MART.warning : MART.danger;
  return (
    <View style={[styles.line, { backgroundColor: tint(colour, 0.08) }]}>
      <Ionicons name={tone === 'warn' ? 'warning' : 'alert-circle'} size={15} color={colour} />
      <MartText variant="meta" color={colour} style={{ flex: 1 }}>
        {words}
      </MartText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  body: { padding: GUTTER, gap: SPACE.sm, paddingBottom: 96, backgroundColor: MART.paper },
  pad: { padding: GUTTER },
  card: { gap: SPACE.xs, padding: SPACE.md, borderRadius: RADIUS.lg, backgroundColor: MART.paperElevated, borderWidth: 1, borderColor: MART.border },
  label: { letterSpacing: 1.1, marginTop: SPACE.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: MART.paperElevated, borderWidth: 1, borderColor: MART.border },
  chipOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  list: { gap: 6 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  input: { fontSize: 34, fontWeight: '700', color: MART.ink, textAlign: 'center', paddingVertical: 6 },
  noteInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: MART.borderStrong,
    backgroundColor: MART.paperElevated,
    fontSize: 15,
    color: MART.ink,
  },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: RADIUS.md },
  pressed: { opacity: 0.85 },
});
