import React, { createContext, useContext, useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import { GUTTER, MART, RADIUS, SPACE } from '../theme/mart';

const Pulse = createContext(new Animated.Value(1));

export function SkeletonScope({
  children,
  label,
  style,
}: {
  children: React.ReactNode;
  label: string;
  style?: ViewStyle;
}) {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    const start = () => {
      loop?.stop();
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 720, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.48, duration: 720, useNativeDriver: true }),
        ])
      );
      loop.start();
    };

    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) {
        pulse.setValue(1);
        return;
      }
      start();
    });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduce) => {
      if (reduce) {
        loop?.stop();
        pulse.setValue(1);
        return;
      }
      start();
    });

    return () => {
      loop?.stop();
      sub.remove();
    };
  }, [pulse]);

  return (
    <Pulse.Provider value={pulse}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        style={style}
      >
        {children}
      </View>
    </Pulse.Provider>
  );
}

export function Bone({
  w,
  h,
  r = MART.radius,
  style,
}: {
  w?: DimensionValue;
  h: number;
  r?: number;
  style?: ViewStyle;
}) {
  const pulse = useContext(Pulse);
  return (
    <Animated.View
      style={[
        {
          width: w ?? '100%',
          height: h,
          borderRadius: r,
          backgroundColor: MART.paperSunken,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

export function ProductCardSkeleton() {
  const pulse = useContext(Pulse);
  return (
    <View style={styles.productCard}>
      <Animated.View style={[styles.productImage, { opacity: pulse }]} />
      <View style={styles.productCopy}>
        <Bone h={12} w="88%" />
        <Bone h={12} w="62%" />
        <Bone h={16} w={84} />
      </View>
    </View>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.gridCell}>
          <ProductCardSkeleton />
        </View>
      ))}
    </View>
  );
}

export function StorefrontBodySkeleton() {
  return (
    <SkeletonScope label="Loading the store" style={styles.storefront}>
      <Bone h={212} r={RADIUS.xl} style={styles.hero} />
      <View style={styles.sectionHead}>
        <Bone h={24} w={150} />
      </View>
      <View style={styles.aisleRow}>
        <Bone h={92} w={92} r={46} />
        <Bone h={92} w={92} r={46} />
        <Bone h={92} w={92} r={46} />
        <Bone h={92} w={92} r={46} />
      </View>
      <View style={styles.sectionHead}>
        <Bone h={24} w={180} />
      </View>
      <ProductGridSkeleton count={4} />
    </SkeletonScope>
  );
}

export function AisleBodySkeleton() {
  return (
    <SkeletonScope label="Loading this aisle" style={styles.aisleBody}>
      <View style={styles.aislePad}>
        <ProductGridSkeleton count={6} />
      </View>
    </SkeletonScope>
  );
}

export function ProductDetailSkeleton() {
  return (
    <SkeletonScope label="Loading product" style={styles.detail}>
      <Bone h={320} r={0} />
      <View style={styles.detailCopy}>
        <Bone h={22} w="78%" />
        <Bone h={18} w={96} style={{ marginTop: 12 }} />
        <Bone h={12} w="100%" style={{ marginTop: 28 }} />
        <Bone h={12} w="92%" style={{ marginTop: 8 }} />
        <Bone h={12} w="64%" style={{ marginTop: 8 }} />
      </View>
    </SkeletonScope>
  );
}

export function CartLinesSkeleton() {
  return (
    <SkeletonScope label="Loading your basket" style={styles.cart}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.cartLine}>
          <Bone h={64} w={64} />
          <View style={styles.cartCopy}>
            <Bone h={14} w="80%" />
            <Bone h={12} w="46%" style={{ marginTop: 8 }} />
          </View>
          <Bone h={14} w={52} />
        </View>
      ))}
    </SkeletonScope>
  );
}

export function AccountHubSkeleton() {
  return (
    <SkeletonScope label="Loading your store card" style={styles.hub}>
      <Bone h={28} w="52%" />
      <Bone h={14} w="70%" style={{ marginTop: 8 }} />
      <Bone h={168} r={12} style={{ marginTop: 18 }} />
      <View style={styles.hubQuick}>
        <Bone h={48} w="31%" />
        <Bone h={48} w="31%" />
        <Bone h={48} w="31%" />
      </View>
      <Bone h={16} w={120} style={{ marginTop: 28 }} />
      <Bone h={64} style={{ marginTop: 10 }} />
      <Bone h={64} style={{ marginTop: 8 }} />
    </SkeletonScope>
  );
}

const styles = StyleSheet.create({
  storefront: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  hero: {
    marginHorizontal: GUTTER,
  },
  sectionHead: {
    marginTop: SPACE.xxl,
    marginBottom: SPACE.md,
    paddingHorizontal: GUTTER,
  },
  aisleRow: {
    paddingHorizontal: GUTTER,
    flexDirection: 'row',
    gap: SPACE.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GUTTER - SPACE.xs,
  },
  gridCell: {
    width: '33.333%',
    padding: SPACE.xs,
  },
  productCard: {},
  productImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperSunken,
  },
  productCopy: {
    paddingHorizontal: SPACE.xs,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.md,
    gap: SPACE.sm,
  },
  aisleBody: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  aislePad: {
    paddingTop: 8,
  },
  detail: {
    flex: 1,
    backgroundColor: MART.paperElevated,
  },
  detailCopy: {
    padding: 16,
  },
  cart: {
    padding: 16,
    gap: 12,
  },
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  cartCopy: {
    flex: 1,
  },
  hub: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  hubQuick: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
