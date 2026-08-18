import { CompositeNavigationProp, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { phase_15_storefront_public } from '@kiosk/types';
import { useTenant } from '../lib/TenantContext';
import { useStorefront } from '../hooks/useStorefront';
import { useCategories } from '../hooks/useCategories';
import { useCatalogTypes } from '../hooks/useCatalogTypes';
import { useItems } from '../hooks/useItems';
import { useCart } from '../hooks/useCart';
import { useAirtimeConfig } from '../hooks/useAirtimeConfig';
import { AislePhotoRail } from '../components/AislePhotoRail';
import { MartHero } from '../components/MartHero';
import { AisleDealsBar, MartHomeHeader, MartSearchField } from '../components/MartChrome';
import { ProductGrid } from '../components/ProductGrid';
import { TypeRail } from '../components/TypeRail';
import { MART, martFromTenant } from '../theme/mart';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];
type Category = phase_15_storefront_public.components['schemas']['PublicCategoryResponse'];
type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function HomeScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const catalogY = useRef(0);
  const scrollRef = useRef<ScrollView>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [dealsOnly, setDealsOnly] = useState(false);

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
  const {
    data: itemsData,
    isLoading: itemsLoading,
    error: itemsError,
    refetch: refetchItems,
  } = useItems(tenant.slug, {
    limit: 40,
    typeId: selectedTypeId ?? undefined,
  });
  const { itemCount } = useCart(tenant.slug);
  const { data: airtime } = useAirtimeConfig(tenant.slug);

  const mart = useMemo(
    () =>
      martFromTenant(tenant, {
        announcement: storefront?.announcement,
        businessName: storefront?.businessName,
      }),
    [tenant, storefront?.announcement, storefront?.businessName]
  );

  const isLoading = storefrontLoading || categoriesLoading || itemsLoading || typesLoading;
  const error = storefrontError || categoriesError || itemsError;
  const types = typesData?.types?.filter((t) => t.label?.trim()) ?? [];
  const catalogItems = dealsOnly
    ? (storefront?.featured ?? []).filter((item) => Boolean(item.id))
    : (itemsData?.items ?? []);
  const currency = itemsData?.currency ?? storefront?.currency ?? 'KES';

  function handleRefresh() {
    refetchStorefront();
    refetchCategories();
    refetchItems();
    refetchTypes();
  }

  function handleCategorySelect(category: Category) {
    if (category.id) {
      navigation.navigate('Category', {
        categoryId: category.id,
        categoryName: category.name ?? 'Category',
      });
    }
  }

  function handleItemPress(item: Item) {
    if (item.id) {
      navigation.navigate('ProductDetail', { itemId: item.id });
    }
  }

  function scrollToCatalog() {
    scrollRef.current?.scrollTo({ y: Math.max(catalogY.current - 12, 0), animated: true });
  }

  return (
    <View style={[styles.shell, { paddingTop: insets.top }]}>
      <MartHomeHeader
        mart={mart}
        cartCount={itemCount}
        onCart={() => navigation.navigate('Cart')}
        onAccount={() => navigation.navigate('Account')}
      />
      <MartSearchField primary={mart.primary} onPress={() => navigation.navigate('Search')} />
      <AisleDealsBar
        primary={mart.primary}
        categories={categories?.categories ?? []}
        onSelectCategory={handleCategorySelect}
        onDeals={() => {
          setDealsOnly(true);
          setSelectedTypeId(null);
          requestAnimationFrame(scrollToCatalog);
        }}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && Boolean(storefront || itemsData)}
            onRefresh={handleRefresh}
            tintColor={mart.primary}
          />
        }
      >
        <MartHero mart={mart} onShopNow={scrollToCatalog} />

        {isLoading && !storefront && !categories && !itemsData ? (
          <ActivityIndicator size="large" color={mart.primary} style={styles.loader} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Couldn’t load the store. Pull down to retry.</Text>
          </View>
        ) : (
          <>
            {types.length > 0 ? (
              <View style={styles.section}>
                <TypeRail
                  types={types}
                  primary={mart.primary}
                  selectedId={selectedTypeId}
                  onSelect={(type) => {
                    setDealsOnly(false);
                    setSelectedTypeId((current) => (current === type.id ? null : type.id));
                  }}
                />
              </View>
            ) : null}

            {(categories?.categories?.length ?? 0) > 0 ? (
              <View style={styles.section}>
                <AislePhotoRail
                  categories={categories?.categories ?? []}
                  primary={mart.primary}
                  accent={mart.accent}
                  onSelect={handleCategorySelect}
                />
              </View>
            ) : null}

            <View
              onLayout={(event) => {
                catalogY.current = event.nativeEvent.layout.y;
              }}
            >
              {catalogItems.length > 0 ? (
                <ProductGrid
                  title={dealsOnly ? 'Deals' : selectedTypeId ? 'In this aisle' : 'Featured'}
                  items={catalogItems}
                  currency={currency}
                  accent={mart.primary}
                  shownCount={catalogItems.length}
                  totalCount={
                    dealsOnly
                      ? catalogItems.length
                      : (itemsData as { totalCount?: number | null } | undefined)?.totalCount
                  }
                  onItemPress={handleItemPress}
                />
              ) : (
                <Text style={styles.emptyText}>No products available right now.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {airtime?.available ? (
        <Pressable
          onPress={() => {
            void Linking.openURL(`https://${tenant.host}/shop/airtime`);
          }}
          accessibilityRole="button"
          accessibilityLabel="Buy airtime"
          style={[styles.airtime, { bottom: 16 }]}
        >
          <View style={[styles.airtimeIcon, { backgroundColor: mart.accent }]}>
            <Ionicons name="cellular" size={16} color="#fff" />
          </View>
          <Text style={styles.airtimeLabel}>INSTANT Airtime</Text>
        </Pressable>
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
    paddingTop: 10,
    paddingBottom: 88,
  },
  section: {
    marginTop: 12,
  },
  loader: {
    marginTop: 48,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    color: '#b42318',
    textAlign: 'center',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    color: MART.inkQuiet,
  },
  airtime: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: MART.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  airtimeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  airtimeLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: MART.ink,
  },
});
