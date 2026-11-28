import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { stepFeel } from '../lib/haptics';
import { ELEVATION, FONT, GUTTER, MART, onFill, RADIUS, SPACE, SPRING } from '../theme/mart';
import type { MainTabParamList } from './types';

type TabName = keyof MainTabParamList;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const BAR = 64;
const INSET = 5;
/** Height the bar takes above the bottom safe area. Floating things sit clear of this. */
export const TAB_BAR_BODY = BAR + SPACE.sm;

const MARK: Record<TabName, { label: string; rest: IconName; live: IconName }> = {
  Home: { label: 'Home', rest: 'home-outline', live: 'home' },
  Search: { label: 'Search', rest: 'search-outline', live: 'search' },
  Cart: { label: 'Basket', rest: 'basket-outline', live: 'basket' },
  Account: { label: 'Account', rest: 'person-outline', live: 'person' },
};

/**
 * One capsule holding the four places. The place you are in is a filled lobe in the shop's colour, and
 * it slides to the next place when you move.
 */
export function MartTabBar({
  state,
  descriptors,
  navigation,
  primary,
  accent,
}: BottomTabBarProps & { primary: string; accent: string }) {
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const slot = width > 0 ? (width - INSET * 2) / state.routes.length : 0;
  const at = useSharedValue(state.index);
  const on = onFill(primary);
  const onAccent = onFill(accent);

  useEffect(() => {
    at.value = withSpring(state.index, SPRING);
  }, [at, state.index]);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: at.value * slot }],
  }));

  return (
    <View style={[styles.strip, { paddingBottom: Math.max(insets.bottom, SPACE.sm) }]}>
      <View
        style={styles.bar}
        accessibilityRole="tablist"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width - 3)}
      >
        {slot > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.here, { width: slot, backgroundColor: primary }, slide]}
          />
        ) : null}
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const mark = MARK[route.name as TabName];
          const badge = options.tabBarBadge;
          const color = focused ? on.primary : MART.ink;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? mark.label}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!event.defaultPrevented) {
                  if (!focused) stepFeel();
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => {
                navigation.emit({ type: 'tabLongPress', target: route.key });
              }}
              style={styles.slot}
            >
              <View>
                <Ionicons name={focused ? mark.live : mark.rest} size={22} color={color} />
                {typeof badge === 'number' && badge > 0 ? (
                  <View style={[styles.badge, { backgroundColor: accent }]} pointerEvents="none">
                    <Text style={[styles.badgeText, { color: onAccent.primary }]}>
                      {badge > 99 ? '99+' : String(badge)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.caption, { color }]} numberOfLines={1}>
                {mark.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    paddingTop: SPACE.sm,
    paddingHorizontal: GUTTER,
    backgroundColor: MART.paper,
  },
  bar: {
    height: BAR,
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: INSET - 1.5,
    borderRadius: RADIUS.pill,
    ...ELEVATION.lifted,
  },
  here: {
    position: 'absolute',
    top: INSET - 1.5,
    bottom: INSET - 1.5,
    left: INSET - 1.5,
    borderRadius: RADIUS.pill,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  caption: {
    fontFamily: FONT.semibold,
    fontSize: 11,
    lineHeight: 14,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FONT.bold,
    fontSize: 10,
    lineHeight: 13,
  },
});
