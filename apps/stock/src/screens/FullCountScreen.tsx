import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { readFailureWords } from '@kiosk/core';
import { GUTTER, MART, MartButton, RADIUS, SPACE, tint, MartText, onFill } from '@kiosk/staff';
import { cancelCycle, fetchCycleHome, openNextBatch, startCycle } from '../api/count-cycle-api';
import { cycleProgress, dayMarks, todayPrompt, batchPostingWords, cycleIsActive, cycleIsCompleted, type CountCycle, type CycleHome } from '../lib/count-cycle';
import { useStockSession } from '../lib/session';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'FullCount'>;

const BATCH_SIZES = [25, 50, 100, 200];

type Phase =
  | { name: 'loading' }
  | { name: 'failed'; words: string }
  | { name: 'home'; home: CycleHome };

/** A thin progress bar: the filled part is the brand green, the rest a quiet well. */
function Bar({ value }: { value: number }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <MartText variant="title">{value}</MartText>
      <MartText variant="meta" color={MART.inkQuiet}>
        {label}
      </MartText>
    </View>
  );
}

/**
 * The home of the full count: the running cycle's progress and the batch to count next, or — when none is running —
 * a plan to start one. Counting the whole shop happens a batch at a time over several days; the server holds the
 * cycle and this reads it fresh each time the screen opens.
 */
