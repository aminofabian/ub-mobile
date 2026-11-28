import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  batchDecreaseBody,
  classifyWrite,
  formatQty,
  itemLabel,
  parseQty,
  planDecreaseCalls,
  planSetOnHand,
  QTY_SCALE,
  qtyProblemWords,
  stockIncreaseBody,
  type ApiClient,
  type SetOnHandProblem,
  type StockItem,
} from '@kiosk/core';
import { ItemPicker, type ScannerRenderer } from '../components/ItemPicker';
import { fetchAllocation, fetchFreshItem, postBatchDecrease, postStockIncrease } from '../lib/stock-calls';
import { Gloss } from '../theme/Gloss';
import { FONT, GUTTER, MART, RADIUS, SHADOW, SPACE, WEIGHT, tint, zoneFor } from '../theme/mart';
import { MartButton, MartText, PressableScale } from '../theme/mart-ui';

type Plan = { kind: 'increase'; units: number; unitCostCents: number; note: string } | { kind: 'decrease'; units: number; note: string };

type Step =
  | { name: 'pick' }
  | { name: 'edit'; item: StockItem }
  | { name: 'confirm'; item: StockItem; targetUnits: number; basisUnits: number; plan: Plan }
  | { name: 'done'; item: StockItem | null; tone: 'ok' | 'warn' | 'danger'; words: string };

const PROBLEM_WORDS: Record<SetOnHandProblem, string> = {
  current_unknown: 'The shelf count is not known for this item here, so it cannot be set.',
  pack_variant: 'This is a pack. Change the stock of its main item instead.',
};

type Outcome = { ok: true } | { ok: false; kind: 'refused' | 'doubt'; words: string; removed: number; of: number };

/** The two letters that stand for the product, as its tile shows them. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? words[0]?.[1] ?? '')).toUpperCase();
}

/** Makes the shelf hold the number asked for: one increase, or one removal per batch the server says it would take from. */
async function perform(api: ApiClient, branchId: string, item: StockItem, plan: Plan): Promise<Outcome> {
  if (plan.kind === 'increase') {
    try {
      await postStockIncrease(api, stockIncreaseBody(branchId, item.id, plan));
      return { ok: true };
    } catch (error) {
      const failure = classifyWrite(error);
      return failure.kind === 'refused'
        ? { ok: false, kind: 'refused', words: failure.words, removed: 0, of: 1 }
        : { ok: false, kind: 'doubt', words: '', removed: 0, of: 1 };
    }
  }
  let preview: unknown;
  try {
    preview = await fetchAllocation(api, item.id, branchId, plan.units);
  } catch {
    return { ok: false, kind: 'refused', words: 'Could not ask the server which batches to take from. Nothing was changed.', removed: 0, of: 0 };
  }
  const calls = planDecreaseCalls(preview, plan.units);
  if (!calls.ok) {
    const words =
      calls.problem === 'none'
        ? 'The server has no batch to take this from. Nothing was changed.'
        : `Only ${formatQty(calls.coveredUnits)} can be taken from the item's batches. Nothing was changed.`;
    return { ok: false, kind: 'refused', words, removed: 0, of: 0 };
  }
  let removed = 0;
  for (const call of calls.calls) {
    try {
      await postBatchDecrease(api, batchDecreaseBody(call, plan.note));
      removed += 1;
    } catch (error) {
      const failure = classifyWrite(error);
      return failure.kind === 'refused'
        ? { ok: false, kind: 'refused', words: failure.words, removed, of: calls.calls.length }
        : { ok: false, kind: 'doubt', words: '', removed, of: calls.calls.length };
    }
  }
  return { ok: true };
}

type Props = {
  api: ApiClient;
  branchId: string;
  renderScanner?: ScannerRenderer;
  itemId?: string;
  /** Drawn inside a sheet: no page wash of its own, and tighter padding, because the sheet already frames it. */
  inline?: boolean;
};

/**
 * Set how many of one item are on the shelf. Pick the item, type the count, review, then confirm.
 * The change is checked against the shelf once more just before it is sent.
 */
