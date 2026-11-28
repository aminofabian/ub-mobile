import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { ChipButton } from '../components/Capsule';
import { ScreenTitle } from '../components/ScreenTitle';
import { SectionHead } from '../components/SectionHead';
import { SHEET_SCRIM } from '../components/SheetPanel';
import { StateBlock } from '../components/StateBlock';
import { useBasketFloatReserve } from '../components/BasketFloat';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { GUTTER, MART, martFromTenant, RADIUS, SPACE, TYPE } from '../theme/mart';

const CELL_PAD = SPACE.sm - 2;

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
  // This screen is the Search tab, and is also pushed on the stack under a native "Search" header.
  const asTab = navigation.getState().type === 'tab';
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
        categoryName: category.name ?? 'Category',
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
    <View style={[styles.container, !asTab && styles.pushed]}>
      {asTab ? <ScreenTitle title="Search" /> : null}
      <SearchBar
        value={query}
        onChangeText={(text) => {
          setScanError(null);
          setQuery(text);
        }}
        onBarcodePress={openScanner}
        placeholder="Name, brand or barcode"
        autoFocus={!asTab}
        accent={mart.accent}
      />

      {scanError && !showResults ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Ionicons name="alert-circle" size={20} color={MART.danger} />
          <Text style={styles.noticeText}>{scanError}</Text>
        </View>
      ) : null}

      {!showResults ? (
        <View>
          {aisleList.length > 0 ? (
            <>
              <SectionHead title="Categories" />
              <AislePhotoRail categories={aisleList} onSelect={handleCategorySelect} />
            </>
          ) : (
            <Text style={styles.idleBody}>
              Type a name or a brand, or scan the barcode on a pack to go straight to it.
            </Text>
          )}
        </View>
      ) : showResults && catalog.isLoading && catalog.items.length === 0 ? (
        <SkeletonScope label="Searching the shop" style={styles.skel}>
          <ProductGridSkeleton count={6} />
        </SkeletonScope>
      ) : error && catalog.items.length === 0 ? (
        <StateBlock
          tone="problem"
          icon="cloud-offline"
          title="Search could not finish"
          body={error}
          style={styles.state}
        />
      ) : showResults && catalog.items.length === 0 && !catalog.isLoading ? (
        <StateBlock
          icon="search"
          title={`Nothing matches “${debounced}”`}
          body="Try a shorter name, or scan the barcode on the pack."
          actionLabel="Scan a barcode"
          actionChip="barcode-outline"
          onAction={() => void openScanner()}
          fill={mart.primary}
          style={styles.state}
        />
      ) : (
        <FlatList
          data={catalog.items}
          keyExtractor={(item, index) => item.id ?? `${item.name ?? 'item'}-${index}`}
          numColumns={3}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
                <ProductGridSkeleton count={3} />
              </SkeletonScope>
            ) : null
          }
        />
      )}

      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => setScannerVisible(false)}>
        {/* A modal is its own window on Android, so it needs its own safe-area provider. */}
        <SafeAreaProvider>
          <Scanner onClose={() => setScannerVisible(false)} onScanned={(data) => void handleBarcodeScan(data)} />
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

/** The camera, edge to edge, dimmed everywhere but an outlined window to hold the barcode in. */
function Scanner({ onClose, onScanned }: { onClose: () => void; onScanned: (data: string) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.scannerContainer}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'upc_a', 'code128', 'qr'] }}
        onBarcodeScanned={({ data }) => {
          if (data) onScanned(data);
        }}
      />
      <View style={styles.scanMask} pointerEvents="none">
        <View style={styles.scanShade} />
        <View style={styles.scanRow}>
          <View style={styles.scanShade} />
          <View style={styles.scanWindow}>
            <View style={styles.scanFrame} />
          </View>
          <View style={styles.scanShade} />
        </View>
        <View style={[styles.scanShade, styles.scanBelow]}>
          <Text style={styles.scanTitle}>Scan a barcode</Text>
          <Text style={styles.scanBody}>Hold the barcode on the pack inside the window.</Text>
        </View>
      </View>
      <View style={[styles.closeButton, { top: insets.top + SPACE.md }]}>
        <ChipButton icon="close" label="Close scanner" onPress={onClose} fill={MART.paper} size={44} />
      </View>
    </View>
  );
}

const WINDOW_W = 280;
const WINDOW_H = 180;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  pushed: {
    paddingTop: SPACE.md,
  },
  notice: {
    flexDirection: 'row',
    gap: SPACE.sm,
    marginHorizontal: GUTTER,
    marginBottom: SPACE.md,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.dangerSurface,
  },
  noticeText: {
    ...TYPE.label,
    flex: 1,
    color: MART.danger,
  },
  tries: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xs,
  },
  tryChip: {
    minHeight: 44,
    paddingHorizontal: SPACE.lg,
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: MART.ink,
  },
  tryText: {
    ...TYPE.label,
    color: MART.ink,
  },
  pressed: {
    opacity: 0.6,
  },
  idleBody: {
    ...TYPE.body,
    marginHorizontal: GUTTER,
    marginTop: SPACE.xl,
    color: MART.inkMuted,
  },
  skel: {
    flex: 1,
  },
  state: {
    paddingTop: SPACE.lg,
  },
  listContent: {
    paddingHorizontal: GUTTER - CELL_PAD,
    paddingTop: SPACE.xs,
  },
  itemWrapper: {
    width: '33.333%',
    paddingHorizontal: CELL_PAD,
    paddingBottom: SPACE.md,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: MART.ink,
  },
  scanMask: {
    ...StyleSheet.absoluteFillObject,
  },
  scanShade: {
    flex: 1,
    backgroundColor: SHEET_SCRIM,
  },
  scanRow: {
    flexDirection: 'row',
    height: WINDOW_H,
  },
  scanWindow: {
    width: WINDOW_W,
    height: WINDOW_H,
  },
  /** The window's edge: a cream outline with round shoulders, just inside the clear area. */
  scanFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderColor: MART.paper,
    borderRadius: RADIUS.lg,
  },
  scanBelow: {
    alignItems: 'center',
    paddingTop: SPACE.xxl,
    paddingHorizontal: GUTTER,
  },
  scanTitle: {
    ...TYPE.title,
    color: MART.paper,
  },
  scanBody: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    textAlign: 'center',
    color: MART.paper,
  },
  closeButton: {
    position: 'absolute',
    right: GUTTER,
  },
});
