import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  TextInput,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button, Card, Text, theme } from '@kiosk/ui';
import { BarcodeScanner } from '@kiosk/barcode';
import type { ApiClient } from '@kiosk/core';
import { searchItems } from '../api/pos-api';
import { usePosStore } from '../store/pos-store';
import type { CashierStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<CashierStackParamList, 'Pos'> & {
  api: ApiClient;
  branchId: string;
};

export function PosWorkspaceScreen({ navigation, api, branchId }: Props) {
  const { items, cart, setItems, addToCart, updateQuantity, removeFromCart, cartTotal } =
    usePosStore();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const loadItems = useCallback(
    async (opts: { search?: string; barcode?: string } = {}) => {
      setLoading(true);
      try {
        const result = await searchItems(api, { ...opts, branchId });
        setItems(result);
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Could not load items');
      } finally {
        setLoading(false);
      }
    },
    [api, branchId, setItems]
  );

  React.useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const onBarcode = async (value: string) => {
    setShowScanner(false);
    await loadItems({ barcode: value });
    const match = items.find((i) => i.barcode === value);
    if (match) addToCart(match);
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Search products"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => loadItems({ search })}
          accessibilityLabel="Search products"
        />
        <Button title="Scan" onPress={() => setShowScanner(true)} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<Text variant="h2">Products</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.productRow} onPress={() => addToCart(item)}>
            <Text variant="body">{item.name}</Text>
            <Text variant="caption">{item.sellingPrice}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? <Text variant="muted">Loading...</Text> : <Text variant="muted">No items</Text>
        }
      />

      <Card style={styles.cart}>
        <Text variant="h2">Cart ({cart.length})</Text>
        {cart.map((line) => (
          <View key={line.itemId} style={styles.cartLine}>
            <Text variant="body" style={styles.lineName}>
              {line.name}
            </Text>
            <View style={styles.qtyRow}>
              <Button
                title="-"
                variant="secondary"
                onPress={() => updateQuantity(line.itemId, line.quantity - 1)}
                style={styles.qtyBtn}
              />
              <Text variant="body">{line.quantity}</Text>
              <Button
                title="+"
                variant="secondary"
                onPress={() => updateQuantity(line.itemId, line.quantity + 1)}
                style={styles.qtyBtn}
              />
              <Button title="Remove" variant="danger" onPress={() => removeFromCart(line.itemId)} />
            </View>
          </View>
        ))}
        <Text variant="h2">Total: {cartTotal().toFixed(2)}</Text>
        <Button
          title="Checkout"
          onPress={() => {
            if (!cart.length) {
              Alert.alert('Empty cart', 'Add items before checkout');
              return;
            }
            navigation.navigate('Payment');
          }}
          disabled={!cart.length}
          style={styles.checkout}
        />
      </Card>

      <Modal visible={showScanner} animationType="slide">
        <BarcodeScanner
          onBarcode={(r) => void onBarcode(r.value)}
          onClose={() => setShowScanner(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  searchRow: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    minHeight: 48,
  },
  productRow: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cart: { margin: theme.spacing.md },
  cartLine: { marginBottom: theme.spacing.sm },
  lineName: { flex: 1 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  qtyBtn: { minWidth: 44, paddingHorizontal: 12 },
  checkout: { marginTop: theme.spacing.md },
});
