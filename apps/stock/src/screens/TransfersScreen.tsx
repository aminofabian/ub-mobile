import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Alert } from 'react-native';
import { Button, Text, theme } from '@kiosk/ui';
import type { ApiClient } from '@kiosk/core';
import { createTransfer } from '../api/stock-api';

export function TransfersScreen({ api, branchId }: { api: ApiClient; branchId: string }) {
  const [destBranchId, setDestBranchId] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await createTransfer(api, {
        sourceBranchId: branchId,
        destinationBranchId: destBranchId.trim(),
        lines: [{ itemId: itemId.trim(), quantity: Number(quantity) }],
      });
      Alert.alert('Transfer created');
      setDestBranchId('');
      setItemId('');
      setQuantity('1');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="h1">Create transfer</Text>
      <TextInput style={styles.input} placeholder="Destination branch ID" value={destBranchId} onChangeText={setDestBranchId} />
      <TextInput style={styles.input} placeholder="Item ID" value={itemId} onChangeText={setItemId} />
      <TextInput style={styles.input} placeholder="Quantity" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
      <Button title={loading ? 'Saving...' : 'Create transfer'} onPress={submit} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background, gap: 12 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 12, minHeight: 48 },
});
