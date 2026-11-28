import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  addSpoil,
  beginSending,
  claimSpoils,
  classifyWrite,
  clearSpoils,
  decodeSpoils,
  emptySpoils,
  encodeSpoils,
  formatQty,
  itemLabel,
  nextSpoil,
  parseQty,
  QTY_SCALE,
  qtyProblemWords,
  removeSpoil,
  setReason,
  setSpoilUnits,
  SPOIL_REASONS,
  spoilDone,
  spoilNotDone,
  spoilOperations,
  spoilVerdict,
  tenantKeeper,
  wastageBody,
  type ApiClient,
  type ItemHistory,
  type SpoilLine,
  type SpoilList,
  type StockItem,
} from '@kiosk/core';
import { Banner, type BannerTone } from '@kiosk/ui';
import { ItemPicker, type ScannerRenderer } from '../components/ItemPicker';
import { useKept } from '../hooks/useKept';
import { fetchHistory, postWastage } from '../lib/stock-calls';
import { Gloss } from '../theme/Gloss';
import { FONT, MART, RADIUS, SHADOW, SPACE, WEIGHT, onFill } from '../theme/mart';
import { MartButton, MartText, PressableScale } from '../theme/mart-ui';

const CODEC = {
  initial: null as SpoilList | null,
  parse: (text: string | null, now: number): SpoilList | null => decodeSpoils(text, now),
  serialize: (list: SpoilList | null): string | null => encodeSpoils(list),
};

const ADD_WORDS = {
  bad_quantity: 'Enter how many, as a number above zero.',
  too_big: 'That is more than one line of the list can hold.',
  too_many: 'The list is full. Write these off first.',
  busy: 'That item is being written off right now.',
} as const;

type Prompt = { kind: 'add'; item: StockItem } | { kind: 'edit'; line: SpoilLine };
type Note = { tone: BannerTone; text: string };

type Props = {
  api: ApiClient;
  tenantId: string;
  branchId: string;
  /** The signed-in person. A list belongs to them. */
  ownerId: string;
  renderScanner?: ScannerRenderer;
  /** Open with this item ready to be added. */
  addItem?: StockItem;
};

/**
 * A list of stock to write off, and the sending of it. A write-off cannot be recomputed or repeated: the server does not
 * recognise a request it has seen, so a write-off sent twice is taken off twice. So before each one is sent the screen
 * reads the item's history and writes down, on this phone, what it held and what is about to be sent. If the answer is
 * lost (a dead signal, a closed app), the record is what lets the screen look at the history afterwards and say whether
 * the write-off happened. It is never sent a second time on a guess.
 */
