import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, FlatList, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, FONT, Text, theme } from '@kiosk/ui';
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
      <Text variant="h1">Unsent sales</Text>
      {items.length > 0 ? (
        <Text variant="muted" style={styles.summary}>
          {items.length} {items.length === 1 ? 'sale is' : 'sales are'} still on this phone
          {stuck > 0 ? `, ${stuck} ${stuck === 1 ? 'needs' : 'need'} attention` : ''}. They are sent on their own when
          there is a connection.
        </Text>
      ) : null}
      {items.length > 0 && offline ? (
        <Text variant="caption" style={styles.summary}>
          {UNSENT_OFFLINE_NOTE}
        </Text>
      ) : null}
      {items.length > 0 ? (
        <View style={styles.tools}>
          {stuck > 0 ? <Button title="Try all again" variant="secondary" onPress={() => void tryAllAgain()} style={styles.tool} /> : null}
          <Button title="Share a copy" variant="secondary" onPress={() => void shareCopy()} style={styles.tool} />
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const needsAPerson = needsAttention(item);
          const what = describeQueuedItem(item);
          return (
            <Card style={styles.card}>
              <Text variant="body">{what.title}</Text>
              {what.detail ? <Text variant="caption">{what.detail}</Text> : null}
              <Text variant="caption">{formatWhen(item.createdAt)}</Text>
              {describeFacts(item, { now: Date.now(), stuck: needsAPerson }).map((line) => (
                <Text key={line} variant="caption">
                  {line}
                </Text>
              ))}
              <Text variant="caption" style={needsAPerson ? styles.needsAttention : undefined}>
                {needsAPerson
                  ? 'Needs attention'
                  : item.retries > 0
                    ? `Waiting to send, tried ${item.retries} ${item.retries === 1 ? 'time' : 'times'}`
                    : 'Waiting to send'}
              </Text>
              {needsAPerson && serverWords(item.lastError) ? <Text variant="muted">{serverWords(item.lastError)}</Text> : null}
              <View style={styles.actions}>
                <Button title="Send now" onPress={() => void sendOne(item)} />
                {needsAPerson ? <Button title="Discard" variant="danger" onPress={() => discard(item)} /> : null}
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={<Text variant="muted">Nothing is waiting. Every sale has reached the server.</Text>}
        ListFooterComponent={
          log.length > 0 ? (
            <View style={styles.log}>
              <Text variant="h2">Noted by the till</Text>
              <Text variant="muted" style={styles.summary}>
                Things the till could not put right by itself, for a manager to see.{canClear ? '' : ' A manager clears them.'}
              </Text>
              {log.map((entry) => (
                <Card key={entry.id} style={styles.card}>
                  <Text variant="body">{entry.text}</Text>
                  <Text variant="caption">{formatWhen(entry.at)}</Text>
                  {canClear ? (
                    <View style={styles.actions}>
                      <Button title="Clear" variant="secondary" onPress={() => clearNote(entry)} />
                    </View>
                  ) : null}
                </Card>
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
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  summary: { marginBottom: theme.spacing.md },
  tools: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  tool: { flex: 1 },
  card: { marginBottom: theme.spacing.md },
  needsAttention: { color: theme.colors.danger, fontFamily: FONT.semibold },
  actions: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.sm },
  log: { marginTop: theme.spacing.lg },
});
