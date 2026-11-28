import { CompositeNavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTenant } from '../lib/TenantContext';
import { useCart } from '../hooks/useCart';
import { useSession } from '../hooks/useSession';
import { useAuthGate } from '../components/AuthGate';
import { Capsule } from '../components/Capsule';
import { CartLinesSkeleton } from '../components/Skeleton';
import { QuickAddButton } from '../components/QuickAddButton';
import { ScreenTitle } from '../components/ScreenTitle';
import { StateBlock } from '../components/StateBlock';
import { syncNote, totalText } from '../lib/basket-copy';
import { REQUIRE_SIGN_IN_TO_CHECKOUT } from '../lib/checkout-policy';
import { formatMoney } from '../lib/media';
import { FONT, GUTTER, MART, martFromTenant, RADIUS, SPACE, TILE, TYPE } from '../theme/mart';
import { MainTabParamList, RootStackParamList } from '../navigation/types';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Cart'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function CartScreen() {
  const tenant = useTenant();
  const navigation = useNavigation<NavigationProp>();
  const { lines, view, refused, refusedCount, isLoading, offline, retryNow, itemCount } = useCart(tenant.slug);
  const { signedIn } = useSession();
  const { openAuth } = useAuthGate();
  const mart = martFromTenant(tenant);
  const currency = view.currency;
  const note = syncNote({ waiting: view.waiting, offline, refused: refusedCount });
  const total = totalText(view, formatMoney);

  // Opening the basket is a good moment to tell the shop about it, if it has not heard.
  useFocusEffect(
    useCallback(() => {
      void retryNow();
    }, [retryNow]),
  );

  if (isLoading) {
    return (
      <View style={styles.shell}>
        <ScreenTitle title="Basket" />
        <CartLinesSkeleton />
      </View>
    );
  }

  if (lines.length === 0) {
    return (
      <View style={styles.shell}>
        <ScreenTitle title="Basket" />
        <StateBlock
          tone="empty"
          icon="basket"
          title="Your basket is empty"
          body="Add something from the shop and it will wait for you here."
          actionLabel="Start shopping"
          onAction={() => navigation.navigate('Home')}
          fill={mart.primary}
          style={styles.emptyBlock}
        />
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBleed}>
          <ScreenTitle
            title="Basket"
            hint={`${itemCount} ${itemCount === 1 ? 'item' : 'items'} from ${mart.displayName}`}
          />
        </View>
        <View style={styles.lines}>
          {lines.map((line, index) => {
            const refusal = refused[line.itemId];
            return (
              <View key={line.itemId} style={[styles.line, index > 0 && styles.lineRule]}>
                <View style={styles.thumbnail}>
                  {line.imageUrl ? (
                    <Image
                      source={{ uri: line.imageUrl }}
                      style={styles.thumbnailImage}
                      contentFit="contain"
                      transition={180}
                      accessible={false}
                    />
                  ) : (
                    <Text style={styles.thumbnailLetter}>{line.name.slice(0, 1).toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.lineBody}>
                  <View style={styles.lineHead}>
                    <View style={styles.lineHeadText}>
                      <Text numberOfLines={2} style={styles.name}>
                        {line.name}
                      </Text>
                      {line.unitPrice !== null ? (
                        <Text style={styles.unit}>{formatMoney(currency, line.unitPrice)} each</Text>
                      ) : null}
                    </View>
                    {line.lineTotal !== null ? (
                      <Text style={styles.lineTotal}>{formatMoney(currency, line.lineTotal)}</Text>
                    ) : null}
                  </View>
                  <View style={styles.stepperRow}>
                    <QuickAddButton
                      itemId={line.itemId}
                      name={line.name}
                      accent={mart.primary}
                      price={line.unitPrice}
                      imageUrl={line.imageUrl}
                      variantName={line.variantName}
                    />
                  </View>
                  {refusal ? (
                    <View style={styles.refusal}>
                      <Text accessibilityLiveRegion="polite" style={styles.refusalText}>
                        {refusal}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {note ? (
          <View accessibilityLiveRegion="polite" style={styles.note}>
            <Text style={styles.noteText}>{note}</Text>
            {offline ? (
              <Pressable
                onPress={() => void retryNow()}
                accessibilityRole="button"
                hitSlop={12}
                style={styles.retryHit}
              >
                <Text style={styles.retry}>Try again now</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{view.isEstimate && total ? 'Subtotal (estimate)' : 'Subtotal'}</Text>
          <Text
            style={total ? styles.totalValue : styles.totalPending}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {total ?? 'Confirmed at checkout'}
          </Text>
        </View>
        <Capsule
          label="Checkout"
          chip="arrow-forward"
          fill={mart.primary}
          onPress={() => {
            void (async () => {
              if (!signedIn && REQUIRE_SIGN_IN_TO_CHECKOUT) {
                const ok = await openAuth('checkout');
                if (!ok) return;
              }
              navigation.navigate('Checkout');
            })();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: MART.paper,
  },
  emptyBlock: {
    paddingTop: SPACE.lg,
  },
  content: {
    paddingHorizontal: GUTTER,
    paddingBottom: SPACE.xxl,
  },
  /** The title carries its own gutter, so it steps back out of the list's. */
  titleBleed: {
    marginHorizontal: -GUTTER,
  },
  lines: {
    ...TILE,
    paddingVertical: SPACE.xs,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingVertical: SPACE.md,
  },
  lineRule: {
    borderTopWidth: 1,
    borderTopColor: MART.border,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.paper,
    borderWidth: 1,
    borderColor: MART.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: 52,
    height: 52,
  },
  thumbnailLetter: {
    ...TYPE.title,
    color: MART.inkQuiet,
  },
  lineBody: {
    flex: 1,
    minWidth: 0,
    gap: SPACE.sm,
  },
  lineHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACE.md,
  },
  lineHeadText: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...TYPE.label,
    color: MART.ink,
  },
  unit: {
    ...TYPE.meta,
    marginTop: SPACE.xxs,
    color: MART.inkQuiet,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: SPACE.md,
  },
  lineTotal: {
    ...TYPE.price,
    color: MART.ink,
  },
  refusal: {
    marginTop: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    backgroundColor: MART.dangerSurface,
  },
  refusalText: {
    ...TYPE.meta,
    color: MART.danger,
  },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: SPACE.md,
    paddingBottom: SPACE.sm,
    gap: SPACE.md,
    backgroundColor: MART.paper,
  },
  note: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.infoSurface,
  },
  noteText: {
    ...TYPE.meta,
    color: MART.ink,
  },
  retryHit: {
    alignSelf: 'flex-start',
    minHeight: 32,
    justifyContent: 'center',
  },
  retry: {
    ...TYPE.label,
    color: MART.ink,
    textDecorationLine: 'underline',
  },
  totalRow: {
    gap: SPACE.xxs,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.lg,
    backgroundColor: MART.paperElevated,
    borderWidth: 1,
    borderColor: MART.border,
  },
  totalLabel: {
    ...TYPE.meta,
    fontFamily: FONT.medium,
    color: MART.inkQuiet,
  },
  totalValue: {
    ...TYPE.display,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -1,
    color: MART.ink,
  },
  totalPending: {
    ...TYPE.label,
    color: MART.ink,
  },
});