export function SetStockScreen({ api, branchId, renderScanner, itemId, inline = false }: Props) {
  const [step, setStep] = useState<Step>(itemId ? { name: 'done', item: null, tone: 'ok', words: 'Loading…' } : { name: 'pick' });
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

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

  const open = useCallback(
    (id: string) =>
      guard(async () => {
        setError(null);
        try {
          const item = await fetchFreshItem(api, branchId, id);
          if (!item) {
            setStep({ name: 'pick' });
            setError('The server sent something the app could not read.');
            return;
          }
          setTyped('');
          setStep({ name: 'edit', item });
        } catch {
          setStep({ name: 'pick' });
          setError('Could not load the item. Check the signal and try again.');
        }
      }),
    [api, branchId, guard]
  );

  useEffect(() => {
    if (itemId) void open(itemId);
  }, [itemId, open]);

  const review = useCallback(
    (item: StockItem) =>
      guard(async () => {
        setError(null);
        const entry = parseQty(typed, { allowZero: true });
        if (!entry.ok) {
          setError(qtyProblemWords(entry.problem));
          return;
        }
        if (!item.weighed && entry.units % QTY_SCALE !== 0) {
          setError('This item is counted in whole numbers.');
          return;
        }
        let fresh: StockItem | null;
        try {
          fresh = await fetchFreshItem(api, branchId, item.id);
        } catch {
          setError('Could not check the shelf. Check the signal and try again.');
          return;
        }
        if (!fresh) {
          setError('The server sent something the app could not read.');
          return;
        }
        const planned = planSetOnHand({
          currentUnits: fresh.onHandUnits,
          targetUnits: entry.units,
          buyingCents: fresh.buyingCents,
          packageVariant: fresh.packageVariant,
        });
        if (!planned.ok) {
          setError(PROBLEM_WORDS[planned.problem]);
          return;
        }
        if (planned.plan.kind === 'same') {
          setStep({
            name: 'done',
            item: fresh,
            tone: 'ok',
            words: `The shelf already holds ${formatQty(entry.units)}. Nothing to change.`,
          });
          return;
        }
        setStep({ name: 'confirm', item: fresh, targetUnits: entry.units, basisUnits: fresh.onHandUnits ?? 0, plan: planned.plan });
      }),
    [api, branchId, guard, typed]
  );

  const apply = useCallback(
    (current: Extract<Step, { name: 'confirm' }>) =>
      guard(async () => {
        let fresh: StockItem | null;
        try {
          fresh = await fetchFreshItem(api, branchId, current.item.id);
        } catch {
          setError('Could not check the shelf. Nothing was changed. Check the signal and try again.');
          return;
        }
        if (!fresh || fresh.onHandUnits !== current.basisUnits) {
          setStep({ name: 'edit', item: fresh ?? current.item });
          setError(
            fresh?.onHandUnits != null
              ? `The shelf changed to ${formatQty(fresh.onHandUnits)} while you were deciding. Nothing was changed. Look again.`
              : 'Could not check the shelf. Nothing was changed.'
          );
          return;
        }
        const outcome = await perform(api, branchId, current.item, current.plan);
        let after: StockItem | null = null;
        try {
          after = await fetchFreshItem(api, branchId, current.item.id);
        } catch {
          after = null;
        }
        const now = after?.onHandUnits != null ? ` The shelf now shows ${formatQty(after.onHandUnits)}.` : '';
        if (outcome.ok) {
          setStep({ name: 'done', item: after ?? current.item, tone: 'ok', words: `Done.${now}` });
          return;
        }
        if (outcome.kind === 'refused') {
          const partly = outcome.removed > 0 ? ` ${outcome.removed} of ${outcome.of} removals went through before that.` : '';
          setStep({ name: 'done', item: after ?? current.item, tone: 'danger', words: `${outcome.words}${partly}${now}` });
          return;
        }
        const partly = outcome.removed > 0 ? ` ${outcome.removed} of ${outcome.of} removals had gone through.` : '';
        setStep({
          name: 'done',
          item: after ?? current.item,
          tone: 'warn',
          words: `There was no clear answer from the server.${partly}${now || ' Could not read the shelf.'} Look at the number before changing it again: it may already have been changed.`,
        });
      }),
    [api, branchId, guard]
  );

  if (step.name === 'pick') {
    return (
      <View style={inline ? styles.fillInline : styles.fill}>
        {!inline ? <Gloss /> : null}
        {error ? (
          <View style={styles.banner}>
            <NoteLine tone="danger" words={error} />
          </View>
        ) : null}
        <ItemPicker
          api={api}
          branchId={branchId}
          onPick={(item) => void open(item.id)}
          withFilters
          {...(renderScanner ? { renderScanner } : {})}
        />
      </View>
    );
  }

  const shown: StockItem | null = step.item;

  return (
    <View style={inline ? styles.fillInline : styles.fill}>
      {!inline ? <Gloss /> : null}
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {shown ? (
          <View style={[styles.card, styles.itemCard]}>
            <View style={[styles.mark, { backgroundColor: tint(zoneFor(shown.name), 0.18) }]}>
              <MartText variant="label" color={tint(MART.ink, 0.66)}>
                {initialsOf(shown.name)}
              </MartText>
            </View>
            <View style={styles.itemText}>
              <MartText variant="title" numberOfLines={2}>
                {itemLabel(shown)}
              </MartText>
              <MartText variant="meta" color={MART.inkQuiet}>
                {shown.onHandUnits === null ? 'Shelf count not known' : `${formatQty(shown.onHandUnits)} on the shelf now`}
              </MartText>
            </View>
          </View>
        ) : (
          <MartText variant="meta" color={MART.inkQuiet}>
            Loading…
          </MartText>
        )}
        {error ? <NoteLine tone="danger" words={error} /> : null}

        {step.name === 'edit' ? (
          <>
            <MartText variant="shelf" color={MART.inkQuiet} style={styles.eyebrow}>
              HOW MANY DID YOU COUNT?
            </MartText>
            <View style={styles.countRow}>
              <TextInput
                value={typed}
                onChangeText={setTyped}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={MART.inkQuiet}
                returnKeyType="done"
                autoFocus
                selectTextOnFocus
                onSubmitEditing={() => void review(step.item)}
                accessibilityLabel="How many did you count"
                style={styles.field}
              />
              <PressableScale
                onPress={() => void review(step.item)}
                disabled={busy || typed.trim() === ''}
                scaleTo={0.94}
                style={[styles.tick, (busy || typed.trim() === '') && styles.tickOff]}
                accessibilityRole="button"
                accessibilityLabel="Save this count"
              >
                <Ionicons name="checkmark" size={26} color={MART.paper} />
              </PressableScale>
            </View>
            <MartText variant="meta" color={MART.inkQuiet}>
              {step.item.weighed ? 'Fractions are allowed for this item.' : 'Whole numbers only.'}
            </MartText>
            <PressableScale
              onPress={() => {
                setError(null);
                setStep({ name: 'pick' });
              }}
              scaleTo={0.98}
              style={styles.quietBtn}
              accessibilityRole="button"
              accessibilityLabel="Pick another item"
            >
              <MartText variant="label" color={MART.inkMuted} style={styles.quietLabel}>
                Pick another item
              </MartText>
            </PressableScale>
          </>
        ) : null}

        {step.name === 'confirm' ? (
          <>
            <View style={styles.changeCard}>
              <MartText variant="shelf" color={MART.inkQuiet} style={styles.eyebrow}>
                {step.plan.kind === 'increase' ? 'COUNTED MORE THAN THE SYSTEM HELD' : 'COUNTED LESS THAN THE SYSTEM HELD'}
              </MartText>
              <View style={styles.changeRow}>
                <MartText variant="display" color={step.plan.kind === 'increase' ? MART.success : MART.warning}>
                  {`${step.plan.kind === 'increase' ? '+' : '−'}${formatQty(step.plan.units)}`}
                </MartText>
                <View style={styles.changeFrom}>
                  <MartText variant="meta" color={MART.inkQuiet}>
                    {`${formatQty(step.basisUnits)} now`}
                  </MartText>
                  <MartText variant="meta" color={MART.inkQuiet}>
                    {`${formatQty(step.targetUnits)} after`}
                  </MartText>
                </View>
              </View>
            </View>
            <MartText variant="meta" color={MART.inkQuiet} style={styles.note}>
              This changes the shop's stock records. The change is checked against the shelf once more just before it is sent.
            </MartText>
            <MartButton label={busy ? 'Working…' : 'Confirm'} onPress={() => void apply(step)} disabled={busy} busy={busy} />
            <PressableScale
              onPress={() => setStep({ name: 'edit', item: step.item })}
              disabled={busy}
              scaleTo={0.98}
              style={[styles.quietBtn, busy && styles.dim]}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <MartText variant="label" color={MART.inkMuted} style={styles.quietLabel}>
                Back
              </MartText>
            </PressableScale>
          </>
        ) : null}

        {step.name === 'done' ? (
          <>
            {step.item ? <NoteLine tone={step.tone} words={step.words} /> : null}
            {step.item ? (
              <MartButton
                label="Set another item"
                onPress={() => {
                  setError(null);
                  setStep({ name: 'pick' });
                }}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** A single line about something that happened, or something worth knowing. */
function NoteLine({ tone, words }: { tone: 'ok' | 'warn' | 'danger' | 'info'; words: string }) {
  const colour = tone === 'danger' ? MART.danger : tone === 'warn' ? MART.warning : tone === 'ok' ? MART.success : MART.inkMuted;
  return (
    <View style={[styles.noteLine, { backgroundColor: tint(colour, 0.08) }]}>
      <Ionicons
        name={tone === 'danger' ? 'alert-circle' : tone === 'warn' ? 'warning' : tone === 'ok' ? 'checkmark-circle' : 'information-circle'}
        size={15}
        color={colour}
      />
      <MartText variant="meta" color={colour} style={{ flex: 1 }}>
        {words}
      </MartText>
    </View>
  );
}

const styles = StyleSheet.create({
  noteLine: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: RADIUS.md },
  changeCard: {
    gap: 6,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  changeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACE.md },
  changeFrom: { flex: 1, gap: 1, paddingBottom: 6 },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  itemText: { flex: 1, gap: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  tick: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.fallbackPrimary,
  },
  tickOff: { backgroundColor: tint(MART.fallbackPrimary, 0.35) },
  mark: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1, backgroundColor: MART.paper },
  fillInline: { flex: 1 },
  body: { padding: GUTTER, gap: SPACE.md, paddingBottom: 116 },
  banner: { paddingHorizontal: GUTTER, paddingTop: SPACE.sm },
  card: {
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    padding: SPACE.md,
    gap: SPACE.sm,
    ...SHADOW.card,
  },
  eyebrow: { letterSpacing: 1.1 },
  field: {
    flex: 1,
    minHeight: 56,
    textAlign: 'center',
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperSunken,
    color: MART.ink,
    fontFamily: FONT.regular,
    fontSize: 17,
    fontWeight: WEIGHT.regular,
  },
  note: { marginBottom: SPACE.xs },
  quietBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.lg,
  },
  quietLabel: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium },
  dim: { opacity: 0.5 },
});
