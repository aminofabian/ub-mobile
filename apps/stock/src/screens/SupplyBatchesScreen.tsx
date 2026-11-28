import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatQty, readFailureWords } from '@kiosk/core';
import { GUTTER, MartText, MART, RADIUS, SPACE, tint, onFill } from '@kiosk/staff';
import { fetchSupplyBatches } from '../api/stock-api';
import { shortDate } from '../lib/dates';
import { useStockSession } from '../lib/session';
import { batchTitle, sourceWords, statusWords, type SupplyBatch, type SupplyStatus } from '../lib/supply-batches';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'Batches'>;

type Choice = { key: 'active' | 'all' | 'soldout' | 'closed'; label: string; status?: SupplyStatus };

const CHOICES: readonly Choice[] = [
  { key: 'active', label: 'In stock', status: 'active' },
  { key: 'soldout', label: 'Sold out', status: 'soldout' },
  { key: 'closed', label: 'Closed', status: 'closed' },
  { key: 'all', label: 'All' },
];

type Loaded = { state: 'loading' } | { state: 'failed'; words: string } | { state: 'ready'; batches: SupplyBatch[] };

function leftWords(batch: SupplyBatch): string {
  if (batch.remainingUnits === null) return '';
  return batch.initialUnits === null ? `${formatQty(batch.remainingUnits)} left` : `${formatQty(batch.remainingUnits)} of ${formatQty(batch.initialUnits)} left`;
}

/** What came in from suppliers, and how much of each delivery is left. */
export function SupplyBatchesScreen({ navigation }: Props) {
  const { api, branchId } = useStockSession();
  const [choice, setChoice] = useState<Choice>(CHOICES[0] as Choice);
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      setLoaded({ state: 'loading' });
      void (async () => {
        try {
          const batches = await fetchSupplyBatches(api, branchId, choice.status);
          if (!live) return;
          setLoaded(batches ? { state: 'ready', batches } : { state: 'failed', words: 'The server sent something the app could not read.' });
        } catch (error) {
          if (live) setLoaded({ state: 'failed', words: readFailureWords(error) });
        }
      })();
      return () => {
        live = false;
      };
    }, [api, branchId, choice, attempt])
  );

  return (
    <View style={styles.fill}>
      <View style={styles.chips}>
        {CHOICES.map((option) => {
          const on = choice.key === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setChoice(option)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.8 }]}
            >
              <MartText variant="meta" color={on ? onFill(MART.fallbackPrimary).primary : MART.inkMuted}>
                {option.label}
              </MartText>
            </Pressable>
          );
        })}
      </View>
      {loaded.state === 'loading' ? (
        <MartText variant="meta" color={MART.inkQuiet} style={styles.pad}>
          Reading the deliveries…
        </MartText>
      ) : null}
      {loaded.state === 'failed' ? (
        <Pressable onPress={() => setAttempt((n) => n + 1)} style={({ pressed }) => [styles.problem, pressed && { opacity: 0.8 }]}>
          <MartText variant="meta" color={MART.danger} style={{ flex: 1 }}>
            {loaded.words}
          </MartText>
          <MartText variant="meta" color={MART.danger}>
            Try again
          </MartText>
        </Pressable>
      ) : null}
      {loaded.state === 'ready' ? (
        <FlatList
          data={loaded.batches}
          keyExtractor={(batch) => batch.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <MartText variant="meta" color={MART.inkQuiet} style={styles.empty}>
              Nothing here. Deliveries appear once a supplier order has been received.
            </MartText>
          }
          renderItem={({ item: batch }) => (
            <Pressable
              onPress={() => navigation.navigate('Batch', { batchId: batch.id })}
              accessibilityRole="button"
              accessibilityLabel={`${batchTitle(batch)}, ${[statusWords(batch.status), leftWords(batch)].filter(Boolean).join(', ')}`}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <MartText variant="label" numberOfLines={1}>
                  {batchTitle(batch)}
                </MartText>
                <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
                  {[batch.supplier, statusWords(batch.status), leftWords(batch), shortDate(batch.receivedAt)].filter(Boolean).join(' · ')}
                </MartText>
              </View>
              {batch.soldPercent === null ? null : (
                <View style={styles.pct}>
                  <MartText variant="shelf" color={MART.fallbackPrimaryLift}>
                    {`${batch.soldPercent}% SOLD`}
                  </MartText>
                </View>
              )}
            </Pressable>
          )}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  pad: { padding: GUTTER },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: GUTTER, paddingTop: SPACE.md, gap: SPACE.xs },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: MART.paperElevated, borderWidth: 1, borderColor: MART.border },
  chipOn: { backgroundColor: MART.fallbackPrimary, borderColor: MART.fallbackPrimary },
  list: { padding: GUTTER, gap: SPACE.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  pct: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: tint(MART.fallbackPrimary, 0.12) },
  problem: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, margin: GUTTER, padding: SPACE.sm, borderRadius: RADIUS.md, backgroundColor: tint(MART.danger, 0.06) },
  empty: { textAlign: 'center', padding: SPACE.xl, lineHeight: 19 },
});
