import React, { useState } from 'react';
import { StyleSheet, View, TextInput, Modal, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Text, theme } from '@kiosk/ui';
import { BarcodeScanner } from '@kiosk/barcode';
import type { ApiClient } from '@kiosk/core';
import {
  applyCount,
  closeStockTake,
  fetchActiveStockTake,
  searchItems,
  startStockTake,
} from '../api/stock-api';
import type { StockStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<StockStackParamList, 'StockTake'> & {
  api: ApiClient;
  branchId: string;
};

export function StockTakeScreen({ api, branchId }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ itemId: string; name: string; countedQty: number }[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [qty, setQty] = useState('1');
  const [pendingItem, setPendingItem] = useState<{ id: string; name: string } | null>(null);

  React.useEffect(() => {
    void fetchActiveStockTake(api).then((s) => s?.id && setSessionId(s.id));
  }, [api]);

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const session = await startStockTake(api, branchId);
    setSessionId(session.id!);
    return session.id!;
  };

  const onScan = async (barcode: string) => {
    setShowScanner(false);
    const items = await searchItems(api, barcode);
    if (!items[0]) {
      Alert.alert('Not found', 'No item for this barcode');
      return;
    }
    setPendingItem({ id: items[0].id, name: items[0].name });
  };

  const addCount = async () => {
    if (!pendingItem) return;
    const countedQty = Number(qty);
    if (!Number.isFinite(countedQty) || countedQty < 0) return;
    const sid = await ensureSession();
    const line = { itemId: pendingItem.id, name: pendingItem.name, countedQty };
    setCounts((c) => [...c.filter((x) => x.itemId !== line.itemId), line]);
    await applyCount(api, sid, [{ itemId: line.itemId, countedQty }]);
    setPendingItem(null);
    setQty('1');
  };

  const finish = async () => {
    if (!sessionId) return;
    await closeStockTake(api, sessionId);
    Alert.alert('Done', 'Stock take session closed');
  };

  return (
    <View style={styles.container}>
      <Text variant="h1">Stock take</Text>
      <Text variant="muted">Session: {sessionId ?? 'Not started'}</Text>
      <Button title="Scan item" onPress={() => setShowScanner(true)} />
      {pendingItem && (
        <View style={styles.pending}>
          <Text variant="body">{pendingItem.name}</Text>
          <TextInput
            style={styles.input}
            value={qty}
            onChangeText={setQty}
            keyboardType="numeric"
            accessibilityLabel="Counted quantity"
          />
          <Button title="Save count" onPress={addCount} />
        </View>
      )}
      {counts.map((c) => (
        <Text key={c.itemId} variant="body">
          {c.name}: {c.countedQty}
        </Text>
      ))}
      <Button title="Close session" variant="secondary" onPress={finish} disabled={!sessionId} />

      <Modal visible={showScanner} animationType="slide">
        <BarcodeScanner onBarcode={(r) => void onScan(r.value)} onClose={() => setShowScanner(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: theme.colors.background, gap: 12 },
  pending: { gap: 8 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 12, minHeight: 48 },
});
