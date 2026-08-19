import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ApiClient } from '@kiosk/core';
import {
  OrdersScreen,
  ReceiveScreen,
  ReceiveOrderScreen,
} from '@kiosk/orders';
import { DashboardScreen } from '../screens/DashboardScreen';
import { StockTakeScreen } from '../screens/StockTakeScreen';
import { SupplyBatchesScreen } from '../screens/SupplyBatchesScreen';
import { TransfersScreen } from '../screens/TransfersScreen';

export type StockStackParamList = {
  Dashboard: undefined;
  StockTake: undefined;
  Batches: undefined;
  Transfers: undefined;
  Orders: undefined;
  Receive: undefined;
  ReceiveOrder: { purchaseOrderId: string };
};

const Stack = createNativeStackNavigator<StockStackParamList>();

export function AppNavigator({ api, branchId, onLogout }: { api: ApiClient; branchId: string; onLogout: () => void }) {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Dashboard" options={{ title: 'Stock' }}>
          {(props) => <DashboardScreen {...props} api={api} onLogout={onLogout} />}
        </Stack.Screen>
        <Stack.Screen name="StockTake" options={{ title: 'Stock Take' }}>
          {(props) => <StockTakeScreen {...props} api={api} branchId={branchId} />}
        </Stack.Screen>
        <Stack.Screen name="Batches" options={{ title: 'Supply Batches' }}>
          {(props) => <SupplyBatchesScreen {...props} api={api} />}
        </Stack.Screen>
        <Stack.Screen name="Transfers" options={{ title: 'Transfers' }}>
          {(props) => <TransfersScreen {...props} api={api} branchId={branchId} />}
        </Stack.Screen>
        <Stack.Screen name="Orders" options={{ title: 'Order Portal' }}>
          {(props) => <OrdersScreen {...props} api={api} branchId={branchId} />}
        </Stack.Screen>
        <Stack.Screen name="Receive" options={{ title: 'Receive Orders' }}>
          {(props) => (
            <ReceiveScreen
              {...props}
              api={api}
              onOpenOrder={(purchaseOrderId) =>
                props.navigation.navigate('ReceiveOrder', { purchaseOrderId })
              }
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="ReceiveOrder" options={{ title: 'Confirm Receipt' }}>
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
