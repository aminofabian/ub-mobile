import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { needsAttention, outbox, replayItem, subscribeOutbox, type OutboxItem } from '@kiosk/offline';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Conflicts'> & {
  api: ApiClient;
};

/** Every sale on this phone that has not reached the server, for the store that is open. */
export function ConflictResolutionScreen({ api }: Props) {
  const [items, setItems] = useState<OutboxItem[]>([]);

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

  const discard = (item: OutboxItem) => {
    Alert.alert('Discard this sale?', 'It will not be sent to the server, and it cannot be brought back.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          void outbox.remove(item.id).then(load);
        },
      },
    ]);
  };

  const sendNow = async (item: OutboxItem) => {
    try {
      await replayItem(api, item);
      await outbox.remove(item.id);
      Alert.alert('Sent', 'It reached the server.');
      void load();
    } catch (e) {
      Alert.alert('Still not sent', e instanceof Error ? e.message : 'The server did not accept it.');
    }
  };

  const stuck = items.filter(needsAttention).length;

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
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const needsAPerson = needsAttention(item);
          return (
            <Card style={styles.card}>
              <Text variant="body">
                {item.method} {item.path}
              </Text>
              <Text variant="caption">{new Date(item.createdAt).toLocaleString()}</Text>
              <Text variant="caption" style={needsAPerson ? styles.needsAttention : undefined}>
                {needsAPerson
                  ? 'Needs attention'
                  : item.retries > 0
                    ? `Waiting to send, tried ${item.retries} ${item.retries === 1 ? 'time' : 'times'}`
                    : 'Waiting to send'}
              </Text>
              {needsAPerson && item.lastError ? <Text variant="muted">{item.lastError}</Text> : null}
              <View style={styles.actions}>
                <Button title="Send now" onPress={() => sendNow(item)} />
                {needsAPerson ? <Button title="Discard" variant="danger" onPress={() => discard(item)} /> : null}
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={<Text variant="muted">Nothing is waiting. Every sale has reached the server.</Text>}
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
  card: { marginBottom: theme.spacing.md },
  needsAttention: { color: theme.colors.danger, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.sm },
});
