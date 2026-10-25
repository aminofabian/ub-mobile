import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Alert, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { closeShift, fetchCurrentShift, openShift } from '../api/pos-api';
import { usePosStore } from '../store/pos-store';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Shift'> & {
  api: ApiClient;
  branchId: string;
  tenantName: string;
  onLogout: () => void;
};

export function ShiftScreen({ navigation, api, branchId, tenantName, onLogout }: Props) {
  const { currentShift, setShift } = usePosStore();
  const [loading, setLoading] = useState(false);
  const [takenOut, setTakenOut] = useState('');

  const refreshShift = useCallback(async () => {
    setLoading(true);
    try {
      const shift = await fetchCurrentShift(api, branchId);
      setShift(shift);
    } catch {
      setShift(null);
    } finally {
      setLoading(false);
    }
  }, [api, branchId, setShift]);

  React.useEffect(() => {
    void refreshShift();
  }, [refreshShift]);

  const handleOpenShift = async () => {
    setLoading(true);
    try {
      const shift = await openShift(api, branchId, 0);
      setShift(shift);
      Alert.alert('Shift opened', 'You can now start selling.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not open shift');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift?.id) return;
    const removed = Number(takenOut);
    if (!takenOut.trim() || !Number.isFinite(removed) || removed < 0) {
      Alert.alert('Amount taken out', 'Enter the cash you are removing. Use 0 if nothing leaves the till.');
      return;
    }
    setLoading(true);
    try {
      await closeShift(
        api,
        currentShift.id,
        currentShift.expectedClosingCash ?? 0,
        undefined,
        removed,
      );
      setTakenOut('');
      setShift(null);
      Alert.alert('Shift closed');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not close shift');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="h1">{tenantName}</Text>
      <Card style={styles.card}>
        <Text variant="h2">Current shift</Text>
        {currentShift ? (
          <>
            <Text variant="body">Status: {currentShift.status}</Text>
            <Text variant="body">Opened: {currentShift.openedAt ?? '—'}</Text>
            <Text variant="body">
              Expected cash: {currentShift.expectedClosingCash ?? 0}
            </Text>
          </>
        ) : (
          <Text variant="muted">No open shift</Text>
        )}
      </Card>

      {!currentShift ? (
        <Button title="Open shift" onPress={handleOpenShift} disabled={loading} />
      ) : (
        <>
          <Button
            title="Start selling"
            onPress={() => navigation.navigate('Pos')}
            style={styles.action}
          />
          <TextInput
            value={takenOut}
            onChangeText={setTakenOut}
            keyboardType="decimal-pad"
            placeholder="Amount taken out"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
          />
          <Button
            title="Close shift"
            variant="danger"
            onPress={handleCloseShift}
            disabled={loading}
            style={styles.action}
          />
        </>
      )}

      <Button
        title="Grocery invoices"
        variant="secondary"
        onPress={() => navigation.navigate('GroceryInvoices')}
        style={styles.action}
      />
      <Button
        title="Sync conflicts"
        variant="secondary"
        onPress={() => navigation.navigate('Conflicts')}
        style={styles.action}
      />
      <Button title="Refresh" variant="secondary" onPress={refreshShift} disabled={loading} />
      <Button title="Sign out" variant="secondary" onPress={onLogout} style={styles.action} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  card: {
    marginBottom: theme.spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  action: {
    marginTop: theme.spacing.sm,
  },
});
