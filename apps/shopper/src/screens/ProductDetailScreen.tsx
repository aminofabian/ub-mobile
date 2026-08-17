import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Text } from '@kiosk/ui';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTenant } from '../lib/TenantContext';
import { useProduct } from '../hooks/useProduct';
import { useCart } from '../hooks/useCart';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

export function ProductDetailScreen({ route }: Props) {
  const { itemId } = route.params;
  const tenant = useTenant();
  const { data: product, isLoading, error } = useProduct(tenant.slug, itemId);
  const { addToCart } = useCart(tenant.slug);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>();

  const effectiveItemId = selectedVariantId ?? itemId;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#28a745" />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.centered}>
        <Text variant="body" style={styles.error}>
          Failed to load product details.
        </Text>
      </View>
    );
  }

  const price = product.price ?? 0;
  const total = price * quantity;
  const currency = product.currency ?? 'KES';

  function increment() {
    setQuantity((q) => q + 1);
  }

  function decrement() {
    setQuantity((q) => (q > 1 ? q - 1 : 1));
  }

  async function handleAddToCart() {
    addToCart.mutate({ itemId: effectiveItemId, quantity });
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Image
          source={{ uri: product.images?.[0]?.url }}
          style={styles.image}
          resizeMode="cover"
          accessibilityLabel={product.name ?? 'Product image'}
        />

        <View style={styles.content}>
          <Text variant="h1">{product.name}</Text>
          {product.variantName ? (
            <Text variant="muted">{product.variantName}</Text>
          ) : null}

          <Text style={styles.price}>
            {currency} {price.toFixed(2)}
          </Text>

          {product.variants && product.variants.length > 0 && (
            <View style={styles.section}>
              <Text variant="h2">Variants</Text>
              <View style={styles.variants}>
                {product.variants.map((variant) => (
                  <TouchableOpacity
                    key={variant.id}
                    style={[
                      styles.variantChip,
                      selectedVariantId === variant.id && styles.variantChipSelected,
                    ]}
                    onPress={() => setSelectedVariantId(variant.id)}
                    accessibilityRole="button"
                    accessibilityLabel={variant.name ?? 'Variant'}
                  >
                    <Text
                      style={
                        selectedVariantId === variant.id ? styles.variantTextSelected : undefined
                      }
                    >
                      {variant.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text variant="h2">Quantity</Text>
            <View style={styles.quantityRow}>
              <TouchableOpacity style={styles.quantityButton} onPress={decrement}>
                <Text style={styles.quantityButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.quantityValue}>{quantity}</Text>
              <TouchableOpacity style={styles.quantityButton} onPress={increment}>
                <Text style={styles.quantityButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {product.description ? (
            <View style={styles.section}>
              <Text variant="h2">Description</Text>
              <Text variant="body">{product.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerTotal}>
          <Text variant="muted">Total</Text>
          <Text style={styles.totalPrice}>
            {currency} {total.toFixed(2)}
          </Text>
        </View>
        <Button
          title={addToCart.isPending ? 'Adding...' : 'Add to Cart'}
          onPress={handleAddToCart}
          disabled={addToCart.isPending}
          style={styles.addButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 16,
  },
  price: {
    fontSize: 22,
    fontWeight: '700',
    color: '#28a745',
    marginTop: 8,
  },
  section: {
    marginTop: 24,
  },
  variants: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  variantChip: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  variantChipSelected: {
    backgroundColor: '#28a745',
    borderColor: '#28a745',
  },
  variantTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: '600',
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '600',
    marginHorizontal: 16,
    minWidth: 32,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerTotal: {
    flex: 1,
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: '700',
  },
  addButton: {
    marginLeft: 16,
    minWidth: 160,
  },
  error: {
    color: '#dc3545',
  },
});
