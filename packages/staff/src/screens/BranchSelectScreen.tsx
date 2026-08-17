import React from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity } from 'react-native';
import { Text, theme } from '@kiosk/ui';
import type { BranchOption } from '@kiosk/core';
import { AuthBackBar } from '../components/AuthBackBar';

interface BranchSelectScreenProps {
  branches: BranchOption[];
  onSelect: (branch: BranchOption) => void;
  storeName?: string | null;
  onChangeStore?: () => void;
}

export function BranchSelectScreen({
  branches,
  onSelect,
  storeName,
  onChangeStore,
}: BranchSelectScreenProps) {
  return (
    <View style={styles.container}>
      <AuthBackBar
        onBack={onChangeStore}
        backLabel="Change store"
      />
      <Text variant="h1">Select branch</Text>
      {storeName ? (
        <Text variant="muted" style={styles.store}>
          {storeName}
        </Text>
      ) : null}
      <FlatList
        data={branches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            accessibilityLabel={`Select branch ${item.name}`}
          >
            <Text variant="body">{item.name}</Text>
            {item.code ? (
              <Text variant="caption" style={styles.code}>
                {item.code}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  store: {
    marginBottom: theme.spacing.md,
  },
  item: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 48,
    justifyContent: 'center',
  },
  code: {
    color: theme.colors.textMuted,
    marginTop: 4,
  },
});
