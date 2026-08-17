import React, { useCallback, useState } from 'react';
import { StyleSheet, View, FlatList, TextInput, Modal, TouchableOpacity, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Text, theme } from '@kiosk/ui';
import { BarcodeScanner } from '@kiosk/barcode';
import type { ApiClient } from '@kiosk/core';
import { fetchTopProducts, searchItems } from '../api/grocery-api';
import { useInvoiceStore } from '../store/invoice-store';
import type { GroceryStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<GroceryStackParamList, 'Builder'> & {
  api: ApiClient;
  branchId: string;
  onLogout: () => void;
};

export function InvoiceBuilderScreen({ navigation, api, onLogout }: Props) {
  const { lines, addLine, updateQuantity, removeLine, total } = useInvoiceStore();
  const [items, setItems] = useState<{ id: string; name: string; sellingPrice: number }[]>([]);
  const [search, setSearch] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const load = useCallback(async () => {
    try {
      const [top, searched] = await Promise.all([
        fetchTopProducts(api),
        search ? searchItems(api, { search }) : Promise.resolve([]),
      ]);
      setItems(search ? searched : top);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load products');
    }
  }, [api, search]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          placeholder="Search"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => load()}
        />
        <Button title="Scan" onPress={() => setShowScanner(true)} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => addLine(item)}>
            <Text variant="body">{item.name}</Text>
            <Text variant="caption">{item.sellingPrice}</Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.footer}>
        <Text variant="h2">Lines: {lines.length} · Total: {total().toFixed(2)}</Text>
        {lines.map((l) => (
          <View key={l.itemId} style={styles.line}>
            <Text variant="body">{l.name}</Text>
            <View style={styles.qty}>
              <Button title="-" variant="secondary" onPress={() => updateQuantity(l.itemId, l.quantity - 1)} />
              <Text variant="body">{l.quantity}</Text>
              <Button title="+" variant="secondary" onPress={() => updateQuantity(l.itemId, l.quantity + 1)} />
              <Button title="X" variant="danger" onPress={() => removeLine(l.itemId)} />
            </View>
          </View>
        ))}
        <Button title="Finalize & forward" onPress={() => navigation.navigate('Finalize')} disabled={!lines.length} />
        <Button title="Invoice history" variant="secondary" onPress={() => navigation.navigate('Invoices')} />
        <Button title="Sign out" variant="secondary" onPress={onLogout} />
      </View>

      <Modal visible={showScanner} animationType="slide">
        <BarcodeScanner
          onBarcode={async (r) => {
            setShowScanner(false);
            const found = await searchItems(api, { barcode: r.value });
            if (found[0]) addLine(found[0]);
          }}
          onClose={() => setShowScanner(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  toolbar: { flexDirection: 'row', padding: theme.spacing.md, gap: 8 },
  search: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 12, minHeight: 48 },
  row: { padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border, flexDirection: 'row', justifyContent: 'space-between' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  line: { marginVertical: 4 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
