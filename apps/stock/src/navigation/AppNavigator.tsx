import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ApiClient } from '@kiosk/core';
import { DashboardScreen } from '../screens/DashboardScreen';
import { StockTakeScreen } from '../screens/StockTakeScreen';
import { SupplyBatchesScreen } from '../screens/SupplyBatchesScreen';
import { TransfersScreen } from '../screens/TransfersScreen';

export type StockStackParamList = {
  Dashboard: undefined;
  StockTake: undefined;
  Batches: undefined;
  Transfers: undefined;
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
