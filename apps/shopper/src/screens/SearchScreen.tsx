import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text } from '@kiosk/ui';
import { phase_15_storefront_public } from '@kiosk/types';
import { useTenant } from '../lib/TenantContext';
import { fetchItems, fetchProduct } from '../api/storefront';
import { ProductCard } from '../components/ProductCard';
import { SearchBar } from '../components/SearchBar';
import { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];

export function SearchScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<NavigationProp>();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setItems([]);
      setError(null);
      return;
    }

    const timeout = setTimeout(() => performSearch(trimmed), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  async function performSearch(searchQuery: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchItems(tenant.slug, {
        search: searchQuery,
        limit: 50,
      });
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleBarcodeScan(barcode: string) {
    setScannerVisible(false);
    setQuery(barcode);
    setLoading(true);
    setError(null);
    try {
      // First attempt: server-side search by barcode.
      const data = await fetchItems(tenant.slug, {
        search: barcode,
        limit: 20,
      });
      if (data.items && data.items.length === 1 && data.items[0].id) {
        navigation.navigate('ProductDetail', { itemId: data.items[0].id });
        return;
      }
      if (data.items && data.items.length > 1) {
        setItems(data.items);
        return;
      }

      // Fallback: direct product lookup (barcode may be used as item id in some catalogs).
      try {
        const product = await fetchProduct(tenant.slug, barcode);
        if (product.id) {
          navigation.navigate('ProductDetail', { itemId: product.id });
          return;
        }
      } catch {
        // ignore lookup failure
      }

      setError(`No product found for barcode: ${barcode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Barcode lookup failed');
    } finally {
      setLoading(false);
    }
  }

  async function openScanner() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('Camera permission is required to scan barcodes');
        return;
      }
    }
    setScannerVisible(true);
  }

  const handleItemPress = useCallback(
    (item: Item) => {
      if (item.id) {
        navigation.navigate('ProductDetail', { itemId: item.id });
      }
    },
    [navigation]
  );

  return (
    <View style={styles.container}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        onBarcodePress={openScanner}
        placeholder="Search by name or barcode"
        autoFocus
      />

      {loading ? (
        <ActivityIndicator size="large" color="#28a745" style={styles.loader} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : query.trim() && items.length === 0 ? (
        <Text variant="muted" style={styles.emptyText}>
          No products found.
        </Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id ?? item.name ?? ''}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.itemWrapper}>
              <ProductCard item={item} currency={undefined} onPress={handleItemPress} />
            </View>
          )}
        />
      )}

      <Modal visible={scannerVisible} animationType="slide">
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a', 'code128', 'qr'] }}
            onBarcodeScanned={({ data }) => {
              if (data) handleBarcodeScan(data);
            }}
          />
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setScannerVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 8,
  },
  loader: {
    marginTop: 48,
  },
  error: {
    color: '#dc3545',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 32,
  },
  itemWrapper: {
    width: '50%',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
