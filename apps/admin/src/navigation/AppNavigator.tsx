import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { ApiClient } from '@kiosk/core';
import {
  OrdersScreen,
  ReceiveScreen,
  ReceiveOrderScreen,
} from '@kiosk/orders';
import { DashboardScreen } from '../screens/DashboardScreen';
import { WebOrdersScreen } from '../screens/WebOrdersScreen';
import { UsersScreen } from '../screens/UsersScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { MART, FONT, TYPE } from '../theme/mart';

const NAV_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: MART.fallbackPrimary,
    background: MART.paper,
    card: MART.paper,
    text: MART.ink,
    border: MART.border,
  },
};

const screenChrome = {
  headerStyle: { backgroundColor: MART.paper },
  headerShadowVisible: false,
  headerTintColor: MART.ink,
  headerTitleStyle: { fontFamily: FONT.bold, fontSize: 18, color: MART.ink },
  contentStyle: { backgroundColor: MART.paper },
} as const;

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Overview: 'pulse',
  Orders: 'cart',
  Users: 'people',
  Analytics: 'bar-chart',
};

export type AdminStackParamList = {
  Main: undefined;
  OrderPortal: undefined;
  ReceiveOrders: undefined;
  ReceiveOrderDetail: { purchaseOrderId: string };
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<AdminStackParamList>();

function MainTabs({ api, branchId, onLogout }: { api: ApiClient; branchId: string; onLogout: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...screenChrome,
        tabBarActiveTintColor: MART.fallbackPrimary,
        tabBarInactiveTintColor: MART.inkQuiet,
        tabBarStyle: {
          backgroundColor: MART.paper,
          borderTopColor: MART.border,
        },
        tabBarLabelStyle: { ...TYPE.shelf },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name] ?? 'ellipse'} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="Overview" options={{ title: 'Overview' }}>
        {() => <DashboardScreen api={api} branchId={branchId} onLogout={onLogout} />}
      </Tab.Screen>
      <Tab.Screen name="Orders" options={{ title: 'Web Orders' }}>
        {() => <WebOrdersScreen api={api} />}
      </Tab.Screen>
      <Tab.Screen name="Users" options={{ title: 'Users' }}>
        {() => <UsersScreen api={api} />}
      </Tab.Screen>
      <Tab.Screen name="Analytics" options={{ title: 'Analytics' }}>
        {() => <AnalyticsScreen api={api} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export function AppNavigator({
  api,
  branchId,
  onLogout,
}: {
  api: ApiClient;
  branchId: string;
  onLogout: () => void;
}) {
  return (
    <NavigationContainer theme={NAV_THEME}>
      <Stack.Navigator screenOptions={screenChrome}>
        <Stack.Screen name="Main" options={{ headerShown: false }}>
          {() => <MainTabs api={api} branchId={branchId} onLogout={onLogout} />}
        </Stack.Screen>
        <Stack.Screen name="OrderPortal" options={{ title: 'Order Portal' }}>
          {(props) => <OrdersScreen {...props} api={api} branchId={branchId} />}
        </Stack.Screen>
        <Stack.Screen name="ReceiveOrders" options={{ title: 'Receive Orders' }}>
          {(props) => (
            <ReceiveScreen
              {...props}
              api={api}
              onOpenOrder={(purchaseOrderId) =>
                props.navigation.navigate('ReceiveOrderDetail', { purchaseOrderId })
              }
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="ReceiveOrderDetail" options={{ title: 'Confirm Receipt' }}>
          {(props) => (
            <ReceiveOrderScreen
              {...props}
              api={api}
              branchId={branchId}
              purchaseOrderId={props.route.params.purchaseOrderId}
              onDone={() => props.navigation.goBack()}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
