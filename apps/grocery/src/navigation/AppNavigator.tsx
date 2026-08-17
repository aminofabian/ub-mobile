import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ApiClient } from '@kiosk/core';
import { InvoiceBuilderScreen } from '../screens/InvoiceBuilderScreen';
import { InvoiceListScreen } from '../screens/InvoiceListScreen';
import { FinalizeScreen } from '../screens/FinalizeScreen';

export type GroceryStackParamList = {
  Builder: undefined;
  Finalize: undefined;
  Invoices: undefined;
};

const Stack = createNativeStackNavigator<GroceryStackParamList>();

interface AppNavigatorProps {
  api: ApiClient;
  branchId: string;
  onLogout: () => void;
}

export function AppNavigator({ api, branchId, onLogout }: AppNavigatorProps) {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Builder" options={{ title: 'Invoice Builder' }}>
          {(props) => <InvoiceBuilderScreen {...props} api={api} branchId={branchId} onLogout={onLogout} />}
        </Stack.Screen>
        <Stack.Screen name="Finalize" options={{ title: 'Finalize' }}>
          {(props) => <FinalizeScreen {...props} api={api} branchId={branchId} />}
        </Stack.Screen>
        <Stack.Screen name="Invoices" options={{ title: 'Invoices' }}>
          {(props) => <InvoiceListScreen {...props} api={api} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
