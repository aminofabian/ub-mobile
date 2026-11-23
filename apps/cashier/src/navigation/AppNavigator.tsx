import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ApiClient, SetupContext, TenantContext } from '@kiosk/core';
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
  /** What the till knows about the sale that the server's answer does not say: the change given, and when it was rung up. */
  Receipt: { changeCents?: number; soldAt?: string } | undefined;
  GroceryInvoices: undefined;
  Conflicts: undefined;
};

const Stack = createNativeStackNavigator<CashierStackParamList>();

interface AppNavigatorProps {
  api: ApiClient;
  tenant: TenantContext;
  branchId: string;
  /** The shop runs without shifts: the till never asks for one. */
  shiftsDisabled: boolean;
  onLogout: () => void;
}

export function AppNavigator({ api, tenant, branchId, shiftsDisabled, onLogout }: AppNavigatorProps) {
  // Where a "set this up first" answer says the step is finished: this shop's own address.
  const setupContext: SetupContext = { app: 'cashier', shiftsDisabled, web: tenant.host };
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
              shiftsDisabled={shiftsDisabled}
              setupContext={setupContext}
              onLogout={onLogout}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Pos" options={{ title: 'Point of Sale' }}>
          {(props) => <PosWorkspaceScreen {...props} api={api} branchId={branchId} />}
        </Stack.Screen>
        <Stack.Screen name="Payment" options={{ title: 'Payment' }}>
          {(props) => <PaymentScreen {...props} api={api} branchId={branchId} setupContext={setupContext} />}
        </Stack.Screen>
        <Stack.Screen name="Receipt" options={{ title: 'Receipt' }}>
          {(props) => <ReceiptScreen {...props} shopName={tenant.displayName} />}
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
