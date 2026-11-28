import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { phase_15_storefront_public } from '@kiosk/types';
import { useTenant } from '../lib/TenantContext';
import { useInfiniteItems } from '../hooks/useInfiniteItems';
import { ProductCard } from '../components/ProductCard';
import { AisleBodySkeleton, ProductGridSkeleton, SkeletonScope } from '../components/Skeleton';
import { Coast, COAST_SWELL, Lobe, LobeFrame, lobeIndex } from '../components/Coast';
import { StateBlock } from '../components/StateBlock';
import { titleCase } from '../lib/aisle-icon';
import { categoryIconImageUrl, itemCountLabel } from '../lib/media';
import { useBasketFloatReserve } from '../components/BasketFloat';
import { RootStackParamList } from '../navigation/AppNavigator';
import { GUTTER, MART, martFromTenant, onFill, SPACE, TYPE, zoneFor } from '../theme/mart';

type Props = NativeStackScreenProps<RootStackParamList, 'Category'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];

const CELL_PAD = SPACE.sm - 2;
const LIST_PAD = GUTTER - CELL_PAD;
const PHOTO = 84;

export function CategoryScreen() {
  const tenant = useTenant();
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<NavigationProp>();
  const { categoryId, categoryName, categoryIcon } = route.params;
  const basketReserve = useBasketFloatReserve();
  const mart = martFromTenant(tenant);
  const catalog = useInfiniteItems(tenant.slug, { categoryId });
  const photo = categoryIconImageUrl(categoryIcon);
  // The aisle keeps the colour and outline it has on Home, and its land runs from the status bar down.
  const zone = zoneFor(categoryId);
  const shape = lobeIndex(categoryId);
  const on = onFill(zone);
  const [landHeight, setLandHeight] = useState(96);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerStyle: { backgroundColor: zone },
      headerTintColor: on.primary,
    });
  }, [navigation, zone, on.primary]);

  const handleItemPress = useCallback(
    (item: Item) => {
      if (item.id) {
        navigation.navigate('ProductDetail', { itemId: item.id });
      }
    },
    [navigation]
  );

  function loadMore() {
    if (catalog.hasNextPage && !catalog.isFetchingNextPage) {
      void catalog.fetchNextPage();
    }
  }

  if (catalog.isLoading && catalog.items.length === 0) {
    return <AisleBodySkeleton />;
  }

  if (catalog.error && catalog.items.length === 0) {
    return (
      <View style={styles.list}>
        <StateBlock
          tone="problem"
          icon="cloud-offline"
          title={`We could not load ${titleCase(categoryName)}`}
          body="Check your connection, then try again."
          actionLabel="Try again"
          actionChip="refresh"
          onAction={() => void catalog.refetch()}
          fill={mart.primary}
        />
      </View>
    );
  }

  const count =
    typeof catalog.totalCount === 'number' ? catalog.totalCount : catalog.items.length;

  return (
    <FlatList
      data={catalog.items}
      keyExtractor={(item, index) => item.id ?? `${item.name ?? 'item'}-${index}`}
      numColumns={3}
      style={styles.list}
      contentContainerStyle={[styles.listContent, { paddingBottom: SPACE.xxxl + basketReserve }]}
      onEndReached={loadMore}
      onEndReachedThreshold={0.45}
      refreshControl={
        <RefreshControl
          refreshing={Boolean(catalog.isRefetching && catalog.items.length > 0)}
          onRefresh={() => void catalog.refetch()}
          tintColor={on.primary}
          colors={[mart.primary]}
        />
      }
      ListHeaderComponent={
        <View style={styles.land}>
          {/* Pulling down shows more land, not the water behind it. */}
          <View style={[styles.landAbove, { backgroundColor: zone }]} />
          <Coast color={zone} height={landHeight} />
          <View
            style={styles.landCopy}
            onLayout={(event) => setLandHeight(event.nativeEvent.layout.height)}
          >
            <View style={styles.landText}>
              <Text accessibilityRole="header" style={[styles.landName, { color: on.primary }]}>
                {titleCase(categoryName)}
              </Text>
              <Text style={[styles.landMeta, { color: on.secondary }]}>{itemCountLabel(count)}</Text>
            </View>
            {photo ? (
              <Lobe color={MART.paper} size={PHOTO} shape={shape}>
                <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" transition={180} />
                <LobeFrame size={PHOTO} shape={shape} ground={zone} />
              </Lobe>
            ) : null}
          </View>
        </View>
      }
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
      ListEmptyComponent={
        <StateBlock
          icon="basket"
          title="Nothing here right now"
          body="Look in another section, or search for a product by name."
          actionLabel="Search the shop"
          actionChip="search"
          onAction={() => navigation.navigate('Search')}
          fill={mart.primary}
          style={styles.empty}
        />
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {catalog.isFetchingNextPage ? (
            <SkeletonScope label="Loading more products">
              <ProductGridSkeleton count={3} />
            </SkeletonScope>
          ) : catalog.items.length > 0 && !catalog.hasNextPage ? (
            <Text style={styles.endText}>That is everything.</Text>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  listContent: {
    paddingHorizontal: LIST_PAD,
  },
  land: {
    marginHorizontal: -LIST_PAD,
    marginBottom: SPACE.lg,
    paddingBottom: COAST_SWELL * 2,
  },
  landAbove: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -800,
    height: 800,
  },
  landCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xs,
    paddingBottom: SPACE.lg,
  },
  landText: {
    flex: 1,
    minWidth: 0,
  },
  landName: {
    ...TYPE.display,
  },
  landMeta: {
    ...TYPE.label,
    marginTop: SPACE.sm,
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
  },
  itemWrapper: {
    width: '33.333%',
    paddingHorizontal: CELL_PAD,
    paddingBottom: SPACE.md,
  },
  empty: {
    paddingHorizontal: CELL_PAD,
    paddingTop: SPACE.sm,
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
