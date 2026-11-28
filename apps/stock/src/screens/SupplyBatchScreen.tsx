import React, { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { classifyWrite, formatQty, readFailureWords, SPOIL_REASONS, type SpoilReason } from '@kiosk/core';
import type { BannerTone } from '@kiosk/ui';
import { GUTTER, MartText, MART, RADIUS, SPACE, tint, onFill } from '@kiosk/staff';
import { Ionicons } from '@expo/vector-icons';
import { clearSupplyBatch, fetchSupplyDetail } from '../api/stock-api';
import { todayOn } from '../lib/dates';
import { useStockSession } from '../lib/session';
import { canClear, didClearHappen, expiryState, expiryWords, sourceWords, statusWords, type SupplyDetail, type SupplyStatus } from '../lib/supply-batches';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'Batch'>;

type Loaded = { state: 'loading' } | { state: 'failed'; words: string } | { state: 'ready'; batch: SupplyDetail };
type Note = { tone: BannerTone; text: string };

/** One delivery with its lots, how long each has left, and (for someone who may write stock) a way to write off what is left of it. */
export function SupplyBatchScreen({ route }: Props) {
  const { api, mayWrite } = useStockSession();
  const { batchId } = route.params;
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [reason, setReason] = useState<SpoilReason>('EXPIRED');
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  const load = useCallback(async (): Promise<SupplyDetail | null> => {
    const batch = await fetchSupplyDetail(api, batchId);
    setLoaded(batch ? { state: 'ready', batch } : { state: 'failed', words: 'The server sent something the app could not read.' });
    return batch;
  }, [api, batchId]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void load().catch((error: unknown) => {
        if (live) setLoaded({ state: 'failed', words: readFailureWords(error) });
      });
      return () => {
        live = false;
      };
    }, [load, attempt])
  );

  const clear = useCallback(async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setNote(null);
    try {
      try {
        await clearSupplyBatch(api, batchId, reason);
      } catch (error) {
        const failure = classifyWrite(error);
        if (failure.kind === 'refused') {
          setNote({ tone: 'danger', text: failure.words });
          return;
        }
        // No clear answer: the batch itself says whether it was cleared.
        try {
          const now = await load();
          const happened = didClearHappen(now ?? undefined);
          setNote(
            happened === 'done'
              ? { tone: 'ok', text: 'It went through. What was left has been written off.' }
              : happened === 'not_done'
                ? { tone: 'warn', text: 'It did not go through. You can try again.' }
                : { tone: 'warn', text: 'There was no clear answer and the batch cannot be checked now. Look at it again before trying again.' }
          );
        } catch {
          setNote({ tone: 'warn', text: 'There was no clear answer and the batch cannot be checked now. Look at it again before trying again.' });
        }
        return;
      }
      try {
        await load();
        setNote({ tone: 'ok', text: 'What was left has been written off.' });
      } catch {
        setNote({ tone: 'ok', text: 'Done. The batch could not be read again just now.' });
      }
    } finally {
      working.current = false;
      setBusy(false);
    }
  }, [api, batchId, load, reason]);

  if (loaded.state === 'loading') {
    return (
      <View style={styles.body}>
        <MartText variant="meta" color={MART.inkQuiet}>
          Reading the record…
        </MartText>
      </View>
    );
  }
  if (loaded.state === 'failed') {
    return (
      <View style={styles.body}>
        <Line tone="danger" words={loaded.words} />
        <Pressable
          onPress={() => {
            setLoaded({ state: 'loading' });
            setAttempt((n) => n + 1);
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        >
          <MartText variant="label">Try again</MartText>
        </Pressable>
      </View>
    );
  }

  const { batch } = loaded;
  const today = todayOn(Date.now());
  const mayClear = canClear(batch, mayWrite);
  const reasonLabel = SPOIL_REASONS.find((option) => option.key === reason)?.label ?? '';
  const isDelivery = batch.source === 'delivery';

  /** What this record is, in the shop's words: a supplier's delivery, a count that found more, or opening stock. */
  const heading = isDelivery ? (batch.supplier || 'A delivery') : sourceWords(batch);
  const under = isDelivery
    ? batch.name || batch.number
    : batch.source === 'stock-gain'
      ? 'A stock count found more than the system held.'
      : batch.source === 'opening'
        ? 'The stock the shop started with.'
        : 'Not a supplier delivery.';

  return (
    <ScrollView contentContainerStyle={styles.body}>
      {note ? <Line tone={note.tone === 'ok' ? 'ok' : note.tone === 'danger' ? 'danger' : 'warn'} words={note.text} /> : null}

      <View style={styles.headCard}>
        <View style={styles.headRow}>
          <MartText variant="shelf" color={MART.inkQuiet} style={styles.eyebrow}>
            {isDelivery ? 'DELIVERY' : 'NOT A DELIVERY'}
          </MartText>
          <View style={[styles.pill, { backgroundColor: tint(statusColour(batch.status), 0.12) }]}>
            <MartText variant="shelf" color={statusColour(batch.status)}>
              {statusWords(batch.status).toUpperCase()}
            </MartText>
          </View>
        </View>
        <MartText variant="title" numberOfLines={2}>
          {heading}
        </MartText>
        <MartText variant="meta" color={MART.inkQuiet} numberOfLines={2}>
          {isDelivery ? `${under} · ${batch.number}` : under}
        </MartText>
        {batch.remainingUnits !== null ? (
          <View style={styles.figures}>
            <MartText variant="title">{formatQty(batch.remainingUnits)}</MartText>
            <MartText variant="meta" color={MART.inkQuiet} style={{ flex: 1 }}>
              {batch.initialUnits !== null
                ? `left of ${formatQty(batch.initialUnits)}${batch.soldPercent !== null ? ` · ${batch.soldPercent}% sold` : ''}`
                : 'left'}
            </MartText>
          </View>
        ) : null}
      </View>

      <MartText variant="shelf" color={MART.inkQuiet} style={styles.section}>
        {batch.items.length === 0 ? 'ITEMS' : `ITEMS · ${batch.items.length}`}
      </MartText>
      {batch.items.length === 0 ? (
        <MartText variant="meta" color={MART.inkQuiet}>
          Nothing is listed against this record.
        </MartText>
      ) : null}
      <View style={styles.list}>
        {batch.items.map((item) => {
          const state = expiryState(item, today);
          const words = expiryWords(item, today);
          return (
            <View key={item.id} style={styles.itemRow}>
              <View style={{ flex: 1, gap: 1 }}>
                <MartText variant="label" numberOfLines={1}>
                  {item.name}
                </MartText>
                <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
                  {[item.lot ? `Lot ${item.lot}` : '', words].filter(Boolean).join(' · ') || 'No lot'}
                </MartText>
              </View>
              {item.remainingUnits === null ? null : (
                <View style={[styles.pill, { backgroundColor: tint(state === 'expired' ? MART.danger : state === 'soon' ? MART.warning : MART.inkQuiet, 0.12) }]}>
                  <MartText variant="shelf" color={state === 'expired' ? MART.danger : state === 'soon' ? MART.warning : MART.inkMuted}>
                    {`${formatQty(item.remainingUnits)} LEFT`}
                  </MartText>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {mayClear ? (
        <View style={styles.card}>
          <MartText variant="title">Write off what is left</MartText>
          <MartText variant="meta" color={MART.inkMuted}>
            {isDelivery ? 'Takes the rest of this delivery off the shelf in one go.' : 'Takes the rest of this record off the shelf in one go.'}
          </MartText>
          <View style={styles.chips}>
            {SPOIL_REASONS.map((option) => {
              const on = reason === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setReason(option.key)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
                >
                  <MartText variant="meta" color={on ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}>
                    {option.label}
                  </MartText>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() =>
              Alert.alert(
                'Write off the rest?',
                `${batch.remainingUnits === null ? 'Everything left' : `${formatQty(batch.remainingUnits)} left`} is taken off the shelf as “${reasonLabel}”. This cannot be undone from the phone.`,
                [
                  { text: 'Not yet', style: 'cancel' },
                  { text: 'Write it off', style: 'destructive', onPress: () => void clear() },
                ]
              )
            }
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [styles.danger, busy && styles.off, pressed && styles.pressed]}
          >
            <MartText variant="label" color={onFill(MART.danger).primary}>
              {busy ? 'Working…' : 'Write off the rest'}
            </MartText>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function statusColour(status: SupplyStatus): string {
  if (status === 'active') return MART.success;
  if (status === 'soldout') return MART.inkQuiet;
  return MART.inkMuted;
}

/** One line about what happened: tinted, with the glyph that matches. */
function Line({ words, tone }: { words: string; tone: 'ok' | 'warn' | 'danger' }) {
  const colour = tone === 'danger' ? MART.danger : tone === 'warn' ? MART.warning : MART.success;
  return (
    <View style={[styles.line, { backgroundColor: tint(colour, 0.08) }]}>
      <Ionicons name={tone === 'danger' ? 'alert-circle' : tone === 'warn' ? 'warning' : 'checkmark-circle'} size={15} color={colour} />
      <MartText variant="meta" color={colour} style={{ flex: 1 }}>
        {words}
      </MartText>
    </View>
  );
}


const styles = StyleSheet.create({
  body: { flexGrow: 1, padding: GUTTER, gap: SPACE.sm, paddingBottom: 116, backgroundColor: MART.paper },
  headCard: {
    gap: 4,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  eyebrow: { letterSpacing: 1.1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  figures: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.sm, marginTop: 6 },
  section: { letterSpacing: 1.1, marginTop: SPACE.sm },
  list: { gap: 6 },
  itemRow: {
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
  card: {
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
    marginTop: SPACE.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: MART.paperElevated, borderWidth: 1, borderColor: MART.border },
  chipOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  danger: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: MART.danger },
  off: { backgroundColor: tint(MART.danger, 0.35) },
  pressed: { opacity: 0.85 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: RADIUS.md },
});
