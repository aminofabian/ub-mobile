import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, FlatList, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FONT, MART, MartText, RADIUS, SPACE } from '@kiosk/staff';
import { CARD_SURFACE, CashierButton } from '../components/CashierPrimitives';
import type { ApiClient } from '@kiosk/core';
import {
  holdWhileSending,
  isBeingSent,
  needsAttention,
  outbox,
  replayItem,
  retryStuck,
  subscribeOutbox,
  type OutboxItem,
} from '@kiosk/offline';
import { DISCARD_NEEDS_MANAGER, mayClearLog, mayDiscard } from '../lib/discard-rules';
import { exportUnsent } from '../lib/export-unsent';
import { COPY_NOT_MADE, describeNotSent, retryWords, UNSENT_OFFLINE_NOTE } from '../lib/offline-words';
import { SEND_NOW_WAIT_MS, waitFor } from '../lib/reach';
import { describeFacts } from '../lib/sale-facts';
import { describeQueuedItem, discardWarning } from '../lib/sale-summary';
import { BEING_SENT_NOW, sendNow } from '../lib/send-now';
import { serverWords } from '../lib/server-words';
import type { TillPerson } from '../lib/till-person';
import {
  appendToLog,
  changeLog,
  discardedEntry,
  readLog,
  recordSent,
  removeFromLog,
  subscribeLog,
  type LogEntry,
} from '../lib/till-log';
import { formatWhen } from '../lib/when';
import { reachSink, useReach } from '../store/reach-store';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Conflicts'> & {
  api: ApiClient;
  /** The shop's id, which the till's log is kept under on this phone. */
  tenantId: string;
  /** Who is signed in: what they may discard, and whose name goes in the log. */
  person: TillPerson;
};

