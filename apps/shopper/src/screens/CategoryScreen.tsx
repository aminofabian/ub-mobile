import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@kiosk/ui';
import { phase_15_storefront_public } from '@kiosk/types';
import { useTenant } from '../lib/TenantContext';
import { useItems } from '../hooks/useItems';
import { ProductCard } from '../components/ProductCard';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Category'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Item = phase_15_storefront_public.components['schemas']['PublicCatalogItemCard'];

export function CategoryScreen() {
  const tenant = useTenant();
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<NavigationProp>();
  const { categoryId, categoryName } = route.params;

  const { data, isLoading, error, refetch } = useItems(tenant.slug, {
    categoryId,
    limit: 50,
  });

  const items = data?.items ?? [];

  const handleItemPress = useCallback(
    (item: Item) => {
      if (item.id) {
        navigation.navigate('ProductDetail', { itemId: item.id });
      }
    },
    [navigation]
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#28a745" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text variant="body" style={styles.error}>
          Failed to load products. Pull down to retry.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id ?? item.name ?? ''}
      numColumns={2}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text variant="h1">{categoryName}</Text>
          <Text variant="muted">{items.length} products</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.itemWrapper}>
          <ProductCard
            item={item}
            currency={data?.currency}
            onPress={handleItemPress}
          />
        </View>
      )}
      ListEmptyComponent={
        <Text variant="muted" style={styles.emptyText}>
          No products in this category.
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    padding: 16,
    paddingTop: 24,
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 32,
  },
  itemWrapper: {
    width: '50%',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
  },
  error: {
    color: '#dc3545',
    textAlign: 'center',
  },
});
