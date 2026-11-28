import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { readFailureWords } from '@kiosk/core';
import { GUTTER, MartButton, MartText, MART, RADIUS, SPACE, tint } from '@kiosk/staff';
import { fetchBranchList, fetchTransfers } from '../api/stock-api';
import { shortDate } from '../lib/dates';
import { useStockSession } from '../lib/session';
import { actionsFor, branchName, directionFor, sortForBranch, statusWords, type Transfer } from '../lib/transfers';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'Transfers'>;

type Loaded =
  | { state: 'loading' }
  | { state: 'failed'; words: string }
  | { state: 'ready'; transfers: Transfer[]; branches: Array<{ id?: unknown; name?: unknown }> };

/** Stock moving to and from this branch: what to send, what is on its way, and what has arrived. */
export function TransfersScreen({ navigation }: Props) {
  const { api, branchId, mayMove } = useStockSession();
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void (async () => {
        try {
          const [transfers, branches] = await Promise.all([fetchTransfers(api, branchId), fetchBranchList(api).catch(() => null)]);
          if (!live) return;
          setLoaded(transfers ? { state: 'ready', transfers, branches: branches ?? [] } : { state: 'failed', words: 'The server sent something the app could not read.' });
        } catch (error) {
          if (live) setLoaded({ state: 'failed', words: readFailureWords(error) });
        }
      })();
      return () => {
        live = false;
      };
    }, [api, branchId, attempt])
  );

  if (loaded.state === 'loading') {
    return (
      <View style={styles.body}>
        <MartText variant="meta" color={MART.inkQuiet}>
          Reading the transfers…
        </MartText>
      </View>
    );
  }
  if (loaded.state === 'failed') {
    return (
      <View style={styles.body}>
        <View style={[styles.row, { backgroundColor: tint(MART.danger, 0.06), borderColor: MART.border }]}>
          <MartText variant="meta" color={MART.danger} style={{ flex: 1 }}>
            {loaded.words}
          </MartText>
        </View>
        <MartButton
          label="Try again"
          onPress={() => {
            setLoaded({ state: 'loading' });
            setAttempt((n) => n + 1);
          }}
        />
      </View>
    );
  }

  const { branches } = loaded;
  const transfers = sortForBranch(loaded.transfers, branchId);
  return (
    <View style={styles.fill}>
      {mayMove ? (
        <View style={styles.top}>
          <MartButton label="New transfer" onPress={() => navigation.navigate('NewTransfer')} />
        </View>
      ) : null}
      <FlatList
        data={transfers}
        keyExtractor={(transfer) => transfer.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <MartText variant="meta" color={MART.inkQuiet} style={styles.empty}>
            No transfers yet. A move between branches appears here from the moment it is made, and nothing leaves the
            shelf until it is sent.
          </MartText>
        }
        renderItem={({ item: transfer }) => {
          const direction = directionFor(transfer, branchId);
          const other = direction === 'out' ? transfer.toBranchId : transfer.fromBranchId;
          const title = direction === 'other' ? 'Between two other branches' : `${direction === 'out' ? 'To' : 'From'} ${branchName(branches, other)}`;
          const needsYou = actionsFor(transfer, branchId, mayMove).length > 0;
          return (
            <Pressable
              onPress={() => navigation.navigate('Transfer', { transferId: transfer.id })}
              accessibilityRole="button"
              accessibilityLabel={`${title}, ${statusWords(transfer, branchId)}${needsYou ? ', your turn' : ''}`}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
            >
              <View style={{ flex: 1, gap: 1 }}>
                <MartText variant="label" numberOfLines={1}>
                  {title}
                </MartText>
                <MartText variant="meta" color={MART.inkQuiet} numberOfLines={1}>
                  {`${statusWords(transfer, branchId)} · ${transfer.lines.length} ${transfer.lines.length === 1 ? 'item' : 'items'}`}
                </MartText>
              </View>
              {needsYou ? (
                <View style={styles.turn}>
                  <MartText variant="shelf" color={MART.warning}>
                    YOUR TURN
                  </MartText>
                </View>
              ) : (
                <MartText variant="meta" color={MART.inkQuiet}>
                  {shortDate(transfer.createdAt)}
                </MartText>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: MART.paper },
  body: { padding: GUTTER },
  top: { padding: GUTTER, paddingBottom: SPACE.sm },
  list: { paddingHorizontal: GUTTER, paddingBottom: 96, gap: 6 },
  row: {
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
  turn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: tint(MART.warning, 0.14) },
  empty: { textAlign: 'center', padding: SPACE.xl, lineHeight: 19 },
});
