import React, { useCallback, useState } from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { fetchUsers, type UserRecord } from '../api/admin-api';

export function UsersScreen({ api }: { api: ApiClient }) {
  const [users, setUsers] = useState<UserRecord[]>([]);

  const load = useCallback(async () => {
    setUsers(await fetchUsers(api));
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        onRefresh={load}
        refreshing={false}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text variant="body">{item.name ?? item.email}</Text>
            <Text variant="caption">{item.roleName ?? 'Staff'}</Text>
          </Card>
        )}
        ListEmptyComponent={<Text variant="muted">No users</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background },
  card: { marginBottom: 12 },
});
