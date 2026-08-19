import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
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
    <Tab.Navigator>
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
    <NavigationContainer>
      <Stack.Navigator>
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