/** Every sale on this phone that has not reached the server, for the store that is open. */
export function ConflictResolutionScreen({ api, tenantId, person }: Props) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const offline = useReach((state) => state.offline);
  // One send at a time for each sale: a second tap while the first is on its way would send it twice.
  const sending = useRef(new Set<string>());

  const load = useCallback(async () => {
    const pending = await outbox.pending();
    // The ones that need a person come first; the rest are only waiting for the network or their turn.
    setItems([...pending].sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a))));
  }, []);

  useEffect(() => {
    void load();
    return subscribeOutbox(() => {
      void load();
    });
  }, [load]);

  // What the till wrote down for a manager. It is written in the background (a sale that is sent while this screen is
  // open), so the screen reads it again whenever it changes.
  const loadLog = useCallback(async () => {
    setLog(await readLog(tenantId, Date.now()));
  }, [tenantId]);

  useEffect(() => {
    void loadLog();
    return subscribeLog(() => {
      void loadLog();
    });
  }, [loadLog]);

  const discard = (item: OutboxItem) => {
    // A sale that has the customer's M-Pesa money in it may be thrown away only by a manager.
    if (!mayDiscard(item, person.permissions)) {
      Alert.alert('Ask a manager', DISCARD_NEEDS_MANAGER);
      return;
    }
    Alert.alert('Discard this sale?', discardWarning(item), [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          // It is written down once it is gone, so that nothing says a sale was thrown away that is still here.
          outbox
            .remove(item.id)
            .then(() => appendToLog(tenantId, discardedEntry(item, person.name, Date.now()), Date.now()))
            .then(load)
            .catch(() => Alert.alert('Not discarded', 'The sale could not be taken off this phone. It is still here.'));
        },
      },
    ]);
  };

  const sendOne = async (item: OutboxItem) => {
    if (sending.current.has(item.id)) return;
    sending.current.add(item.id);
    try {
      // A sale that was taken by the server just as the wait ran out is sent again later under the same key, and the
      // server answers with the sale it already has: it is never recorded twice. While this request is on its way the
      // sync engine leaves the sale alone, and a sale the engine is sending is not sent here.
      const result = await sendNow(item, {
        isBeingSent: (id) => isBeingSent(id),
        send: () => {
          const release = holdWhileSending(item.id);
          const request = replayItem(api, item);
          request.then(release, release);
          return waitFor(() => request, SEND_NOW_WAIT_MS, reachSink);
        },
        remove: (id) => outbox.remove(id),
      });
      if (result.kind === 'busy') {
        Alert.alert('Being sent', BEING_SENT_NOW);
        return;
      }
      if (result.kind === 'failed') {
        Alert.alert('Still not sent', describeNotSent(result.error));
        return;
      }
      void recordSent(tenantId, item, result.response, { id: person.userId, name: person.name }, Date.now());
      Alert.alert('Sent', 'It reached the server.');
      void load();
    } finally {
      sending.current.delete(item.id);
    }
  };

  const clearNote = (entry: LogEntry) => {
    void changeLog(tenantId, (all) => removeFromLog(all, entry.id), Date.now());
  };
  const canClear = mayClearLog(person.permissions);

  const stuck = items.filter(needsAttention).length;

  // The sales that stopped sending by themselves are let go again, and the engine picks them up on its next turn.
  const tryAllAgain = async () => {
    const count = await retryStuck();
    Alert.alert('Trying again', retryWords(count));
    void load();
  };

  const shareCopy = async () => {
    try {
      await exportUnsent();
    } catch {
      Alert.alert('Not shared', COPY_NOT_MADE);
    }
  };

  return (
    <View style={styles.container}>
      <MartText variant="display">Unsent sales</MartText>
      {items.length > 0 ? (
        <MartText variant="meta" color={MART.inkQuiet} style={styles.summary}>
          {items.length} {items.length === 1 ? 'sale is' : 'sales are'} still on this phone
          {stuck > 0 ? `, ${stuck} ${stuck === 1 ? 'needs' : 'need'} attention` : ''}. They are sent on their own when
          there is a connection.
        </MartText>
      ) : null}
      {items.length > 0 && offline ? (
        <MartText variant="meta" style={styles.summary}>
          {UNSENT_OFFLINE_NOTE}
        </MartText>
      ) : null}
      {items.length > 0 ? (
        <View style={styles.tools}>
          {stuck > 0 ? <CashierButton title="Try all again" variant="secondary" onPress={() => void tryAllAgain()} style={styles.tool} /> : null}
          <CashierButton title="Share a copy" variant="secondary" onPress={() => void shareCopy()} style={styles.tool} />
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const needsAPerson = needsAttention(item);
          const what = describeQueuedItem(item);
          return (
            <View style={[CARD_SURFACE, styles.card]}>
              <MartText variant="body">{what.title}</MartText>
              {what.detail ? <MartText variant="meta">{what.detail}</MartText> : null}
              <MartText variant="meta">{formatWhen(item.createdAt)}</MartText>
              {describeFacts(item, { now: Date.now(), stuck: needsAPerson }).map((line) => (
                <MartText key={line} variant="meta">
                  {line}
                </MartText>
              ))}
              <MartText variant="meta" style={needsAPerson ? styles.needsAttention : undefined}>
                {needsAPerson
                  ? 'Needs attention'
                  : item.retries > 0
                    ? `Waiting to send, tried ${item.retries} ${item.retries === 1 ? 'time' : 'times'}`
                    : 'Waiting to send'}
              </MartText>
              {needsAPerson && serverWords(item.lastError) ? <MartText variant="meta" color={MART.inkQuiet}>{serverWords(item.lastError)}</MartText> : null}
              <View style={styles.actions}>
                <CashierButton title="Send now" onPress={() => void sendOne(item)} />
                {needsAPerson ? <CashierButton title="Discard" variant="danger" onPress={() => discard(item)} /> : null}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={<MartText variant="meta" color={MART.inkQuiet}>Nothing is waiting. Every sale has reached the server.</MartText>}
        ListFooterComponent={
          log.length > 0 ? (
            <View style={styles.log}>
              <MartText variant="title">Noted by the till</MartText>
              <MartText variant="meta" color={MART.inkQuiet} style={styles.summary}>
                Things the till could not put right by itself, for a manager to see.{canClear ? '' : ' A manager clears them.'}
              </MartText>
              {log.map((entry) => (
                <View key={entry.id} style={[CARD_SURFACE, styles.card]}>
                  <MartText variant="body">{entry.text}</MartText>
                  <MartText variant="meta">{formatWhen(entry.at)}</MartText>
                  {canClear ? (
                    <View style={styles.actions}>
                      <CashierButton title="Clear" variant="secondary" onPress={() => clearNote(entry)} />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACE.lg,
    backgroundColor: MART.paper,
  },
  summary: { marginBottom: SPACE.md },
  tools: { flexDirection: 'row', gap: SPACE.sm, marginBottom: SPACE.md },
  tool: { flex: 1 },
  card: { marginBottom: SPACE.md, padding: SPACE.md, gap: SPACE.xs },
  needsAttention: { color: MART.danger, fontFamily: FONT.semibold },
  actions: { flexDirection: 'row', gap: 8, marginTop: SPACE.sm },
  log: { marginTop: SPACE.lg },
});
