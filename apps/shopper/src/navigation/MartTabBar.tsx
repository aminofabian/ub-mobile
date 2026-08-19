import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MART, ON_BRAND, RADIUS, SPACE, TYPE } from '../theme/mart';
import type { MainTabParamList } from './types';

type TabName = keyof MainTabParamList;

export const TAB_BAR_BODY = 62;

/**
 * Grocery-world marks, not the same four outlines every retail app ships.
 * Aisles is a shelf grid, Find is a barcode, Basket is a crate, Pass is the
 * store card you flash at the till.
 */
const MARK: Record<
  TabName,
  { label: string; glyph: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  Home: { label: 'Aisles', glyph: 'grid' },
  Search: { label: 'Find', glyph: 'barcode' },
  Cart: { label: 'Basket', glyph: 'file-tray' },
  Account: { label: 'Pass', glyph: 'id-card' },
};

export function MartTabBar({ state, descriptors, navigation, primary }: BottomTabBarProps & { primary: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.shelf, { paddingBottom: Math.max(insets.bottom, SPACE.sm) }]}
      accessibilityRole="tablist"
    >
      <View style={[styles.rule, { backgroundColor: primary }]} />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const name = route.name as TabName;
          const mark = MARK[name];
          const badge = options.tabBarBadge;
          const label = options.tabBarLabel ?? mark.label;
          const title = typeof label === 'string' ? label : mark.label;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? title}
              hitSlop={4}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => {
                navigation.emit({ type: 'tabLongPress', target: route.key });
              }}
              style={({ pressed }) => [styles.slot, pressed && styles.pressed]}
            >
              <View style={[styles.glyphWell, focused && { backgroundColor: primary }]}>
                <Ionicons
                  name={mark.glyph}
                  size={20}
                  color={focused ? ON_BRAND.primary : MART.inkMuted}
                />
                {typeof badge === 'number' && badge > 0 ? (
                  <View style={styles.badge} pointerEvents="none">
                    <Text style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.caption, focused && { color: MART.ink }]} numberOfLines={1}>
                {title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: {
    backgroundColor: MART.paperElevated,
    borderTopWidth: 1,
    borderTopColor: MART.border,
  },
  rule: {
    height: 2,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 56,
    paddingHorizontal: SPACE.xs,
    paddingTop: SPACE.xs,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xxs,
    minHeight: 52,
    zIndex: 1,
  },
  pressed: {
    opacity: 0.72,
  },
  glyphWell: {
    width: 36,
    height: 28,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MART.paper,
  },
  caption: {
    ...TYPE.shelf,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: MART.inkQuiet,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: RADIUS.pill,
    backgroundColor: MART.fallbackAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1a1204',
  },
});
