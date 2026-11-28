import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useTenant } from '../lib/TenantContext';
import { useProduct } from '../hooks/useProduct';
import { useCart } from '../hooks/useCart';
import { Capsule } from '../components/Capsule';
import { Coast } from '../components/Coast';
import { ProductDetailSkeleton } from '../components/Skeleton';
import { StateBlock } from '../components/StateBlock';
import { landFeel, stepFeel } from '../lib/haptics';
import { formatMoney } from '../lib/media';
import {
  GUTTER,
  MART,
  martFromTenant,
  onFill,
  RADIUS,
  SPACE,
  TILE,
  TYPE,
  ZONE,
  zoneFor,
} from '../theme/mart';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetail'>;

export function ProductDetailScreen({ route, navigation }: Props) {
  const { itemId } = route.params;
  const tenant = useTenant();
  const insets = useSafeAreaInsets();
  const mart = martFromTenant(tenant);
  const { data: product, isLoading, error, refetch } = useProduct(tenant.slug, itemId);
  const { addToBasket, refused } = useCart(tenant.slug);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>();
  const [added, setAdded] = useState(false);
  const { width } = useWindowDimensions();
  // The product stands on its section's colour. A product that names no section stands on sun yellow.
  const categoryId = (product as { categoryId?: string | null } | undefined)?.categoryId;
  const zone = categoryId ? zoneFor(categoryId) : ZONE.sun;
  const zoneInk = onFill(zone).primary;

  useLayoutEffect(() => {
    navigation.setOptions({ headerStyle: { backgroundColor: zone }, headerTintColor: zoneInk });
  }, [navigation, zone, zoneInk]);

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
      <View style={styles.shell}>
        <StateBlock
          tone="problem"
          icon="pricetag"
          title="We could not open this product"
          body="It may have sold out, or the shop may have stopped selling it."
          actionLabel="Try again"
          actionChip="refresh"
          onAction={() => void refetch()}
          fill={mart.primary}
        />
      </View>
    );
  }

  const variants = product.variants ?? [];
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const price = selectedVariant?.price ?? product.price ?? 0;
  const total = price * quantity;
  const currency = product.currency ?? 'KES';
  const name = product.name ?? 'Product';
  const image = selectedVariant?.imageUrl ?? product.images?.[0]?.url;
  const effectiveItemId = selectedVariantId ?? itemId;
  // What the shop said when it would not take this item, once the basket has told it.
  const refusal = refused[effectiveItemId];

  function handleAddToCart() {
    addToBasket(
      {
        itemId: effectiveItemId,
        name,
        variantName: selectedVariant?.variantName ?? selectedVariant?.name ?? product?.variantName ?? null,
        imageUrl: image ?? null,
        unitPrice: price,
      },
      quantity,
    );
    landFeel();
    setAdded(true);
  }

  const tileSize = width - GUTTER * 2;
  const on = mart.onPrimary;

  return (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.landAbove, { backgroundColor: zone }]} />
        <Coast color={zone} height={Math.round(tileSize * 0.56)} />
        <View style={[styles.imageWell, { width: tileSize, height: tileSize }]}>
          {image ? (
            <Image
              source={{ uri: image }}
              style={styles.image}
              contentFit="contain"
              transition={180}
              accessibilityLabel={name}
            />
          ) : (
            <Text style={styles.imageLetter}>{name.slice(0, 1).toUpperCase()}</Text>
          )}
        </View>

        <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.name}>
            {name}
          </Text>
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
                      onPress={() => {
                        stepFeel();
                        setSelectedVariantId(variant.id);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={variant.name ?? 'Option'}
                      style={({ pressed }) => [
                        styles.variantChip,
                        selected && { backgroundColor: mart.primary, borderColor: mart.primary },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.variantChipText, selected && { color: on.primary }]}>
                        {variant.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {product.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this product</Text>
              <View style={styles.descriptionTile}>
                <Text style={styles.description}>{product.description}</Text>
              </View>
            </View>
          ) : null}

          {refusal ? (
            <View style={styles.addError}>
              <Ionicons name="alert-circle" size={20} color={MART.danger} />
              <Text accessibilityLiveRegion="polite" style={styles.addErrorText}>
                {refusal}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACE.md) }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatMoney(currency, total)}</Text>
        </View>
        <View style={styles.actions}>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => {
                stepFeel();
                setQuantity((q) => Math.max(1, q - 1));
              }}
              disabled={quantity <= 1}
              accessibilityRole="button"
              accessibilityLabel="One fewer"
              style={({ pressed }) => [
                styles.stepBtn,
                quantity <= 1 && styles.stepBtnDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="remove" size={22} color={MART.ink} />
            </Pressable>
            <Text style={styles.stepValue} accessibilityLiveRegion="polite">
              {quantity}
            </Text>
            <Pressable
              onPress={() => {
                stepFeel();
                setQuantity((q) => q + 1);
              }}
              accessibilityRole="button"
              accessibilityLabel="One more"
              style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={22} color={MART.ink} />
            </Pressable>
          </View>
          <Capsule
            label={added ? 'In your basket' : 'Add to basket'}
            chip={added ? 'checkmark' : 'add'}
            live={added}
            fill={mart.primary}
            onPress={handleAddToCart}
            style={styles.add}
          />
        </View>
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
  /** Pulling down shows more land, not the water behind it. */
  landAbove: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -800,
    height: 800,
  },
  imageWell: {
    alignSelf: 'center',
    marginTop: SPACE.xs,
    borderRadius: RADIUS.xl,
    backgroundColor: MART.paperElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '80%',
    height: '80%',
  },
  imageLetter: {
    ...TYPE.display,
    fontSize: 96,
    lineHeight: 104,
    color: MART.paperSunken,
  },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.xl,
  },
  name: {
    ...TYPE.title,
    color: MART.ink,
  },
  variantName: {
    ...TYPE.body,
    marginTop: SPACE.xs,
    color: MART.inkMuted,
  },
  price: {
    ...TYPE.price,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
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
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: MART.ink,
  },
  variantChipText: {
    ...TYPE.label,
    color: MART.ink,
  },
  pressed: {
    opacity: 0.6,
  },
  descriptionTile: {
    ...TILE,
  },
  description: {
    ...TYPE.body,
    color: MART.ink,
  },
  addError: {
    flexDirection: 'row',
    gap: SPACE.sm,
    marginTop: SPACE.xl,
    padding: SPACE.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.dangerSurface,
  },
  addErrorText: {
    ...TYPE.label,
    flex: 1,
    color: MART.danger,
  },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: MART.border,
    backgroundColor: MART.paper,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: SPACE.md,
    paddingHorizontal: SPACE.xs,
  },
  totalLabel: {
    ...TYPE.label,
    color: MART.inkMuted,
  },
  totalValue: {
    ...TYPE.price,
    color: MART.ink,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  stepper: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paperElevated,
  },
  stepBtn: {
    width: 46,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.3,
  },
  stepValue: {
    ...TYPE.heading,
    minWidth: 28,
    textAlign: 'center',
    color: MART.ink,
  },
  add: {
    flex: 1,
  },
});
