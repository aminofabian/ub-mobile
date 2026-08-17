import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '@kiosk/ui';
import { phase_15_storefront_public } from '@kiosk/types';
import { useTenant } from '../lib/TenantContext';
import { useStorefront } from '../hooks/useStorefront';
import { useCategories } from '../hooks/useCategories';
import { useItems } from '../hooks/useItems';
import { CategoryRail } from '../components/CategoryRail';
import { ProductGrid } from '../components/ProductGrid';
import { RootStackParamList } from '../navigation/AppNavigator';

type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];
type Category = phase_15_storefront_public.components['schemas']['PublicCategoryResponse'];
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<NavigationProp>();
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
    data: itemsData,
    isLoading: itemsLoading,
    error: itemsError,
    refetch: refetchItems,
  } = useItems(tenant.slug, { limit: 20 });

  const isLoading = storefrontLoading || categoriesLoading || itemsLoading;
  const error = storefrontError || categoriesError || itemsError;

  function handleRefresh() {
    refetchStorefront();
    refetchCategories();
    refetchItems();
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
    >
      <View style={styles.header}>
        <Text variant="h1">{storefront?.businessName ?? tenant.displayName}</Text>
        {storefront?.announcement ? (
          <Text variant="body" style={styles.announcement}>
            {storefront.announcement}
          </Text>
        ) : null}
      </View>

      <TextInput
        style={styles.searchBar}
        placeholder="Search products..."
        editable={false}
        onTouchStart={() => navigation.navigate('Search')}
        accessibilityLabel="Search products"
      />

      {isLoading && !storefront && !categories && !itemsData ? (
        <ActivityIndicator size="large" color="#28a745" style={styles.loader} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text variant="body" style={styles.errorText}>
            Failed to load store. Pull down to retry.
          </Text>
        </View>
      ) : (
        <>
          {categories?.categories && categories.categories.length > 0 && (
            <CategoryRail categories={categories.categories} onSelect={handleCategorySelect} />
          )}

          {storefront?.featured && storefront.featured.length > 0 && (
            <ProductGrid
              title="Featured"
              items={storefront.featured}
              currency={storefront.currency}
              onItemPress={handleItemPress}
            />
          )}

          {itemsData?.items && itemsData.items.length > 0 && (
            <ProductGrid
              title="Browse"
              items={itemsData.items}
              currency={itemsData.currency ?? storefront?.currency}
              onItemPress={handleItemPress}
            />
          )}

          {!itemsData?.items?.length && !storefront?.featured?.length && (
            <Text variant="muted" style={styles.emptyText}>
              No products available right now.
            </Text>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingBottom: 32,
  },
  header: {
    padding: 16,
    paddingTop: 24,
  },
  announcement: {
    marginTop: 8,
    color: '#28a745',
  },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
    backgroundColor: '#f8f9fa',
  },
  loader: {
    marginTop: 48,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
  },
  errorText: {
    color: '#dc3545',
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
  },
});
