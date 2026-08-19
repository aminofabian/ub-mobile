import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { phase_15_storefront_public } from '@kiosk/types';
import { useTenant } from '../lib/TenantContext';
import { useInfiniteItems } from '../hooks/useInfiniteItems';
import { ProductCard } from '../components/ProductCard';
import { AisleBodySkeleton, ProductGridSkeleton, SkeletonScope } from '../components/Skeleton';
import { categoryIconImageUrl, itemCountLabel } from '../lib/media';
import { useBasketFloatReserve } from '../components/BasketFloat';
import { RootStackParamList } from '../navigation/AppNavigator';
import {
  GUTTER,
  MART,
  martFromTenant,
  ON_BRAND,
  RADIUS,
  SPACE,
  TYPE,
  tint,
} from '../theme/mart';

type Props = NativeStackScreenProps<RootStackParamList, 'Category'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];

export function CategoryScreen() {
  const tenant = useTenant();
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<NavigationProp>();
  const { categoryId, categoryName, categoryIcon } = route.params;
  const basketReserve = useBasketFloatReserve();
  const mart = martFromTenant(tenant);
  const catalog = useInfiniteItems(tenant.slug, { categoryId });
  const photo = categoryIconImageUrl(categoryIcon);

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
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={26} color={MART.danger} />
        <Text style={styles.error}>We could not load this aisle.</Text>
        <Pressable
          onPress={() => void catalog.refetch()}
          style={[styles.retry, { backgroundColor: mart.primary }]}
          accessibilityRole="button"
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const count =
    typeof catalog.totalCount === 'number' ? catalog.totalCount : catalog.items.length;

  return (
    <FlatList
      data={catalog.items}
      keyExtractor={(item, index) => item.id ?? `${item.name ?? 'item'}-${index}`}
      numColumns={2}
      style={styles.list}
      contentContainerStyle={[styles.listContent, { paddingBottom: SPACE.xxxl + basketReserve }]}
      onEndReached={loadMore}
      onEndReachedThreshold={0.45}
      refreshControl={
        <RefreshControl
          refreshing={Boolean(catalog.isRefetching && catalog.items.length > 0)}
          onRefresh={() => void catalog.refetch()}
          tintColor={mart.primary}
        />
      }
      ListHeaderComponent={
        <View style={[styles.banner, { backgroundColor: mart.primary }]}>
          {photo ? <Image source={{ uri: photo }} style={styles.bannerPhoto} resizeMode="cover" /> : null}
          <View style={styles.bannerScrim} />
          <View style={styles.bannerCopy}>
            <Text style={styles.bannerName}>{categoryName}</Text>
            <Text style={styles.bannerMeta}>
              {itemCountLabel(count)} on the shelf
            </Text>
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
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: tint(mart.primary, 0.08) }]}>
            <Ionicons name="basket-outline" size={26} color={mart.primary} />
          </View>
          <Text style={styles.emptyTitle}>This aisle is being restocked</Text>
          <Text style={styles.emptyBody}>Check another aisle, or search for a product by name.</Text>
          <Pressable
            onPress={() => navigation.navigate('Search')}
            style={[styles.retry, { backgroundColor: mart.primary }]}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Search the shop</Text>
          </Pressable>
        </View>
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {catalog.isFetchingNextPage ? (
            <SkeletonScope label="Loading more from this aisle">
              <ProductGridSkeleton count={2} />
            </SkeletonScope>
          ) : catalog.items.length > 0 && !catalog.hasNextPage ? (
            <Text style={styles.endText}>End of the aisle.</Text>
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
    paddingBottom: SPACE.xxxl,
  },
  banner: {
    height: 168,
    marginBottom: SPACE.md,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bannerPhoto: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9,14,11,0.66)',
  },
  bannerCopy: {
    paddingHorizontal: GUTTER,
    paddingBottom: SPACE.lg,
  },
  bannerName: {
    ...TYPE.display,
    color: ON_BRAND.primary,
  },
  bannerMeta: {
    ...TYPE.label,
    marginTop: SPACE.xs,
    color: ON_BRAND.secondary,
  },
  itemWrapper: {
    width: '50%',
    padding: SPACE.xs,
    paddingHorizontal: SPACE.sm,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACE.xl,
    backgroundColor: MART.paper,
    gap: SPACE.sm,
  },
  error: {
    ...TYPE.body,
    color: MART.danger,
    textAlign: 'center',
  },
  retry: {
    marginTop: SPACE.md,
    minHeight: 46,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    ...TYPE.label,
    fontWeight: '700',
    color: ON_BRAND.primary,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: SPACE.xxl,
    paddingTop: SPACE.xxl,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...TYPE.title,
    marginTop: SPACE.lg,
    color: MART.ink,
    textAlign: 'center',
  },
  emptyBody: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: MART.inkMuted,
    textAlign: 'center',
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
