import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTenant } from '../lib/TenantContext';
import { useProduct } from '../hooks/useProduct';
import { useCart } from '../hooks/useCart';
import { ProductDetailSkeleton } from '../components/Skeleton';
import { formatMoney } from '../lib/media';
import {
  ELEVATION,
  GUTTER,
  MART,
  martFromTenant,
  ON_BRAND,
  RADIUS,
  SPACE,
  TYPE,
} from '../theme/mart';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

export function ProductDetailScreen({ route }: Props) {
  const { itemId } = route.params;
  const tenant = useTenant();
  const insets = useSafeAreaInsets();
  const mart = martFromTenant(tenant);
  const { data: product, isLoading, error, refetch } = useProduct(tenant.slug, itemId);
  const { addToCart } = useCart(tenant.slug);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1800);
    return () => clearTimeout(timer);
  }, [added]);

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (error || !product) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>We could not open this product</Text>
        <Text style={styles.errorBody}>It may have sold out or moved off the shelf.</Text>
        <Pressable
          onPress={() => void refetch()}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primary,
            styles.retry,
            { backgroundColor: mart.primary },
            pressed && styles.primaryPressed,
          ]}
        >
          <Text style={styles.primaryLabel}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const price = product.price ?? 0;
  const total = price * quantity;
  const currency = product.currency ?? 'KES';
  const name = product.name ?? 'Product';
  const image = product.images?.[0]?.url;
  const variants = product.variants ?? [];
  const effectiveItemId = selectedVariantId ?? itemId;

  function handleAddToCart() {
    addToCart.mutate(
      { itemId: effectiveItemId, quantity },
      { onSuccess: () => setAdded(true) }
    );
  }

  return (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageWell}>
          {image ? (
            <Image
              source={{ uri: image }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={name}
            />
          ) : (
            <Text style={styles.imageLetter}>{name.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.name}>{name}</Text>
          {product.variantName ? (
            <Text style={styles.variantName}>{product.variantName}</Text>
          ) : null}
          <Text style={styles.price}>{formatMoney(currency, price)}</Text>

          {variants.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose an option</Text>
              <View style={styles.variants}>
                {variants.map((variant) => {
                  const selected = selectedVariantId === variant.id;
                  return (
                    <Pressable
                      key={variant.id}
                      onPress={() => setSelectedVariantId(variant.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={variant.name ?? 'Option'}
                      style={[
                        styles.variantChip,
                        selected && { backgroundColor: mart.primary, borderColor: mart.primary },
                      ]}
                    >
                      <Text style={[styles.variantChipText, selected && styles.variantChipTextOn]}>
                        {variant.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How many?</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                accessibilityRole="button"
                accessibilityLabel="One fewer"
                style={({ pressed }) => [
                  styles.stepBtn,
                  quantity <= 1 && styles.stepBtnDisabled,
                  pressed && styles.stepBtnPressed,
                ]}
              >
                <Ionicons name="remove" size={20} color={MART.ink} />
              </Pressable>
              <Text style={styles.stepValue} accessibilityLiveRegion="polite">
                {quantity}
              </Text>
              <Pressable
                onPress={() => setQuantity((q) => q + 1)}
                accessibilityRole="button"
                accessibilityLabel="One more"
                style={({ pressed }) => [styles.stepBtn, pressed && styles.stepBtnPressed]}
              >
                <Ionicons name="add" size={20} color={MART.ink} />
              </Pressable>
            </View>
          </View>

          {product.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this product</Text>
              <Text style={styles.description}>{product.description}</Text>
            </View>
          ) : null}

          {addToCart.isError ? (
            <Text accessibilityLiveRegion="polite" style={styles.addError}>
              That did not reach the basket. Check your connection and try again.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: SPACE.lg + insets.bottom }]}>
        <View style={styles.totalBlock}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatMoney(currency, total)}</Text>
        </View>
        <Pressable
          onPress={handleAddToCart}
          disabled={addToCart.isPending}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: added ? MART.success : mart.primary },
            addToCart.isPending && styles.primaryBusy,
            pressed && styles.primaryPressed,
          ]}
        >
          {added ? <Ionicons name="checkmark" size={18} color={ON_BRAND.primary} /> : null}
          <Text style={styles.primaryLabel}>
            {addToCart.isPending ? 'Adding…' : added ? 'In your basket' : 'Add to basket'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  scrollContent: {
    paddingBottom: SPACE.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
    backgroundColor: MART.paper,
  },
  errorTitle: {
    ...TYPE.title,
    color: MART.ink,
  },
  errorBody: {
    ...TYPE.body,
    marginTop: SPACE.sm,
    color: MART.inkMuted,
  },
  retry: {
    alignSelf: 'flex-start',
    marginTop: SPACE.xl,
  },
  imageWell: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: MART.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '82%',
    height: '82%',
  },
  imageLetter: {
    ...TYPE.display,
    fontSize: 64,
    lineHeight: 72,
    color: MART.inkQuiet,
  },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xl,
  },
  name: {
    ...TYPE.display,
    color: MART.ink,
  },
  variantName: {
    ...TYPE.body,
    marginTop: SPACE.xs,
    color: MART.inkMuted,
  },
  price: {
    ...TYPE.title,
    marginTop: SPACE.md,
    color: MART.ink,
  },
  section: {
    marginTop: SPACE.xxl,
  },
  sectionTitle: {
    ...TYPE.heading,
    marginBottom: SPACE.md,
    color: MART.ink,
  },
  variants: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
  },
  variantChip: {
    minHeight: 44,
    paddingHorizontal: SPACE.lg,
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
  },
  variantChipText: {
    ...TYPE.label,
    color: MART.ink,
  },
  variantChipTextOn: {
    color: ON_BRAND.primary,
  },
  stepper: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    ...ELEVATION.ruled,
  },
  stepBtn: {
    width: 52,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.3,
  },
  stepBtnPressed: {
    backgroundColor: MART.paperSunken,
  },
  stepValue: {
    ...TYPE.heading,
    minWidth: 44,
    textAlign: 'center',
    color: MART.ink,
    fontVariant: ['tabular-nums'],
  },
  description: {
    ...TYPE.body,
    color: MART.inkMuted,
  },
  addError: {
    ...TYPE.meta,
    marginTop: SPACE.xl,
    color: MART.danger,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.lg,
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.lg,
    borderTopWidth: 1,
    borderTopColor: MART.border,
    backgroundColor: MART.paperElevated,
  },
  totalBlock: {
    minWidth: 0,
  },
  totalLabel: {
    ...TYPE.meta,
    color: MART.inkMuted,
  },
  totalValue: {
    ...TYPE.title,
    marginTop: SPACE.xxs,
    color: MART.ink,
  },
  primary: {
    minHeight: 50,
    paddingHorizontal: SPACE.xl,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
  },
  primaryBusy: {
    opacity: 0.7,
  },
  primaryPressed: {
    opacity: 0.9,
  },
  primaryLabel: {
    ...TYPE.heading,
    color: ON_BRAND.primary,
  },
});
