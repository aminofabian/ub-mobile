import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { phase_15_storefront_public } from '@kiosk/types';
import { useTenant } from '../lib/TenantContext';
import { useStorefront } from '../hooks/useStorefront';
import { useCategories } from '../hooks/useCategories';
import { useCatalogTypes } from '../hooks/useCatalogTypes';
import { useInfiniteItems } from '../hooks/useInfiniteItems';
import { useAirtimeConfig } from '../hooks/useAirtimeConfig';
import { AislePhotoRail } from '../components/AislePhotoRail';
import { CounterServices } from '../components/CounterServices';
import { CoverageNotice } from '../components/CoverageNotice';
import { MartHero } from '../components/MartHero';
import { MartHomeHeader, MartSearchField } from '../components/MartChrome';
import { ProductCard } from '../components/ProductCard';
import { StoreSwitcherSheet } from '../components/StoreSwitcherSheet';
import { ProductGridSkeleton, SkeletonScope, StorefrontBodySkeleton } from '../components/Skeleton';
import { SectionHead } from '../components/SectionHead';
import { TypeRail } from '../components/TypeRail';
import { counterServices } from '../lib/coverage';
import { useShopNavigator } from '../lib/ShopNavigator';
import { GUTTER, MART, martFromTenant, SPACE, TYPE } from '../theme/mart';
import { useBasketFloatReserve } from '../components/BasketFloat';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];
type Category = phase_15_storefront_public.components['schemas']['PublicCategoryResponse'];
type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** The grid pads each cell, so the list itself stops short of the page gutter. */
const CELL_PAD = SPACE.xs;
const LIST_PAD = GUTTER - CELL_PAD;

