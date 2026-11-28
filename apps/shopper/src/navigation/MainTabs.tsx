import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTenant } from '../lib/TenantContext';
import { useCart } from '../hooks/useCart';
import { useSession } from '../hooks/useSession';
import { useAuthGate } from '../components/AuthGate';
import { martFromTenant, MART, TYPE } from '../theme/mart';
import { HomeScreen } from '../screens/HomeScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { CartScreen } from '../screens/CartScreen';
import { AccountScreen } from '../screens/AccountScreen';
import { MartTabBar } from './MartTabBar';
import type { MainTabParamList } from './types';

export type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const tenant = useTenant();
  const { itemCount } = useCart(tenant.slug);
  const { signedIn } = useSession();
  const { openAuth } = useAuthGate();
  const mart = martFromTenant(tenant);

  return (
    <Tab.Navigator
      tabBar={(props) => <MartTabBar {...props} primary={mart.primary} accent={mart.accent} />}
      screenOptions={{
        headerShown: false,
        headerTitleStyle: styles.headerTitle,
        headerStyle: { backgroundColor: MART.paper },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        headerTintColor: MART.ink,
        lazy: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home', tabBarAccessibilityLabel: 'Home' }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Search',
          tabBarLabel: 'Search',
          tabBarAccessibilityLabel: 'Search products',
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          title: 'Basket',
          tabBarLabel: 'Basket',
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarAccessibilityLabel: itemCount > 0 ? `Basket, ${itemCount} items` : 'Basket',
        }}
      />
      <Tab.Screen
        name="Account"
        component={AccountScreen}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            if (signedIn) return;
            event.preventDefault();
            void openAuth('pass').then((ok) => {
              if (ok) navigation.navigate('Account');
            });
          },
        })}
        options={{
          tabBarLabel: 'Account',
          tabBarAccessibilityLabel: 'Account: wallet, points and orders',
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    ...TYPE.title,
    color: MART.ink,
  },
});
