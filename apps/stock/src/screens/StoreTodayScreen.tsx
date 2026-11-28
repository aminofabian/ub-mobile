import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { readFailureWords } from '@kiosk/core';
import { GUTTER, MartButton, MartText, MART, RADIUS, SPACE, onFill, tint } from '@kiosk/staff';
import { decideStoreMovement, fetchStoreActivity, fetchStoreSettings } from '../api/store-room-api';
import { useStockSession } from '../lib/session';
import { formatCount, mayDecide, reasonLabel, todayWindow, writeOutcome, type StoreMovement } from '../lib/store-room';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'StoreToday'>;

type Filter = 'all' | 'in' | 'out' | 'pending';

type Loaded =
  | { state: 'loading' }
  | { state: 'failed'; words: string }
  | { state: 'ready'; movements: StoreMovement[]; separate: boolean };

/** What moved through the store room today, and the take-outs still waiting for a decision. */
export function StoreTodayScreen(_props: Props) {
  const { api, userId, mayWrite } = useStockSession();
  const [filter, setFilter] = useState<Filter>('all');
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        try {
          const window = todayWindow(Date.now());
          const query = filter === 'pending' ? { ...window, status: 'pending' as const } : filter === 'all' ? window : { ...window, direction: filter };
          const [settings, movements] = await Promise.all([fetchStoreSettings(api), fetchStoreActivity(api, query)]);
          if (!live) return;
          if (!settings || !movements) setLoaded({ state: 'failed', words: 'The server sent something the app could not read.' });
          else setLoaded({ state: 'ready', movements, separate: settings.requireSeparateApprover });
        } catch (error) {
          if (live) setLoaded({ state: 'failed', words: readFailureWords(error) });
        }
      })();
      return () => {
        live = false;
      };
    }, [api, filter, attempt])
  );

  const decide = async (movement: StoreMovement, approve: boolean) => {
    setBusyId(movement.id);
    try {
      const next = await decideStoreMovement(api, movement.id, approve);
      if (!next) {
        Alert.alert('The phone cannot tell', 'Look at this list again before deciding a second time.');
        return;
      }
      setAttempt((n) => n + 1);
    } catch (error) {
      const outcome = writeOutcome(error);
      Alert.alert(approve ? 'Not approved' : 'Not turned down', outcome.kind === 'lost' ? 'The phone cannot tell whether that was saved. Look again before deciding a second time.' : outcome.words);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={styles.fill}>
      <View style={styles.filters}>
        {(
          [
            ['all', 'All'],
            ['in', 'In'],
            ['out', 'Out'],
            ['pending', 'Waiting'],
          ] as const
        ).map(([id, label]) => {
          const on = filter === id;
          return (
            <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { setLoaded({ state: 'loading' }); setFilter(id); }} style={[styles.chip, on && styles.chipOn]}>
              <MartText variant="meta" color={on ? onFill(MART.fallbackPrimary).primary : MART.ink}>
                {label}
              </MartText>
            </Pressable>
          );
        })}
      </View>
      {loaded.state === 'loading' ? (
        <MartText variant="meta" color={MART.inkQuiet} style={styles.pad}>
          Reading today…
        </MartText>
      ) : loaded.state === 'failed' ? (
        <View style={styles.pad}>
          <MartText variant="meta" color={MART.danger}>
            {loaded.words}
          </MartText>
          <MartButton
            label="Try again"
            onPress={() => {
              setLoaded({ state: 'loading' });
              setAttempt((n) => n + 1);
            }}
          />
        </View>
      ) : (
        <FlatList
          data={loaded.movements}
          keyExtractor={(row) => row.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <MartText variant="meta" color={MART.inkQuiet} style={styles.empty}>
              {filter === 'pending' ? 'Nothing is waiting.' : 'Nothing moved today.'}
            </MartText>
          }
          renderItem={({ item }) => {
            const pending = item.status === 'pending';
            const approve = mayDecide({ approve: true, inventory: mayWrite, separate: loaded.separate, createdBy: item.createdBy, userId });
            const reject = mayDecide({ approve: false, inventory: mayWrite, separate: loaded.separate, createdBy: item.createdBy, userId });
            return (
              <View style={styles.row}>
                <View style={styles.rowHead}>
                  <View style={styles.rowText}>
                    <MartText variant="label" numberOfLines={1}>
                      {item.storeItemName ?? 'Item'}
                    </MartText>
                    <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
                      {`${item.direction === 'in' ? 'In' : 'Out'} · ${reasonLabel(item.reason)} · ${item.createdByName ?? 'Someone'}`}
                    </MartText>
                  </View>
                  <MartText variant="heading">{formatCount(item.quantity)}</MartText>
                </View>
                {pending ? (
                  <View style={styles.wait}>
                    <MartText variant="shelf" color={MART.warning}>
                      WAITING
                    </MartText>
                  </View>
                ) : item.status === 'rejected' ? (
                  <MartText variant="meta" color={MART.inkQuiet}>
                    Turned down. The till did not change.
                  </MartText>
                ) : null}
                {pending && (approve || reject) ? (
                  <View style={styles.decide}>
                    {reject ? (
                      <Pressable disabled={busyId === item.id} onPress={() => void decide(item, false)} style={styles.quiet}>
                        <MartText variant="label">Turn down</MartText>
                      </Pressable>
                    ) : null}
                    {approve ? (
                      <View style={styles.decideFill}>
                        <MartButton label="Approve" busy={busyId === item.id} disabled={busyId === item.id} onPress={() => void decide(item, true)} />
                      </View>
                    ) : (
                      <MartText variant="meta" color={MART.inkQuiet} style={styles.decideFill}>
                        Someone else has to approve this. You raised it.
                      </MartText>
                    )}
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  filters: { flexDirection: 'row', gap: SPACE.sm, paddingHorizontal: GUTTER, paddingTop: SPACE.md },
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
  pad: { padding: GUTTER, gap: SPACE.md },
  list: { padding: GUTTER, gap: 6 },
  empty: { textAlign: 'center', padding: SPACE.xl, lineHeight: 19 },
  row: {
    gap: SPACE.sm,
    paddingVertical: 10,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  rowText: { flex: 1, gap: 2 },
  wait: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: tint(MART.warning, 0.14) },
  decide: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  decideFill: { flex: 1 },
  quiet: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: MART.border,
  },
});
