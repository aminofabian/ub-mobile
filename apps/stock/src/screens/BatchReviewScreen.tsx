import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { readFailureWords } from '@kiosk/core';
import { GUTTER, MART, RADIUS, SPACE, MartText, onFill, tint } from '@kiosk/staff';
import { applyBatch, fetchReview } from '../api/count-cycle-api';
import { batchIsClosed, isCounted, lineAwaitsPost, lineDifference, type Batch, type BatchLine } from '../lib/count-cycle';
import { useStockSession } from '../lib/session';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'BatchReview'>;

type Phase = { name: 'loading' } | { name: 'failed'; words: string } | { name: 'ready'; batch: Batch };

type Shown = 'changed' | 'all';

/**
 * Reviewing a finished batch before its counts change the stock figures. Each line shows what the system held, what
 * was counted, and the difference. Applying writes the counted figures to stock. A manager does this; others see it
 * read-only.
 */
export function BatchReviewScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;
  const { api, mayClose } = useStockSession();
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [shown, setShown] = useState<Shown>('changed');
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    try {
      const batch = await fetchReview(api, sessionId);
      if (!batch) {
        setPhase({ name: 'failed', words: 'The server sent something the app could not read.' });
        return;
      }
      setPhase({ name: 'ready', batch });
    } catch (error) {
      setPhase({ name: 'failed', words: readFailureWords(error) });
    }
  }, [api, sessionId]);

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

  const batch = phase.name === 'ready' ? phase.batch : null;
  const counted = useMemo(() => (batch?.lines ?? []).filter(isCounted), [batch]);
  const changed = useMemo(() => counted.filter((l) => (lineDifference(l) ?? 0) !== 0), [counted]);
  const waiting = useMemo(() => (batch?.lines ?? []).filter(lineAwaitsPost).length, [batch]);
  const list = shown === 'changed' ? changed : counted;
  const closed = batch ? batchIsClosed(batch.status) : false;
  const posted = closed && waiting === 0;

  const onApply = useCallback(() => {
    if (!batch) return;
    Alert.alert(
      'Apply these counts?',
      `The stock figures for ${counted.length} counted ${counted.length === 1 ? 'item' : 'items'} will be set to what was counted. This cannot be undone.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Apply',
          onPress: () =>
            void (async () => {
              setApplying(true);
              try {
                // Empty lineIds means every line in the batch.
                await applyBatch(api, sessionId, []);
                Alert.alert('Posted', 'The counted figures are now the shop’s stock.', [
                  { text: 'Done', onPress: () => navigation.goBack() },
                ]);
              } catch (error) {
                Alert.alert('Could not apply', readFailureWords(error));
              } finally {
                setApplying(false);
              }
            })(),
        },
      ]
    );
  }, [api, batch, counted.length, navigation, sessionId]);

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
          Could not load the review
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

  const b = phase.batch;
  const renderLine = ({ item }: { item: BatchLine }) => {
    const diff = lineDifference(item);
    const tone = diff === null || diff === 0 ? MART.inkQuiet : diff < 0 ? MART.danger : MART.success;
    return (
      <View style={styles.lineRow}>
        <View style={styles.lineBody}>
          <MartText variant="heading" numberOfLines={2}>
            {item.itemName}
          </MartText>
          <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
            Shelf {item.systemQty ?? '—'} · Counted {item.countedQty ?? '—'}
          </MartText>
        </View>
        {diff !== null && diff !== 0 ? (
          <View style={[styles.diffBadge, { backgroundColor: tint(tone, 0.14) }]}>
            <MartText variant="label" color={tone}>
              {diff > 0 ? `+${diff}` : String(diff)}
            </MartText>
          </View>
        ) : (
          <MartText variant="meta" color={MART.inkQuiet}>
            Match
          </MartText>
        )}
      </View>
    );
  };

  return (
    <View style={styles.fill}>
      <View style={styles.top}>
        <MartText variant="title">Review batch {b.batchNumber}</MartText>
        <MartText variant="meta" color={MART.inkQuiet}>
          {posted
            ? 'These counts are already the shelf.'
            : waiting > 0
              ? `${waiting} ${waiting === 1 ? 'count is' : 'counts are'} ready to become the shelf.`
              : 'Finish the batch on the floor before posting.'}
        </MartText>
        <View style={styles.chips}>
          {(['changed', 'all'] as Shown[]).map((key) => {
            const on = shown === key;
            return (
              <Pressable key={key} onPress={() => setShown(key)} style={[styles.chip, on && styles.chipOn]}>
                <MartText variant="meta" color={on ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}>
                  {key === 'changed' ? 'Differences' : 'All counted'}
                </MartText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={list}
        keyExtractor={(l) => l.lineId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <MartText variant="meta" color={MART.inkQuiet} style={styles.empty}>
            {shown === 'changed' ? 'No differences — everything matched the system.' : 'Nothing counted in this batch.'}
          </MartText>
        }
        renderItem={renderLine}
      />

      {closed && waiting > 0 && mayClose ? (
        <View style={styles.footer}>
          <MartText variant="meta" color={MART.inkQuiet}>
            Posting sets the shelf to the counted number. It cannot be undone.
          </MartText>
          <Pressable onPress={onApply} disabled={applying} style={[styles.primary, applying && styles.dim]}>
            {applying ? (
              <ActivityIndicator color={onFill(MART.fallbackPrimary).primary} />
            ) : (
              <MartText variant="label" color={onFill(MART.fallbackPrimary).primary}>
              Post these counts
            </MartText>
            )}
          </Pressable>
        </View>
      ) : posted ? (
        <View style={styles.footerDone}>
          <Ionicons name="checkmark-circle" size={20} color={MART.success} />
          <MartText variant="label" color={MART.success}>
            Posted to stock
          </MartText>
        </View>
      ) : !closed ? (
        <View style={styles.footer}>
          <MartText variant="meta" color={MART.inkQuiet}>
            Finish the batch before these counts can be posted.
          </MartText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
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
  top: {
    padding: GUTTER,
    backgroundColor: MART.paperElevated,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MART.border,
    gap: SPACE.xs,
  },
  chips: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  chip: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.borderStrong,
  },
  chipOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  list: { paddingBottom: SPACE.xxxl },
  empty: { textAlign: 'center', padding: SPACE.xxl },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: GUTTER,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  lineBody: { flex: 1, gap: SPACE.xxs },
  diffBadge: { paddingVertical: SPACE.xs, paddingHorizontal: SPACE.md, borderRadius: RADIUS.sm },
  footer: {
    padding: GUTTER,
    gap: SPACE.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  footerDone: {
    flexDirection: 'row',
    gap: SPACE.sm,
    alignItems: 'center',
    justifyContent: 'center',
    padding: GUTTER,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: MART.border,
    backgroundColor: MART.successSurface,
  },
  primary: {
    minHeight: 52,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.55 },
});