export function SpoilsScreen({ api, tenantId, branchId, ownerId, renderScanner, addItem }: Props) {
  const keeper = useMemo(() => tenantKeeper<SpoilList | null>('spoils', tenantId, CODEC), [tenantId]);
  const kept = useKept(keeper);
  const owner = useMemo(() => ({ ownerId, branchId }), [ownerId, branchId]);
  const [view, setView] = useState<'list' | 'add'>('list');
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<Note | null>(null);
  const [confirming, setConfirming] = useState(false);
  // The phone cannot say whether the write-off in doubt went through: the person is asked to say so.
  const [choose, setChoose] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  // Whether the screen is still open. A list being sent goes on with the write-off it has begun, but begins no other once the person has left.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The list belongs to one person at one branch. Someone else's is let go; a write-off in doubt stays, whoever is here.
  useEffect(() => {
    if (!kept.ready) return;
    keeper.update((list) => (list && (list.ownerId !== ownerId || list.branchId !== branchId) ? claimSpoils(list, owner, Date.now()) : list));
  }, [kept.ready, keeper, ownerId, branchId, owner]);

  useEffect(() => {
    if (kept.ready && addItem) {
      setPrompt({ kind: 'add', item: addItem });
      setTyped('1');
      setView('add');
    }
    // Only when the screen opens with an item.
  }, [kept.ready, addItem]);

  const list = kept.value && kept.value.ownerId === ownerId && kept.value.branchId === branchId ? kept.value : kept.value ? { ...emptySpoils(owner, 0), inFlight: kept.value.inFlight } : null;
  const lines = list?.lines ?? [];
  const flight = list?.inFlight ?? null;
  const reason = list?.reason ?? 'SPOILAGE';

  const guard = useCallback(async (job: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await job();
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, []);

  const edit = useCallback(
    (change: (list: SpoilList) => SpoilList) => {
      keeper.update((current) => change(claimSpoils(current, owner, Date.now())));
    },
    [keeper, owner]
  );

  const submitPrompt = useCallback(() => {
    if (!prompt) return;
    const entry = parseQty(typed);
    if (!entry.ok) {
      setNote({ tone: 'danger', text: qtyProblemWords(entry.problem) });
      return;
    }
    const weighed = prompt.kind === 'add' ? prompt.item.weighed : prompt.line.weighed;
    if (!weighed && entry.units % QTY_SCALE !== 0) {
      setNote({ tone: 'danger', text: 'This item is counted in whole numbers.' });
      return;
    }
    if (prompt.kind === 'add') {
      const base = claimSpoils(keeper.get(), owner, Date.now());
      const added = addSpoil(base, { id: prompt.item.id, name: itemLabel(prompt.item), weighed: prompt.item.weighed, buyingCents: prompt.item.buyingCents, sellingCents: prompt.item.sellingCents }, entry.units, Date.now());
      if (!added.ok) {
        setNote({ tone: 'danger', text: ADD_WORDS[added.why] });
        return;
      }
      keeper.update(() => added.list);
    } else {
      edit((current) => setSpoilUnits(current, prompt.line.itemId, entry.units, Date.now()));
    }
    setNote(null);
    setPrompt(null);
    setTyped('');
    setView('list');
  }, [prompt, typed, keeper, owner, edit]);

  const sendAll = useCallback(
    () =>
      guard(async () => {
        setConfirming(false);
        setNote(null);
        let sent = 0;
        for (let turn = 0; turn < 200; turn += 1) {
          if (!mounted.current) return;
          const current = keeper.get();
          const line = current ? nextSpoil(current) : null;
          if (!current || !line) break;
          // 1. What the item's history holds now, so the write-off can be recognised afterwards.
          let baseline: string[];
          try {
            const history = await fetchHistory(api, line.itemId);
            if (!history) {
              setNote({ tone: 'danger', text: `${line.name}: the server sent a history the app could not read. Nothing was written off for this item.` });
              return;
            }
            baseline = [...spoilOperations(history.entries, branchId).keys()];
          } catch {
            setNote({ tone: 'danger', text: `${line.name}: could not check the item first. Check the signal. Nothing was written off for this item.` });
            return;
          }
          // The person may have left while the history was on its way: nothing new is begun then.
          if (!mounted.current) return;
          // 2. Write down what is about to be sent, and be sure it landed before sending it. Only the call that wrote
          // the note may send: another pass (this screen opened again while an earlier one was still going) may have
          // begun a write-off in the meantime, and sending that one again takes the stock off twice.
          if (!beginSending(keeper, line, baseline, Date.now())) {
            setNote({ tone: 'warn', text: 'A write-off is already being sent. Wait for it to finish, then look at the list again.' });
            return;
          }
          const started = keeper.get()?.inFlight ?? null;
          if (!started) return;
          const landed = await keeper.saved();
          if (!landed) {
            keeper.update((latest) => (latest ? spoilNotDone(latest, Date.now()) : latest));
            setNote({ tone: 'danger', text: 'Could not save on this phone, so nothing was sent. Free some space and try again.' });
            return;
          }
          // 3. Send it, once.
          try {
            await postWastage(api, wastageBody({ branchId: started.branchId, itemId: started.itemId, units: started.units, unitCostCents: started.unitCostCents, reason: started.reason }));
          } catch (error) {
            const failure = classifyWrite(error);
            if (failure.kind === 'refused') {
              keeper.update((latest) => (latest ? spoilNotDone(latest, Date.now()) : latest));
              setNote({ tone: 'danger', text: `${started.name}: ${failure.words} Nothing was written off for this item.` });
            } else {
              setNote({ tone: 'warn', text: `${started.name}: there was no clear answer. It may or may not have been written off. Check it below before doing anything else.` });
            }
            return;
          }
          keeper.update((latest) => (latest ? spoilDone(latest, Date.now()) : latest));
          sent += 1;
        }
        if (sent > 0) setNote({ tone: 'ok', text: sent === 1 ? 'Written off.' : `${sent} items written off.` });
      }),
    [api, branchId, guard, keeper]
  );

  const checkNow = useCallback(
    () =>
      guard(async () => {
        const doubt = keeper.get()?.inFlight;
        if (!doubt) return;
        let history: ItemHistory | null = null;
        try {
          history = await fetchHistory(api, doubt.itemId);
        } catch {
          history = null;
        }
        const verdict = spoilVerdict(history, doubt, Date.now());
        setChoose(verdict === 'not_seen' || verdict === 'too_busy');
        if (verdict === 'done') {
          keeper.update((latest) => (latest ? spoilDone(latest, Date.now()) : latest));
          setNote({ tone: 'ok', text: `${doubt.name}: the write-off went through.` });
        } else if (verdict === 'too_soon') {
          setNote({ tone: 'warn', text: 'It is not in the history yet. Give the server a minute, then check again.' });
        } else if (verdict === 'unknown') {
          setNote({ tone: 'danger', text: 'Could not read the item history. Check the signal and try again.' });
        } else if (verdict === 'too_busy') {
          setNote({ tone: 'warn', text: 'This item has had a lot of stock activity since, more than the phone can look back over, so it cannot tell whether the write-off went through. Look at the item\'s history in the back office, then choose below.' });
        } else {
          setNote({ tone: 'warn', text: 'The write-off is not in the history. Choose what to do below.' });
        }
      }),
    [api, guard, keeper]
  );

  if (kept.failed) {
    return (
      <View style={styles.fill}>
        <Gloss />
        <View style={styles.body}>
          <Banner tone="danger">Could not read what is saved on this phone. Nothing was changed.</Banner>
          <MartButton label="Try again" onPress={kept.retry} />
        </View>
      </View>
    );
  }
  if (!kept.ready) {
    return (
      <View style={styles.fill}>
        <Gloss />
        <MartText variant="meta" color={MART.inkQuiet} style={styles.body}>
          Reading what is saved on this phone…
        </MartText>
      </View>
    );
  }

  if (view === 'add') {
    if (prompt) {
      const name = prompt.kind === 'add' ? itemLabel(prompt.item) : prompt.line.name;
      const weighed = prompt.kind === 'add' ? prompt.item.weighed : prompt.line.weighed;
      return (
        <View style={styles.fill}>
          <Gloss />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <MartText variant="title">{name}</MartText>
            </View>
            {note ? <Banner tone={note.tone}>{note.text}</Banner> : null}
            <View style={styles.card}>
              <MartText variant="label" color={MART.inkMuted}>
                How many are being written off?
              </MartText>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={MART.inkQuiet}
                style={styles.field}
              />
              <MartText variant="meta" color={MART.inkQuiet}>
                {weighed ? 'This item can be counted in fractions.' : 'Whole numbers only.'}
              </MartText>
            </View>
            <MartButton label={prompt.kind === 'add' ? 'Add to the list' : 'Save'} onPress={submitPrompt} />
            {prompt.kind === 'edit' ? (
              <PressableScale
                onPress={() => {
                  edit((current) => removeSpoil(current, prompt.line.itemId, Date.now()));
                  setPrompt(null);
                  setView('list');
                }}
                scaleTo={0.98}
                style={styles.dangerBtn}
                accessibilityRole="button"
                accessibilityLabel="Take it off the list"
              >
                <MartText variant="label" color={MART.danger} style={styles.actionLabel}>
                  Take it off the list
                </MartText>
              </PressableScale>
            ) : null}
            <PressableScale
              onPress={() => {
                setPrompt(null);
                setNote(null);
                setView('list');
              }}
              scaleTo={0.98}
              style={styles.quietBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <MartText variant="label" color={MART.inkMuted} style={styles.actionLabel}>
                Cancel
              </MartText>
            </PressableScale>
          </ScrollView>
        </View>
      );
    }
    return (
      <View style={styles.fill}>
        <Gloss />
        <View style={styles.pad}>
          <PressableScale onPress={() => setView('list')} scaleTo={0.98} style={styles.quietBtn} accessibilityRole="button" accessibilityLabel="Back to the list">
            <MartText variant="label" color={MART.inkMuted} style={styles.actionLabel}>
              Back to the list
            </MartText>
          </PressableScale>
          {note ? (
            <Banner tone={note.tone} style={styles.gap}>
              {note.text}
            </Banner>
          ) : null}
        </View>
        <ItemPicker
          api={api}
          branchId={branchId}
          onPick={(item) => {
            // A pack is a way of selling its main item: the server takes a write-off from the main item's stock, and the pack's own history never shows it, so a lost answer could never be settled.
            if (item.packageVariant) {
              setNote({ tone: 'danger', text: `${itemLabel(item)} is a pack. Write off its main item instead.` });
              return;
            }
            setNote(null);
            setTyped('1');
            setPrompt({ kind: 'add', item });
          }}
          {...(renderScanner ? { renderScanner } : {})}
        />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <Gloss />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {note ? <Banner tone={note.tone}>{note.text}</Banner> : null}

        {flight ? (
          <View style={styles.card}>
            <MartText variant="title">Not sure this went through</MartText>
            <MartText variant="body" color={MART.inkMuted}>
              {`Writing off ${formatQty(flight.units)} of ${flight.name} got no clear answer. It may already have been taken off the shelf. Check before doing anything else.`}
            </MartText>
            <MartButton label={busy ? 'Checking…' : 'Check now'} onPress={() => void checkNow()} disabled={busy} busy={busy} />
            {choose ? (
              <>
                <PressableScale
                  onPress={() => {
                    keeper.update((latest) => (latest ? spoilNotDone(latest, Date.now()) : latest));
                    setChoose(false);
                    setNote(null);
                  }}
                  scaleTo={0.98}
                  style={styles.quietBtn}
                  accessibilityRole="button"
                  accessibilityLabel="It did not go through: put it back on the list"
                >
                  <MartText variant="label" color={MART.inkMuted} style={styles.actionLabel}>
                    It did not go through: put it back on the list
                  </MartText>
                </PressableScale>
                <PressableScale
                  onPress={() => {
                    keeper.update((latest) => (latest ? spoilDone(latest, Date.now()) : latest));
                    setChoose(false);
                    setNote(null);
                  }}
                  scaleTo={0.98}
                  style={styles.quietBtn}
                  accessibilityRole="button"
                  accessibilityLabel="It did go through: take it off the list"
                >
                  <MartText variant="label" color={MART.inkMuted} style={styles.actionLabel}>
                    It did go through: take it off the list
                  </MartText>
                </PressableScale>
              </>
            ) : null}
          </View>
        ) : null}

        <MartText variant="shelf" color={MART.inkQuiet} style={styles.eyebrow}>
          WHY WRITE OFF?
        </MartText>
        <View style={styles.chips}>
          {SPOIL_REASONS.map((option) => {
            const on = reason === option.key;
            const off = busy || !!flight;
            return (
              <Pressable
                key={option.key}
                onPress={() => edit((current) => setReason(current, option.key, Date.now()))}
                disabled={off}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: off }}
                style={[styles.chip, on && styles.chipOn, off && styles.dim]}
              >
                <MartText
                  variant="label"
                  color={on ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}
                  style={[styles.chipLabel, on && styles.chipLabelOn]}
                >
                  {option.label}
                </MartText>
              </Pressable>
            );
          })}
        </View>

        {lines.length === 0 ? (
          <View style={styles.empty}>
            <MartText variant="title" style={styles.emptyTitle}>
              Nothing on the list yet
            </MartText>
            <MartText variant="meta" color={MART.inkQuiet} style={styles.emptyCopy}>
              Add spoiled, expired or broken stock, then write it off.
            </MartText>
          </View>
        ) : (
          <View style={styles.list}>
            {lines.map((line) => {
              const locked = busy || (!!flight && flight.itemId === line.itemId);
              return (
                <Pressable
                  key={line.itemId}
                  disabled={locked}
                  onPress={() => {
                    setNote(null);
                    setTyped(formatQty(line.units).replace(/,/g, ''));
                    setPrompt({ kind: 'edit', line });
                    setView('add');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${line.name}, ${formatQty(line.units)}`}
                  style={[styles.row, locked && styles.dim]}
                >
                  <View style={styles.rowLeft}>
                    <MartText variant="heading" numberOfLines={2}>
                      {line.name}
                    </MartText>
                    {flight && flight.itemId === line.itemId ? (
                      <MartText variant="meta" color={MART.warning}>
                        Being written off
                      </MartText>
                    ) : null}
                  </View>
                  <MartText variant="price">{formatQty(line.units)}</MartText>
                </Pressable>
              );
            })}
          </View>
        )}

        <PressableScale
          onPress={() => {
            setNote(null);
            setPrompt(null);
            setView('add');
          }}
          disabled={busy}
          scaleTo={0.98}
          style={[styles.quietBtn, styles.quietFilled, busy && styles.dim]}
          accessibilityRole="button"
          accessibilityLabel="Add an item"
        >
          <MartText variant="label" color={MART.ink} style={styles.actionLabel}>
            Add an item
          </MartText>
        </PressableScale>

        {confirming ? (
          <View style={styles.card}>
            <MartText variant="body" color={MART.inkMuted}>
              {`Write off ${lines.length} ${lines.length === 1 ? 'item' : 'items'} as “${SPOIL_REASONS.find((option) => option.key === reason)?.label ?? ''}”? This lowers the shop's stock records and cannot be undone from the phone.`}
            </MartText>
            <MartButton label={busy ? 'Working…' : 'Yes, write them off'} onPress={() => void sendAll()} disabled={busy} busy={busy} />
            <PressableScale
              onPress={() => setConfirming(false)}
              disabled={busy}
              scaleTo={0.98}
              style={[styles.quietBtn, busy && styles.dim]}
              accessibilityRole="button"
              accessibilityLabel="Not yet"
            >
              <MartText variant="label" color={MART.inkMuted} style={styles.actionLabel}>
                Not yet
              </MartText>
            </PressableScale>
          </View>
        ) : (
          <MartButton
            label={`Write off ${lines.length || ''}`.trim()}
            onPress={() => setConfirming(true)}
            disabled={busy || lines.length === 0 || !!flight}
          />
        )}
        {lines.length > 0 && !flight ? (
          <PressableScale
            onPress={() => edit((current) => clearSpoils(current, Date.now()))}
            disabled={busy}
            scaleTo={0.98}
            style={[styles.quietBtn, busy && styles.dim]}
            accessibilityRole="button"
            accessibilityLabel="Clear the list"
          >
            <MartText variant="label" color={MART.danger} style={styles.actionLabel}>
              Clear the list
            </MartText>
          </PressableScale>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  body: { padding: SPACE.md, gap: SPACE.md, paddingBottom: SPACE.xxxl },
  pad: { padding: SPACE.md, gap: SPACE.sm },
  card: {
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    padding: SPACE.md,
    gap: SPACE.sm,
    ...SHADOW.card,
  },
  gap: { marginTop: SPACE.sm },
  eyebrow: { letterSpacing: 1.1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paperSunken,
  },
  chipOn: { backgroundColor: MART.fallbackPrimary },
  chipLabel: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium },
  chipLabelOn: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  list: { gap: SPACE.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    minHeight: 56,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    ...SHADOW.card,
  },
  rowLeft: { flex: 1, gap: 2 },
  empty: { alignItems: 'center', paddingVertical: SPACE.xl, gap: SPACE.sm },
  emptyTitle: { textAlign: 'center' },
  emptyCopy: { textAlign: 'center', maxWidth: 280 },
  field: {
    minHeight: 52,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperSunken,
    color: MART.ink,
    fontFamily: FONT.regular,
    fontSize: 17,
    fontWeight: WEIGHT.regular,
  },
  quietBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.lg,
  },
  quietFilled: {
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
  },
  dangerBtn: {
    minHeight: 48,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.dangerSurface,
  },
  actionLabel: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold },
  dim: { opacity: 0.5 },
});
