import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ApiClient, TenantContext } from '@kiosk/core';
import { ShiftScreen } from '../screens/ShiftScreen';
import { PosWorkspaceScreen } from '../screens/PosWorkspaceScreen';
import { PaymentScreen } from '../screens/PaymentScreen';
import { ReceiptScreen } from '../screens/ReceiptScreen';
import { GroceryInvoicesScreen } from '../screens/GroceryInvoicesScreen';
import { ConflictResolutionScreen } from '../screens/ConflictResolutionScreen';
import { UnsentBadge } from '../components/UnsentBadge';

export type CashierStackParamList = {
  Shift: undefined;
  Pos: undefined;
  Payment: undefined;
  Receipt: undefined;
  GroceryInvoices: undefined;
  Conflicts: undefined;
};

const Stack = createNativeStackNavigator<CashierStackParamList>();

interface AppNavigatorProps {
  api: ApiClient;
  tenant: TenantContext;
  branchId: string;
  onLogout: () => void;
}

export function AppNavigator({ api, tenant, branchId, onLogout }: AppNavigatorProps) {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Shift" screenOptions={{ headerRight: () => <UnsentBadge /> }}>
        <Stack.Screen name="Shift" options={{ title: 'Shift' }}>
          {(props) => (
            <ShiftScreen
              {...props}
              api={api}
              branchId={branchId}
              tenantName={tenant.displayName}
              onLogout={onLogout}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Pos" options={{ title: 'Point of Sale' }}>
          {(props) => <PosWorkspaceScreen {...props} api={api} branchId={branchId} />}
        </Stack.Screen>
        <Stack.Screen name="Payment" options={{ title: 'Payment' }}>
          {(props) => <PaymentScreen {...props} api={api} branchId={branchId} />}
        </Stack.Screen>
        <Stack.Screen name="Receipt" options={{ title: 'Receipt' }}>
          {(props) => <ReceiptScreen {...props} />}
        </Stack.Screen>
        <Stack.Screen name="GroceryInvoices" options={{ title: 'Grocery Invoices' }}>
          {(props) => <GroceryInvoicesScreen {...props} api={api} />}
        </Stack.Screen>
        <Stack.Screen name="Conflicts" options={{ title: 'Unsent sales', headerRight: () => null }}>
          {(props) => <ConflictResolutionScreen {...props} api={api} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