export function HomeScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const basketReserve = useBasketFloatReserve();
  const listRef = useRef<FlatList<Item>>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [dealsOnly, setDealsOnly] = useState(false);
  const shopNavigator = useShopNavigator();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const {
    data: storefront,
    isLoading: storefrontLoading,
    error: storefrontError,
    refetch: refetchStorefront,
  } = useStorefront(tenant.slug);
  const {
    data: categories,
    isLoading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useCategories(tenant.slug);
  const {
    data: typesData,
    isLoading: typesLoading,
    refetch: refetchTypes,
  } = useCatalogTypes(tenant.slug);
  const catalog = useInfiniteItems(tenant.slug, {
    typeId: selectedTypeId ?? undefined,
  });
  const { data: airtime } = useAirtimeConfig(tenant.slug);
  // The server can switch a counter service off for a shop; a shop it says nothing about keeps both.
  const services = counterServices(tenant.capabilities);
  const airtimeShown = Boolean(airtime?.available) && services.airtime;

  const mart = useMemo(
    () =>
      martFromTenant(tenant, {
        announcement: storefront?.announcement,
        businessName: storefront?.businessName,
      }),
    [tenant, storefront?.announcement, storefront?.businessName]
  );

  const bootLoading =
    (storefrontLoading || categoriesLoading || typesLoading || catalog.isLoading) &&
    !storefront &&
    !catalog.items.length;
  const error = storefrontError || categoriesError || catalog.error;
  const types = typesData?.types?.filter((t) => t.label?.trim()) ?? [];
  const featured = (storefront?.featured ?? []).filter((item) => Boolean(item.id));
  const catalogItems = dealsOnly ? featured : catalog.items;
  const currency = catalog.currency ?? storefront?.currency ?? 'KES';
  const totalCount = dealsOnly ? featured.length : catalog.totalCount;
  const activeType = types.find((type) => type.id === selectedTypeId);

  const handleRefresh = useCallback(() => {
    refetchStorefront();
    refetchCategories();
    refetchTypes();
    void catalog.refetch();
  }, [refetchStorefront, refetchCategories, refetchTypes, catalog.refetch]);

  function handleCategorySelect(category: Category) {
    if (category.id) {
      navigation.navigate('Category', {
        categoryId: category.id,
        categoryName: category.name ?? 'Aisle',
        categoryIcon: category.icon,
      });
    }
  }

  const handleItemPress = useCallback(
    (item: Item) => {
      if (item.id) {
        navigation.navigate('ProductDetail', { itemId: item.id });
      }
    },
    [navigation]
  );

  function loadMore() {
    if (dealsOnly) return;
    if (catalog.hasNextPage && !catalog.isFetchingNextPage) {
      void catalog.fetchNextPage();
    }
  }

  const shelfTitle = dealsOnly
    ? 'This week’s deals'
    : activeType
      ? activeType.label
      : 'Everything in store';
  const shelfHint =
    typeof totalCount === 'number' && totalCount > catalogItems.length
      ? `Showing ${catalogItems.length} of ${totalCount}`
      : `${catalogItems.length} ${catalogItems.length === 1 ? 'item' : 'items'}`;

  const listHeader = (
    <View style={styles.headerBleed}>
      <MartHero
        mart={mart}
        onShopNow={() => listRef.current?.scrollToOffset({ offset: 420, animated: true })}
      />

      <CoverageNotice tenant={tenant} />

      {airtimeShown || services.powerTokens ? (
        <View style={styles.services}>
          <CounterServices
            airtimeAvailable={airtimeShown}
            showPowerTokens={services.powerTokens}
            primary={mart.primary}
            accent={mart.accent}
            onAirtime={() => navigation.navigate('Airtime')}
            onTokens={() => navigation.navigate('Kplc')}
          />
        </View>
      ) : null}

      {(categories?.categories?.length ?? 0) > 0 ? (
        <>
          <SectionHead title="Shop by aisle" hint="Tap an aisle to browse its shelves" />
          <AislePhotoRail
            categories={categories?.categories ?? []}
            primary={mart.primary}
            accent={mart.accent}
            onSelect={handleCategorySelect}
          />
        </>
      ) : null}

      {types.length > 0 ? (
        <>
          <SectionHead
            title="Departments"
            actionLabel={activeType ? 'Clear' : undefined}
            onAction={activeType ? () => setSelectedTypeId(null) : undefined}
          />
          <TypeRail
            types={types}
            primary={mart.primary}
            selectedId={selectedTypeId}
            onSelect={(type) => {
              setDealsOnly(false);
              setSelectedTypeId((current) => (current === type.id ? null : type.id));
            }}
          />
        </>
      ) : null}

      <SectionHead
        title={shelfTitle}
        hint={shelfHint}
        actionLabel={dealsOnly ? 'Show all' : featured.length > 0 ? 'Deals only' : undefined}
        onAction={
          dealsOnly
            ? () => setDealsOnly(false)
            : featured.length > 0
              ? () => {
                  setDealsOnly(true);
                  setSelectedTypeId(null);
                }
              : undefined
        }
      />
    </View>
  );

  return (
    <View style={[styles.shell, { paddingTop: insets.top }]}>
      <MartHomeHeader
        mart={mart}
        onPressShop={shopNavigator.enabled ? () => setSwitcherOpen(true) : undefined}
      />
      <MartSearchField primary={mart.primary} onPress={() => navigation.navigate('Search')} />

      {bootLoading ? (
        <StorefrontBodySkeleton />
      ) : error ? (
        <View style={styles.errorBlock}>
          <Text style={styles.errorTitle}>We could not load the store</Text>
          <Text style={styles.errorBody}>Pull down to try again.</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={catalogItems}
          keyExtractor={(item, index) => item.id ?? `${item.name ?? 'item'}-${index}`}
          numColumns={2}
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: SPACE.xxxl + basketReserve }]}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => (
            <View style={styles.cell}>
              <ProductCard
                item={item}
                currency={currency}
                accent={mart.primary}
                onPress={handleItemPress}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyTitle}>
                {dealsOnly ? 'No deals running today' : 'This shelf is empty'}
              </Text>
              <Text style={styles.emptyBody}>
                {dealsOnly
                  ? 'Show all to browse the rest of the store.'
                  : 'Try another department, or pull down to refresh.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {catalog.isFetchingNextPage ? (
                <SkeletonScope label="Loading more products">
                  <ProductGridSkeleton count={2} />
                </SkeletonScope>
              ) : !dealsOnly && catalogItems.length > 0 && !catalog.hasNextPage ? (
                <Text style={styles.endText}>That is the full aisle.</Text>
              ) : null}
            </View>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.45}
          refreshControl={
            <RefreshControl
              refreshing={Boolean(catalog.isRefetching && catalogItems.length > 0)}
              onRefresh={handleRefresh}
              tintColor={mart.primary}
            />
          }
        />
      )}

      {shopNavigator.enabled ? (
        <StoreSwitcherSheet
          visible={switcherOpen}
          activeSlug={tenant.slug}
          activeName={mart.displayName}
          onClose={() => setSwitcherOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: MART.paperElevated,
  },
  scroll: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  content: {
    paddingTop: SPACE.md,
    paddingBottom: SPACE.xxxl,
    paddingHorizontal: LIST_PAD,
  },
  /** Sections own the page gutter, so the header escapes the grid's cell pad. */
  headerBleed: {
    marginHorizontal: -LIST_PAD,
  },
  services: {
    marginTop: SPACE.lg,
  },
  cell: {
    width: '50%',
    padding: CELL_PAD,
  },
  errorBlock: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xxl,
  },
  errorTitle: {
    ...TYPE.heading,
    color: MART.ink,
  },
  errorBody: {
    ...TYPE.body,
    marginTop: SPACE.xs,
    color: MART.inkMuted,
  },
  emptyBlock: {
    paddingHorizontal: CELL_PAD,
    paddingTop: SPACE.lg,
  },
  emptyTitle: {
    ...TYPE.heading,
    color: MART.ink,
  },
  emptyBody: {
    ...TYPE.body,
    marginTop: SPACE.xs,
    color: MART.inkMuted,
  },
  footer: {
    paddingVertical: SPACE.xl,
    alignItems: 'center',
  },
  endText: {
    ...TYPE.meta,
    color: MART.inkQuiet,
  },
});
