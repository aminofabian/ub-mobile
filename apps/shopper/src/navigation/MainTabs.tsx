import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTenant } from '../lib/TenantContext';
import { useCart } from '../hooks/useCart';
import { martFromTenant, MART } from '../theme/mart';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { CartScreen } from '../screens/CartScreen';
import { AccountScreen } from '../screens/AccountScreen';
import type { MainTabParamList } from './types';

export type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<
  keyof MainTabParamList,
  { on: React.ComponentProps<typeof Ionicons>['name']; off: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  Home: { on: 'home', off: 'home-outline' },
  Search: { on: 'search', off: 'search-outline' },
  Cart: { on: 'bag-handle', off: 'bag-handle-outline' },
  Account: { on: 'person', off: 'person-outline' },
};

export function MainTabs() {
  const tenant = useTenant();
  const { itemCount } = useCart(tenant.slug);
  const mart = martFromTenant(tenant);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: route.name !== 'Home',
        headerTitleStyle: styles.headerTitle,
        headerStyle: { backgroundColor: MART.paperElevated },
        headerShadowVisible: false,
        tabBarActiveTintColor: mart.primary,
        tabBarInactiveTintColor: MART.inkQuiet,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ focused, color, size }) => {
          const icon = ICONS[route.name];
          return <Ionicons name={focused ? icon.on : icon.off} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarBadgeStyle: { backgroundColor: mart.accent, color: '#0f172a', fontSize: 10 },
        }}
      />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontWeight: '700',
    color: MART.ink,
  },
  tabBar: {
    backgroundColor: MART.paperElevated,
    borderTopColor: MART.border,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
