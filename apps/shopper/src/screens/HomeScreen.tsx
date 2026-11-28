import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
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
import { HOME_HEADER_OPEN, MartHomeHeader } from '../components/MartChrome';
import { ProductCard } from '../components/ProductCard';
import { StoreSwitcherSheet } from '../components/StoreSwitcherSheet';
import { ProductGridSkeleton, SkeletonScope, StorefrontBodySkeleton } from '../components/Skeleton';
import { SectionHead } from '../components/SectionHead';
import { TypeRail } from '../components/TypeRail';
import { counterServices } from '../lib/coverage';
import { useShopNavigator } from '../lib/ShopNavigator';
import { GUTTER, MART, martFromTenant, SPACE, TYPE } from '../theme/mart';
import { StateBlock } from '../components/StateBlock';
import { useBasketFloatReserve } from '../components/BasketFloat';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];
type Category = phase_15_storefront_public.components['schemas']['PublicCategoryResponse'];
type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** The grid pads each cell, so the list itself stops short of the page gutter. */
const CELL_PAD = SPACE.sm - 2;
const LIST_PAD = GUTTER - CELL_PAD;

export function HomeScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const basketReserve = useBasketFloatReserve();
  const listRef = useAnimatedRef<Animated.FlatList<Item>>();
  // The header floats over the list. iOS starts the list under it with a content inset, so the pull-to-
  // refresh spinner shows below the coast; Android pads the content and offsets its spinner instead.
  const headerRoom = insets.top + HOME_HEADER_OPEN + SPACE.md;
  const inset = Platform.OS === 'ios';
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y + (inset ? headerRoom : 0);
  });
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
        categoryName: category.name ?? 'Category',
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
    ? 'Deals this week'
    : activeType
      ? activeType.label
      : 'All products';
  const shelfHint =
    typeof totalCount === 'number' && totalCount > catalogItems.length
      ? `Showing ${catalogItems.length} of ${totalCount}`
      : `${catalogItems.length} ${catalogItems.length === 1 ? 'item' : 'items'}`;

  const listHeader = (
    <View style={styles.headerBleed}>
      <MartHero
        mart={mart}
        onShopNow={() =>
          listRef.current?.scrollToOffset({ offset: 380 - (inset ? headerRoom : 0), animated: true })
        }
      />

      <CoverageNotice tenant={tenant} />

      {airtimeShown || services.powerTokens ? (
        <View style={styles.services}>
          <CounterServices
            airtimeAvailable={airtimeShown}
            showPowerTokens={services.powerTokens}
            onAirtime={() => navigation.navigate('Airtime')}
            onTokens={() => navigation.navigate('Kplc')}
          />
        </View>
      ) : null}

      {(categories?.categories?.length ?? 0) > 0 ? (
        <>
          <SectionHead title="Categories" />
          <AislePhotoRail categories={categories?.categories ?? []} onSelect={handleCategorySelect} />
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
    <View style={styles.shell}>
      {bootLoading ? (
        <View style={{ paddingTop: headerRoom }}>
          <StorefrontBodySkeleton />
        </View>
      ) : error ? (
        <StateBlock
          tone="problem"
          icon="cloud-offline"
          title="We could not load the shop"
          body="Check your connection, then try again."
          actionLabel="Try again"
          actionChip="refresh"
          onAction={handleRefresh}
          fill={mart.primary}
          style={{ paddingTop: headerRoom + SPACE.xxl }}
        />
      ) : (
        <Animated.FlatList
          ref={listRef}
          data={catalogItems}
          keyExtractor={(item, index) => item.id ?? `${item.name ?? 'item'}-${index}`}
          numColumns={3}
          style={styles.scroll}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentInset={inset ? { top: headerRoom } : undefined}
          contentOffset={inset ? { x: 0, y: -headerRoom } : undefined}
          scrollIndicatorInsets={{ top: headerRoom - insets.top }}
          contentContainerStyle={[
            styles.content,
            { paddingTop: inset ? 0 : headerRoom, paddingBottom: SPACE.xxxl + basketReserve },
          ]}
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
                {dealsOnly ? 'No deals today' : 'Nothing here yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {dealsOnly
                  ? 'Show all to browse the rest of the shop.'
                  : activeType
                    ? 'Try another department, or pull down to refresh.'
                    : 'The shop has not listed any products. Pull down to check again.'}
              </Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {catalog.isFetchingNextPage ? (
                <SkeletonScope label="Loading more products">
                  <ProductGridSkeleton count={3} />
                </SkeletonScope>
              ) : !dealsOnly && catalogItems.length > 0 && !catalog.hasNextPage ? (
                <Text style={styles.endText}>That is everything.</Text>
              ) : null}
            </View>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.45}
          refreshControl={
            <RefreshControl
              refreshing={Boolean(catalog.isRefetching && catalogItems.length > 0)}
              onRefresh={handleRefresh}
              tintColor={MART.ink}
              colors={[mart.primary]}
              progressViewOffset={inset ? 0 : headerRoom}
            />
          }
        />
      )}

      <StatusBar style={mart.onPrimary.primary === MART.ink ? 'dark' : 'light'} />
      <MartHomeHeader
        mart={mart}
        scrollY={scrollY}
        onPressShop={shopNavigator.enabled ? () => setSwitcherOpen(true) : undefined}
        onSearch={() => navigation.navigate('Search')}
      />

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
    backgroundColor: MART.paper,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: LIST_PAD,
  },
  /** Sections own the page gutter, so the header escapes the grid's cell pad. */
  headerBleed: {
    marginHorizontal: -LIST_PAD,
    marginBottom: SPACE.xs,
  },
  services: {
    marginTop: SPACE.md,
  },
  cell: {
    width: '33.333%',
    paddingHorizontal: CELL_PAD,
    paddingBottom: SPACE.md,
  },
  emptyBlock: {
    paddingHorizontal: CELL_PAD,
    paddingTop: SPACE.sm,
  },
  emptyTitle: {
    ...TYPE.heading,
    color: MART.ink,
  },
  emptyBody: {
    ...TYPE.body,
    marginTop: SPACE.xs,
    color: MART.inkMuted,
    maxWidth: 320,
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
