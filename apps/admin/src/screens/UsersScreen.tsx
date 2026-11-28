import React, { useCallback, useState } from 'react';
import { StyleSheet, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ApiClient } from '@kiosk/core';
import { fetchUsers, type UserRecord } from '../api/admin-api';
import { MART, GUTTER, SPACE } from '../theme/mart';
import { MartText, Screen, Tile } from '../theme/mart-ui';

export function UsersScreen({ api }: { api: ApiClient }) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    setUsers(await fetchUsers(api));
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        onRefresh={load}
        refreshing={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SPACE.xxl },
        ]}
        renderItem={({ item }) => (
          <Tile style={styles.row}>
            <MartText variant="heading">{item.name ?? item.email}</MartText>
            <MartText variant="meta" color={MART.inkQuiet}>
              {item.roleName ?? 'Staff'}
            </MartText>
          </Tile>
        )}
        ListEmptyComponent={
          <MartText variant="body" color={MART.inkQuiet} style={styles.empty}>
            No users yet.
          </MartText>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xl,
    gap: SPACE.sm,
  },
  row: {
    gap: SPACE.xxs,
  },
  empty: {
    marginTop: SPACE.xxl,
    textAlign: 'center',
  },
});
