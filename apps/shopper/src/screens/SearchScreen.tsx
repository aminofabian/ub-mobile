import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { phase_15_storefront_public } from '@kiosk/types';
import { useTenant } from '../lib/TenantContext';
import { fetchItems, fetchProduct } from '../api/storefront';
import { useInfiniteItems } from '../hooks/useInfiniteItems';
import { useCategories } from '../hooks/useCategories';
import { ProductCard } from '../components/ProductCard';
import { ProductGridSkeleton, SkeletonScope } from '../components/Skeleton';
import { SearchBar } from '../components/SearchBar';
import { AislePhotoRail } from '../components/AislePhotoRail';
import { useBasketFloatReserve } from '../components/BasketFloat';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import {
  ELEVATION,
  GUTTER,
  MART,
  martFromTenant,
  RADIUS,
  SPACE,
  TYPE,
} from '../theme/mart';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Search'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];
type Category = phase_15_storefront_public.components['schemas']['PublicCategoryResponse'];

export function SearchScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<NavigationProp>();
  const basketReserve = useBasketFloatReserve();
  const mart = martFromTenant(tenant);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const { data: categories } = useCategories(tenant.slug);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const catalog = useInfiniteItems(
    tenant.slug,
    { search: debounced || undefined },
    debounced.length > 0
  );

  async function handleBarcodeScan(barcode: string) {
    setScannerVisible(false);
    setQuery(barcode);
    setScanError(null);
    try {
      const data = await fetchItems(tenant.slug, {
        search: barcode,
        limit: 20,
      });
      if (data.items && data.items.length === 1 && data.items[0].id) {
        navigation.navigate('ProductDetail', { itemId: data.items[0].id });
        return;
      }
      if (data.items && data.items.length > 1) {
        return;
      }
      try {
        const product = await fetchProduct(tenant.slug, barcode);
        if (product.id) {
          navigation.navigate('ProductDetail', { itemId: product.id });
        }
      } catch {
        setScanError(`No product found for barcode ${barcode}.`);
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Barcode lookup failed');
    }
  }

  async function openScanner() {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setScanError('Camera permission is required to scan barcodes.');
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

  function handleCategorySelect(category: Category) {
    if (category.id) {
      navigation.navigate('Category', {
        categoryId: category.id,
        categoryName: category.name ?? 'Aisle',
        categoryIcon: category.icon,
      });
    }
  }

  function loadMore() {
    if (!debounced) return;
    if (catalog.hasNextPage && !catalog.isFetchingNextPage) {
      void catalog.fetchNextPage();
    }
  }

  const showResults = debounced.length > 0;
  const error = scanError || (catalog.error instanceof Error ? catalog.error.message : null);
  const aisleList = categories?.categories ?? [];

  return (
    <View style={styles.container}>
      <SearchBar
        value={query}
        onChangeText={(text) => {
          setScanError(null);
          setQuery(text);
        }}
        onBarcodePress={openScanner}
        placeholder="Name, brand, or barcode"
        autoFocus
        accent={mart.primary}
      />

      {!showResults ? (
        <View style={styles.idle}>
          <Text style={styles.idleTitle}>Find it on the shelf</Text>
          <Text style={styles.idleBody}>
            Type a name, scan a barcode, or jump straight into an aisle.
          </Text>
          {aisleList.length > 0 ? (
            <AislePhotoRail
              categories={aisleList}
              primary={mart.primary}
              accent={mart.accent}
              onSelect={handleCategorySelect}
            />
          ) : (
            <View style={styles.hints}>
              <View style={styles.hint}>
                <Ionicons name="barcode-outline" size={18} color={mart.primary} />
                <Text style={styles.hintText}>Scan a pack to jump to the product</Text>
              </View>
              <View style={styles.hint}>
                <Ionicons name="search-outline" size={18} color={mart.primary} />
                <Text style={styles.hintText}>Try milk, bread, or a brand name</Text>
              </View>
            </View>
          )}
        </View>
      ) : showResults && catalog.isLoading && catalog.items.length === 0 ? (
        <SkeletonScope label="Searching the shop" style={styles.skel}>
          <ProductGridSkeleton count={6} />
        </SkeletonScope>
      ) : error && catalog.items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Search could not finish</Text>
          <Text style={styles.errorBody}>{error}</Text>
        </View>
      ) : showResults && catalog.items.length === 0 && !catalog.isLoading ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={24} color={MART.inkQuiet} />
          <Text style={styles.emptyTitle}>Nothing matches “{debounced}”</Text>
          <Text style={styles.emptyBody}>Try a shorter name, or scan the barcode on the pack.</Text>
        </View>
      ) : (
        <FlatList
          data={catalog.items}
          keyExtractor={(item, index) => item.id ?? `${item.name ?? 'item'}-${index}`}
          numColumns={2}
          contentContainerStyle={[styles.listContent, { paddingBottom: SPACE.xxxl + basketReserve }]}
          onEndReached={loadMore}
          onEndReachedThreshold={0.45}
          renderItem={({ item }) => (
            <View style={styles.itemWrapper}>
              <ProductCard
                item={item}
                currency={catalog.currency}
                accent={mart.primary}
                onPress={handleItemPress}
              />
            </View>
          )}
          ListFooterComponent={
            catalog.isFetchingNextPage ? (
              <SkeletonScope label="Loading more results">
                <ProductGridSkeleton count={2} />
              </SkeletonScope>
            ) : null
          }
        />
      )}

      <Modal visible={scannerVisible} animationType="slide">
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a', 'code128', 'qr'] }}
            onBarcodeScanned={({ data }) => {
              if (data) void handleBarcodeScan(data);
            }}
          />
          <View style={styles.scanFrame} pointerEvents="none" />
          <Pressable
            style={styles.closeButton}
            onPress={() => setScannerVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close scanner"
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MART.paper,
    paddingTop: SPACE.md,
  },
  idle: {
    paddingTop: SPACE.sm,
  },
  idleTitle: {
    ...TYPE.title,
    marginHorizontal: GUTTER,
    color: MART.ink,
  },
  idleBody: {
    ...TYPE.body,
    marginHorizontal: GUTTER,
    marginTop: SPACE.xs,
    marginBottom: SPACE.xl,
    color: MART.inkMuted,
  },
  hints: {
    marginHorizontal: GUTTER,
    gap: SPACE.sm,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    minHeight: 52,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
  },
  hintText: {
    ...TYPE.label,
    flex: 1,
    color: MART.ink,
  },
  skel: {
    flex: 1,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: SPACE.xxl,
    paddingTop: SPACE.xxxl,
    gap: SPACE.sm,
  },
  emptyTitle: {
    ...TYPE.heading,
    color: MART.ink,
    textAlign: 'center',
  },
  emptyBody: {
    ...TYPE.body,
    color: MART.inkMuted,
    textAlign: 'center',
  },
  errorBody: {
    ...TYPE.body,
    color: MART.danger,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: GUTTER - SPACE.xs,
    paddingBottom: SPACE.xxxl,
  },
  itemWrapper: {
    width: '50%',
    padding: SPACE.xs,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  scanFrame: {
    position: 'absolute',
    alignSelf: 'center',
    top: '30%',
    width: 240,
    height: 160,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: RADIUS.md,
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: GUTTER,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.md,
  },
  closeButtonText: {
    ...TYPE.label,
    color: '#ffffff',
  },
});
