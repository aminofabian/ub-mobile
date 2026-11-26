import React from 'react';
import { View } from 'react-native';
import { NavigationContainer, type NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildTillSlipEscPos, OrdersScreen } from '@kiosk/orders';
import { FONT, MART, SHADOW, SPACE, WEIGHT } from '@kiosk/staff';
import { supplierItemTypeScope } from '@kiosk/core';
import { useGrocerySession } from '../lib/session';
import { usePrinter } from '../store/printer-store';
import { EditStockRoute } from '../screens/EditStockRoute';
import { FinalizeScreen } from '../screens/FinalizeScreen';
import { InvoiceBuilderScreen } from '../screens/InvoiceBuilderScreen';
import { InvoiceListScreen } from '../screens/InvoiceListScreen';
import { InvoiceScreen } from '../screens/InvoiceScreen';
import { PrinterSettingsScreen } from '../screens/PrinterSettingsScreen';
import { SalesScreen } from '../screens/SalesScreen';
import { SpoilsRoute } from '../screens/SpoilsRoute';
import { rootNav } from './root-nav';

export type GroceryStackParamList = {
  Builder: undefined;
  Finalize: undefined;
  Invoices: undefined;
  Invoice: { invoiceId: string };
  Sales: undefined;
  Spoils: undefined;
  EditStock: undefined;
  /** Place a Path A supplier order for assigned departments. */
  Order: undefined;
  /** Pair a Bluetooth printer for department-invoice slips. */
  PrinterSettings: undefined;
};

export type TabsParamList = {
  SellTab: NavigatorScreenParams<Pick<GroceryStackParamList, 'Builder' | 'Finalize' | 'Invoice' | 'Spoils'>>;
  InvoicesTab: NavigatorScreenParams<Pick<GroceryStackParamList, 'Invoices' | 'Invoice'>>;
  SalesTab: NavigatorScreenParams<Pick<GroceryStackParamList, 'Sales' | 'PrinterSettings'>>;
  StockTab: NavigatorScreenParams<Pick<GroceryStackParamList, 'EditStock' | 'Spoils' | 'Order'>>;
};

const Stack = createNativeStackNavigator<GroceryStackParamList>();
const Tab = createBottomTabNavigator<TabsParamList>();
const StockStack = createNativeStackNavigator<GroceryStackParamList>();

const TAB_ICON: Record<keyof TabsParamList, keyof typeof Ionicons.glyphMap> = {
  SellTab: 'pricetag',
  InvoicesTab: 'receipt',
  SalesTab: 'cloud-upload',
  StockTab: 'cube',
};

/** The counter is the whole screen: it draws its own head, so the stack bar would only cost height. */
const noHeader = { headerShown: false } as const;

const martHeader = {
  headerStyle: { backgroundColor: MART.paper },
  headerTintColor: MART.ink,
  headerTitleStyle: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold, fontSize: 17 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: MART.paper },
} as const;

function SellStack() {
  return (
    <Stack.Navigator screenOptions={martHeader}>
      <Stack.Screen name="Builder" component={InvoiceBuilderScreen} options={noHeader} />
      <Stack.Screen name="Finalize" component={FinalizeScreen} options={{ title: 'Basket' }} />
      <Stack.Screen name="Invoice" component={InvoiceScreen} options={{ title: 'Invoice' }} />
      <Stack.Screen name="Spoils" component={SpoilsRoute} options={{ title: 'Write off' }} />
    </Stack.Navigator>
  );
}

function InvoicesStack() {
  return (
    <Stack.Navigator screenOptions={martHeader}>
      <Stack.Screen name="Invoices" component={InvoiceListScreen} options={{ title: 'Invoices' }} />
      <Stack.Screen name="Invoice" component={InvoiceScreen} options={{ title: 'Invoice' }} />
    </Stack.Navigator>
  );
}

function SalesStack() {
  return (
    <Stack.Navigator screenOptions={martHeader}>
      <Stack.Screen name="Sales" component={SalesScreen} options={{ title: 'Sales' }} />
      <Stack.Screen name="PrinterSettings" component={PrinterSettingsScreen} options={{ title: 'Invoice printer' }} />
    </Stack.Navigator>
  );
}

function GroceryOrderScreen() {
  const { api, branchId, branchName, shopName, clerkName, user } = useGrocerySession();
  const scope = supplierItemTypeScope(user);
  const savedPrinter = usePrinter((s) => s.saved);
  const printBytes = usePrinter((s) => s.print);
  return (
    <OrdersScreen
      api={api}
      branchId={branchId}
      itemTypeIds={scope}
      shopName={shopName}
      branchName={branchName}
      clerkName={clerkName}
      hasLocalPrinter={Boolean(savedPrinter)}
      printLocal={async (slip) => {
        const paperMm = savedPrinter?.paper === '80' ? 80 : 58;
        const bytes = buildTillSlipEscPos(
          {
            reference: slip.reference,
            supplierName: slip.supplierName,
            businessName: slip.businessName,
            branchName: slip.branchName,
            placedByName: slip.placedByName,
            currency: 'KES',
            lines: slip.lines,
          },
          'order',
          paperMm,
        );
        await printBytes(bytes);
      }}
    />
  );
}

function StockJobsStack() {
  const { mayOrder } = useGrocerySession();
  return (
    <StockStack.Navigator screenOptions={martHeader}>
      <StockStack.Screen name="EditStock" component={EditStockRoute} options={{ title: 'Edit stock' }} />
      <StockStack.Screen name="Spoils" component={SpoilsRoute} options={{ title: 'Write off' }} />
      {mayOrder ? (
        <StockStack.Screen name="Order" component={GroceryOrderScreen} options={{ title: 'Order' }} />
      ) : null}
    </StockStack.Navigator>
  );
}

/**
 * The four places a grocery clerk works: selling, the invoices the shop has raised, the sales this phone still has to
 * send, and the stock behind them. The same shape, and the same bar, as the till — so moving between the two apps is
 * moving between rooms in one product, not learning a second one.
 */
export function AppNavigator() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <NavigationContainer ref={rootNav}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: MART.fallbackPrimary,
          tabBarInactiveTintColor: MART.inkQuiet,
          tabBarStyle: {
            backgroundColor: MART.paperElevated,
            borderTopWidth: 0,
            height: 58 + bottomPad,
            paddingBottom: bottomPad,
            paddingTop: SPACE.sm,
            ...SHADOW.floating,
          },
          tabBarLabelStyle: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium, fontSize: 11, letterSpacing: -0.1 },
          tabBarIcon: ({ color, size, focused }) => {
            const base = TAB_ICON[route.name as keyof TabsParamList];
            const name = (focused ? base : `${base}-outline`) as keyof typeof Ionicons.glyphMap;
            return (
              <View
                style={
                  focused
                    ? {
                        width: 34,
                        height: 34,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: MART.fallbackPrimary,
                        marginBottom: 2,
                      }
                    : { marginBottom: 2 }
                }
              >
                <Ionicons name={name} size={focused ? 18 : (size ?? 20)} color={focused ? MART.paper : color} />
              </View>
            );
          },
        })}
      >
        <Tab.Screen name="SellTab" component={SellStack} options={{ title: 'Sell' }} />
        <Tab.Screen name="InvoicesTab" component={InvoicesStack} options={{ title: 'Invoices' }} />
        <Tab.Screen name="SalesTab" component={SalesStack} options={{ title: 'Sales' }} />
        <Tab.Screen name="StockTab" component={StockJobsStack} options={{ title: 'Stock' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
