import React, { useCallback, useState } from 'react';
import { StyleSheet, View, FlatList, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { needsAttention, outbox, replayItem, type OutboxItem } from '@kiosk/offline';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Conflicts'> & {
  api: ApiClient;
};

export function ConflictResolutionScreen({ api }: Props) {
  const [items, setItems] = useState<OutboxItem[]>([]);

  const load = useCallback(async () => {
    const pending = await outbox.pending();
    setItems(pending.filter(needsAttention));
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const discard = async (id: string) => {
    await outbox.remove(id);
    void load();
  };

  const retry = async (item: OutboxItem) => {
    try {
      await replayItem(api, item);
      await outbox.remove(item.id);
      Alert.alert('Synced', 'Mutation applied successfully');
      void load();
    } catch (e) {
      Alert.alert('Still failing', e instanceof Error ? e.message : 'Retry failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="h1">Sync conflicts</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text variant="body">{item.method} {item.path}</Text>
            <Text variant="caption">Retries: {item.retries}</Text>
            {item.lastError ? <Text variant="muted">{item.lastError}</Text> : null}
            <View style={styles.actions}>
              <Button title="Retry" onPress={() => retry(item)} />
              <Button title="Discard" variant="danger" onPress={() => discard(item.id)} />
            </View>
          </Card>
        )}
        ListEmptyComponent={<Text variant="muted">No conflicts</Text>}
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
  card: { marginBottom: theme.spacing.md },
  actions: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.sm },
});