export function FullCountScreen({ navigation }: Props) {
  const { api, branchId, branchName, mayCount, mayClose } = useStockSession();
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState<number | null>(null);
  const [planningNext, setPlanningNext] = useState(false);

  const load = useCallback(async () => {
    try {
      const home = await fetchCycleHome(api, branchId);
      if (!home) {
        setPhase({ name: 'failed', words: 'The server sent something the app could not read.' });
        return;
      }
      setPhase({ name: 'home', home });
      setSize((current) => current ?? home.defaultBatchSize);
    } catch (error) {
      setPhase({ name: 'failed', words: readFailureWords(error) });
    }
  }, [api, branchId]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        if (live) await load();
      })();
      return () => {
        live = false;
      };
    }, [load])
  );

  const guard = useCallback(async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } finally {
      setBusy(false);
    }
  }, []);

  const onStart = useCallback(
    () =>
      guard(async () => {
        try {
          const cycle = await startCycle(api, branchId, size ?? 50);
          if (!cycle) {
            Alert.alert('Could not start', 'The server sent something the app could not read. Nothing was started.');
            return;
          }
          await load();
          setPlanningNext(false);
        } catch (error) {
          Alert.alert('Could not start the full count', readFailureWords(error));
        }
      }),
    [api, branchId, size, guard, load]
  );

  const onOpenBatch = useCallback(
    (cycle: CountCycle) =>
      guard(async () => {
        try {
          // If a batch is already in progress, go straight to it; otherwise open the next one.
          const active = cycle.activeBatch;
          const batch = active ? { sessionId: active.sessionId } : await openNextBatch(api, cycle.cycleId);
          if (!batch) {
            Alert.alert('Could not open a batch', 'The server sent something the app could not read.');
            return;
          }
          navigation.navigate('BatchCount', { sessionId: batch.sessionId });
        } catch (error) {
          Alert.alert('Could not open a batch', readFailureWords(error));
        }
      }),
    [api, guard, navigation]
  );

  const onCancel = useCallback(
    (cycle: CountCycle) => {
      Alert.alert('Cancel the full count?', 'The counts already applied stay. The rest of the cycle is dropped.', [
        { text: 'Keep counting', style: 'cancel' },
        {
          text: 'Cancel it',
          style: 'destructive',
          onPress: () =>
            void guard(async () => {
              try {
                await cancelCycle(api, cycle.cycleId);
                await load();
              } catch (error) {
                Alert.alert('Could not cancel', readFailureWords(error));
              }
            }),
        },
      ]);
    },
    [api, guard, load]
  );

  if (phase.name === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={MART.fallbackPrimary} />
      </View>
    );
  }

  if (phase.name === 'failed') {
    return (
      <View style={styles.centerPad}>
        <Ionicons name="cloud-offline-outline" size={40} color={MART.inkQuiet} />
        <MartText variant="heading" style={styles.centerText}>
          Could not load the full count
        </MartText>
        <MartText variant="meta" color={MART.inkQuiet} style={styles.centerText}>
          {phase.words}
        </MartText>
        <Pressable onPress={() => void load()} style={styles.retry}>
          <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
            Try again
          </MartText>
        </Pressable>
      </View>
    );
  }

  const { home } = phase;
  const cycle = home.cycle && (cycleIsActive(home.cycle.status) || cycleIsCompleted(home.cycle.status)) ? home.cycle : null;

  // ---- No cycle running, or a finished one being planned again ---------------------------------
  if (!cycle || planningNext) {
    const batches = size && size > 0 ? Math.ceil(home.catalogSize / size) : 0;
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {planningNext ? (
          <Pressable accessibilityRole="button" onPress={() => setPlanningNext(false)} style={styles.backLink}>
            <MartText variant="label" color={MART.fallbackPrimaryLift}>
              Back to this count
            </MartText>
          </Pressable>
        ) : null}
        <View style={styles.card}>
          <MartText variant="title">Count the shop in batches</MartText>
          <MartText variant="body" color={MART.inkMuted}>
            {home.catalogSize === 0
              ? 'There are no stocked products to count yet.'
              : `${home.catalogSize} ${home.catalogSize === 1 ? 'item' : 'items'}${branchName ? ` at ${branchName}` : ''}. Each batch is one day's work.`}
          </MartText>
          <MartText variant="meta" color={MART.inkQuiet}>
            How many items in a batch
          </MartText>
          <View style={styles.chips}>
            {BATCH_SIZES.map((option) => {
              const on = size === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setSize(option)}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <MartText variant="label" color={on ? onFill(MART.fallbackPrimary).primary : MART.ink}>
                    {option}
                  </MartText>
                </Pressable>
              );
            })}
          </View>
          {batches > 0 ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              About {batches} {batches === 1 ? 'day' : 'days'} to finish the shop.
            </MartText>
          ) : null}
          {mayClose && home.catalogSize > 0 ? (
            <MartButton label="Start the full count" busy={busy} disabled={busy || size == null} onPress={() => void onStart()} />
          ) : !mayClose ? (
            <MartText variant="meta" color={MART.inkQuiet}>
              Ask a manager to start a full count.
            </MartText>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  // ---- A cycle is running: its overview ---------------------------------------------------------
  const progress = cycleProgress(cycle);
  const prompt = todayPrompt(cycle);
  const marks = dayMarks(cycle);
  const awaiting = cycle.awaitingApplyCount;
  const completed = cycleIsCompleted(cycle.status);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {prompt && (mayCount || mayClose) ? (
        <View style={styles.next}>
          <MartText variant="title">{prompt.title}</MartText>
          <MartText variant="meta" color={MART.inkQuiet}>
            {prompt.body}
          </MartText>
          <MartButton label={prompt.action} busy={busy} disabled={busy} onPress={() => void onOpenBatch(cycle)} />
        </View>
      ) : !completed && cycle.remainingItems === 0 ? (
        <View style={styles.doneCard}>
          <Ionicons name="checkmark-circle" size={22} color={MART.success} />
          <MartText variant="label" color={MART.success}>
            Every item has been counted. A manager can post the batches that are still waiting.
          </MartText>
        </View>
      ) : null}
      <View style={styles.card}>
        <View style={styles.overviewHead}>
          <View style={{ flex: 1 }}>
            <MartText variant="title">
              {completed ? 'Full count finished' : `${cycle.countedItems} of ${cycle.totalItems} counted`}
            </MartText>
            {branchName ? (
              <MartText variant="meta" color={MART.inkQuiet}>
                {branchName}
              </MartText>
            ) : null}
          </View>
          <View style={[styles.pct, { backgroundColor: tint(MART.fallbackPrimary, 0.12) }]}>
            <MartText variant="label" color={MART.fallbackPrimary}>
              {Math.round(progress * 100)}%
            </MartText>
          </View>
        </View>
        <Bar value={progress} />
        <View style={styles.statRow}>
          <Stat label="Remaining" value={String(cycle.remainingItems)} />
          <Stat label="Batches done" value={String(cycle.batchesDone)} />
          <Stat
            label="Days left"
            value={cycle.daysRemaining === null ? '—' : String(Math.max(0, Math.round(cycle.daysRemaining)))}
          />
        </View>
        {cycle.projectedFinishDate && !completed ? (
          <MartText variant="meta" color={MART.inkQuiet}>
            On track to finish by {cycle.projectedFinishDate}.
          </MartText>
        ) : null}
      </View>

      {marks.length > 0 ? (
        <View style={styles.card}>
          <View style={styles.legend}>
            <Legend swatch={MART.success} label="Done" />
            <Legend swatch={MART.fallbackPrimary} label="Today" />
            <Legend swatch={MART.paperSunken} label="Ahead" />
          </View>
          <View style={styles.days}>
            {marks.map((mark) => (
              <View
                key={mark.key}
                style={[
                  styles.day,
                  {
                    backgroundColor:
                      mark.state === 'done' ? MART.success : mark.state === 'current' ? MART.fallbackPrimary : MART.paperSunken,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}

      {awaiting > 0 ? (
        <View style={styles.card}>
          <MartText variant="heading">Waiting to post</MartText>
          <MartText variant="meta" color={MART.inkQuiet}>
            {awaiting} counted {awaiting === 1 ? 'line is' : 'lines are'} ready for a manager to post to stock.
          </MartText>
        </View>
      ) : null}

      {cycle.batches.length > 0 ? (
        <View style={styles.card}>
          <MartText variant="heading" style={{ marginBottom: SPACE.sm }}>
            Batches
          </MartText>
          {cycle.batches.map((b, i) => {
            const words = batchPostingWords(b);
            const waiting = b.awaitingApplyCount > 0;
            return (
              <Pressable
                key={b.sessionId}
                onPress={() =>
                  navigation.navigate(batchPostingWords(b) === 'Open' ? 'BatchCount' : 'BatchReview', { sessionId: b.sessionId })
                }
                style={[styles.batchRow, i > 0 && styles.batchRule]}
                accessibilityRole="button"
              >
                <View style={styles.batchBody}>
                  <MartText variant="label">Batch {b.batchNumber}</MartText>
                  <MartText variant="meta" color={MART.inkQuiet}>
                    {b.countedCount} of {b.totalCount} counted{b.sessionDate ? ` · ${b.sessionDate}` : ''}
                  </MartText>
                </View>
                <MartText variant="meta" color={waiting ? MART.warning : MART.inkQuiet}>
                  {words}
                </MartText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {mayClose && completed ? (
        <MartButton label="Start the next full count" onPress={() => setPlanningNext(true)} />
      ) : null}

      {mayClose && cycleIsActive(cycle.status) ? (
        <Pressable onPress={() => onCancel(cycle)} disabled={busy} style={[styles.cancel, busy && styles.dim]}>
          <MartText variant="label" color={MART.danger}>
            Call off this full count
          </MartText>
          <MartText variant="meta" color={MART.inkQuiet}>
            Counts already posted stay. The rest of the plan is dropped.
          </MartText>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.day, { backgroundColor: swatch }]} />
      <MartText variant="meta" color={MART.inkQuiet}>
        {label}
      </MartText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: MART.paper },
  content: { padding: GUTTER, paddingBottom: SPACE.xxxl, gap: SPACE.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: MART.paper },
  centerPad: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: MART.paper, padding: GUTTER, gap: SPACE.sm },
  centerText: { textAlign: 'center' },
  retry: {
    marginTop: SPACE.md,
    backgroundColor: MART.fallbackPrimary,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.pill,
  },
  card: {
    backgroundColor: MART.paperElevated,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: MART.border,
    padding: SPACE.lg,
    gap: SPACE.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  chip: {
    flexGrow: 1,
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paper,
  },
  chipOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  primary: {
    marginTop: SPACE.md,
    minHeight: 52,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wide: { marginTop: 0 },
  dim: { opacity: 0.55 },
  overviewHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  pct: { paddingVertical: SPACE.xs, paddingHorizontal: SPACE.md, borderRadius: RADIUS.pill },
  barTrack: {
    height: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperSunken,
    overflow: 'hidden',
    marginTop: SPACE.xs,
  },
  barFill: { height: 10, borderRadius: RADIUS.pill, backgroundColor: MART.fallbackPrimary },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACE.sm },
  stat: { alignItems: 'flex-start', gap: SPACE.xxs },
  doneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    backgroundColor: MART.successSurface,
    borderRadius: RADIUS.lg,
    padding: SPACE.lg,
  },
  batchRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md },
  batchRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: MART.border },
  batchBody: { flex: 1, gap: SPACE.xxs },
  cancel: {
    marginTop: SPACE.xs,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    gap: SPACE.xxs,
  },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs },
  legend: { flexDirection: 'row', gap: SPACE.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  day: { width: 14, height: 14, borderRadius: 4 },
  next: {
    gap: SPACE.sm,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: tint(MART.fallbackPrimary, 0.12),
  },
  backLink: { minHeight: 44, justifyContent: 'center' },
});
