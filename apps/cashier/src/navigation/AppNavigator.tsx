import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ApiClient, SetupContext, TenantContext } from '@kiosk/core';
import { BarcodeScanner } from '@kiosk/barcode';
import { MART, FONT, WEIGHT } from '@kiosk/staff';
import { feel } from '../lib/feel';
import { SuppliesScreen } from '../screens/SuppliesScreen';
import { SupplyEntryScreen } from '../screens/SupplyEntryScreen';
import { PrinterSettingsScreen } from '../screens/PrinterSettingsScreen';
import { ReceiptPreviewScreen } from '../screens/ReceiptPreviewScreen';
import { CreditTabsScreen } from '../screens/CreditTabsScreen';
import { AirtimeScreen } from '../screens/AirtimeScreen';
import { useReach } from '../store/reach-store';
import { useUnsentSales } from '../hooks/useUnsentSales';

function TabScreen({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, 16);
  return <View style={{ flex: 1, paddingTop: topInset, backgroundColor: MART.paper }}>{children}</View>;
}
import { ShiftScreen } from '../screens/ShiftScreen';
import { PosWorkspaceScreen } from '../screens/PosWorkspaceScreen';
import { NewProductScreen } from '../screens/NewProductScreen';
import { WebOrdersScreen } from '../screens/WebOrdersScreen';
import { ServicesScreen } from '../screens/ServicesScreen';
import type { TillPerson } from '../lib/till-person';
import { titleAt } from '../lib/till-words';
import { PaymentScreen } from '../screens/PaymentScreen';
import { ReceiptScreen } from '../screens/ReceiptScreen';
import { GroceryInvoicesScreen } from '../screens/GroceryInvoicesScreen';
import { ConflictResolutionScreen } from '../screens/ConflictResolutionScreen';
import { HeaderStatus } from '../components/HeaderStatus';
import type { ShopFlags } from '../lib/shop-flags';

export type CashierStackParamList = {
  Tabs: undefined;
  /**
   * `notice`: something the screen the person came back from has to say (a product was added). `search`: look for this
   * at once (a product that may have been added). `reload`: start a fresh sale (clear the search, read the list again).
   */
  Pos: { notice?: string; search?: string; reload?: boolean } | undefined;
  /**
   * `barcode`: the code the person just scanned, which no product has. `name`: what they typed in the search and the
   * shelf did not have, so the form opens with it already written.
   */
  NewProduct: { barcode?: string; name?: string } | undefined;
  WebOrders: undefined;
  /** The shop's services, to put in the basket. */
  Services: undefined;
  Payment: undefined;
  /** What the till knows about the sale that the server's answer does not say: the change given, and when it was rung up. */
  Receipt: { changeCents?: number; soldAt?: string } | undefined;
  GroceryInvoices: undefined;
  Conflicts: undefined;
  /** Choosing a supplier to enter a supply from. */
  Supplies: undefined;
  /** Entering a supply: the products a chosen supplier brought in. */
  SupplyEntry: { supplierId: string; supplierName: string };
  /** Pair and manage the Bluetooth receipt printer. */
  PrinterSettings: undefined;
  /** The credit book: who owes the shop, and recording repayments for approval. */
  CreditTabs: undefined;
  /** Sell airtime from the till. */
  Airtime: undefined;
  /** Show a receipt (or test slip) as thermal paper on screen — the preview of what was printed. */
  ReceiptPreview: { source?: 'test' | 'sale' } | undefined;
};

type TabsParamList = {
  SellTab: undefined;
  InvoicesTab: undefined;
  ReceiveTab: undefined;
  ShiftTab: undefined;
};

const Stack = createNativeStackNavigator<CashierStackParamList>();
const Tab = createBottomTabNavigator<TabsParamList>();

type Shared = {
  api: ApiClient;
  tenant: TenantContext;
  branchId: string;
  branchName: string | null;
  person: TillPerson;
  shiftsDisabled: boolean;
  setupContext: SetupContext;
  look: () => Promise<boolean>;
  learn: (flags: ShopFlags) => void;
  onLogout: () => void;
};

const TAB_ICON: Record<keyof TabsParamList, keyof typeof Ionicons.glyphMap> = {
  SellTab: 'pricetag',
  InvoicesTab: 'receipt',
  ReceiveTab: 'cube',
  ShiftTab: 'time',
};

/** The four places a cashier lives: ring up a sale, take counter invoices, receive deliveries, and the shift. */
function CashierTabs({ shared }: { shared: Shared }) {
  const { api, tenant, branchId, branchName, person, shiftsDisabled, setupContext, learn, onLogout } = shared;
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  return (
    <Tab.Navigator
      screenListeners={{ tabPress: () => feel.select() }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: MART.fallbackPrimary,
        tabBarInactiveTintColor: MART.inkQuiet,
        tabBarStyle: {
          backgroundColor: MART.paperElevated,
          borderTopColor: MART.border,
          height: 54 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: FONT.medium,
 fontWeight: WEIGHT.medium, fontSize: 11 },
        tabBarIcon: ({ color, size, focused }) => {
          const base = TAB_ICON[route.name as keyof TabsParamList];
          const name = (focused ? base : `${base}-outline`) as keyof typeof Ionicons.glyphMap;
          return <Ionicons name={name} size={size ?? 22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="SellTab" options={{ title: 'Sell' }}>
        {({ navigation }) => (
          <TabScreen>
            <PosWorkspaceScreen
              navigation={navigation as never}
              route={{ key: 'pos', name: 'Pos', params: undefined } as never}
              api={api}
              branchId={branchId}
              tenantId={tenant.businessId}
              person={person}
              learn={learn}
            />
          </TabScreen>
        )}
      </Tab.Screen>
      <Tab.Screen name="InvoicesTab" options={{ title: 'Invoices' }}>
        {({ navigation }) => (
          <TabScreen>
            <GroceryInvoicesScreen
              api={api}
              navigation={navigation.getParent() as never}
            />
          </TabScreen>
        )}
      </Tab.Screen>
      <Tab.Screen name="ReceiveTab" options={{ title: 'Supplies' }}>
        {({ navigation }) => (
          <TabScreen>
            <SuppliesScreen
              navigation={navigation.getParent() as never}
              route={{ key: 'supplies', name: 'Supplies', params: undefined } as never}
              api={api}
              branchId={branchId}
            />
          </TabScreen>
        )}
      </Tab.Screen>
      <Tab.Screen name="ShiftTab" options={{ title: 'Shift' }}>
        {({ navigation }) => (
          <TabScreen>
            <ShiftScreen
              navigation={navigation as never}
              api={api}
              tenantId={tenant.businessId}
              branchId={branchId}
              tenantName={tenant.displayName}
              shiftsDisabled={shiftsDisabled}
              setupContext={setupContext}
              person={person}
              onLogout={onLogout}
            />
          </TabScreen>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

interface AppNavigatorProps {
  api: ApiClient;
  tenant: TenantContext;
  branchId: string;
  /** The branch's name, when the server said it: shown in the titles, so it is clear where the till is ringing. */
  branchName: string | null;
  /** Who is signed in: what they hold on hold, and what the shop lets them do. */
  person: TillPerson;
  /** The shop runs without shifts: the till never asks for one. */
  shiftsDisabled: boolean;
  /** Looks at the shop once, to find out whether the line is back. True when it answered. */
  look: () => Promise<boolean>;
  /** What the shop said about its settings: used, and kept on the phone. */
  learn: (flags: ShopFlags) => void;
  onLogout: () => void;
}

export function AppNavigator({
  api,
  tenant,
  branchId,
  branchName,
  person,
  shiftsDisabled,
  look,
  learn,
  onLogout,
}: AppNavigatorProps) {
  // Where a "set this up first" answer says the step is finished: this shop's own address.
  const setupContext: SetupContext = { app: 'cashier', shiftsDisabled, web: tenant.host };
  const shared: Shared = { api, tenant, branchId, branchName, person, shiftsDisabled, setupContext, look, learn, onLogout };
  const offline = useReach((state) => state.offline);
  const { total: unsentTotal } = useUnsentSales();
  const showHeaderStatus = offline || unsentTotal > 0;

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: MART.paper },
          headerTintColor: MART.ink,
          headerTitleStyle: { fontFamily: FONT.semibold,
 fontWeight: WEIGHT.semibold, fontSize: 17, color: MART.ink },
          // The iOS large title: it leads at 34pt and collapses into the bar as the screen scrolls,
          // which is the single strongest native cue a pushed screen can wear.
          headerLargeTitle: true,
          headerLargeTitleStyle: { fontFamily: FONT.bold,
 fontWeight: WEIGHT.bold, color: MART.ink },
          headerLargeTitleShadowVisible: false,
          headerShadowVisible: false,
          headerBackTitle: 'Back',
          contentStyle: { backgroundColor: MART.paper },
          headerRight: showHeaderStatus ? () => <HeaderStatus look={look} /> : undefined,
        }}
      >
        <Stack.Screen name="Tabs" options={{ headerShown: false }}>
          {() => <CashierTabs shared={shared} />}
        </Stack.Screen>
        <Stack.Screen name="Pos" options={{ title: titleAt('Point of Sale', branchName) }}>
          {(props) => (
            <PosWorkspaceScreen
              {...props}
              api={api}
              branchId={branchId}
              tenantId={tenant.businessId}
              person={person}
              learn={learn}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="NewProduct" options={{ title: titleAt('Add product', branchName) }}>
          {(props) => <NewProductScreen {...props} api={api} branchId={branchId} person={person} />}
        </Stack.Screen>
        <Stack.Screen name="WebOrders" options={{ title: titleAt('Web orders', branchName) }}>
          {(props) => <WebOrdersScreen {...props} api={api} branchId={branchId} person={person} />}
        </Stack.Screen>
        <Stack.Screen name="Services" options={{ title: titleAt('Services', branchName), headerLargeTitle: false }}>
          {(props) => <ServicesScreen {...props} api={api} tenantId={tenant.businessId} />}
        </Stack.Screen>
        <Stack.Screen name="Payment" options={{ title: 'Payment', headerLargeTitle: false }}>
          {(props) => <PaymentScreen {...props} api={api} branchId={branchId} setupContext={setupContext} person={person} />}
        </Stack.Screen>
        {/* The money moment: Payment fades into the receipt rather than sliding it away. */}
        <Stack.Screen
          name="Receipt"
          options={{ title: 'Receipt', headerLargeTitle: false, animation: 'fade', animationDuration: 220 }}
        >
          {(props) => (
            <ReceiptScreen
              {...props}
              shopName={tenant.displayName}
              tenantId={tenant.businessId}
              branchId={branchId}
              api={api}
              person={person}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="GroceryInvoices" options={{ title: 'Grocery Invoices' }}>
          {(props) => <GroceryInvoicesScreen {...props} api={api} navigation={props.navigation} />}
        </Stack.Screen>
        <Stack.Screen name="Conflicts" options={{ title: 'Unsent sales', headerRight: () => null, headerLargeTitle: false }}>
          {(props) => <ConflictResolutionScreen {...props} api={api} tenantId={tenant.businessId} person={person} />}
        </Stack.Screen>
        <Stack.Screen name="SupplyEntry" options={{ title: 'Enter supply' }}>
          {(props) => (
            <SupplyEntryScreen
              {...props}
              api={api}
              branchId={branchId}
              renderScanner={({ onBarcode, onClose }) => (
                <BarcodeScanner onBarcode={({ value }) => onBarcode(value)} onClose={onClose} />
              )}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="PrinterSettings" options={{ title: 'Receipt printer' }}>
          {(props) => <PrinterSettingsScreen {...props} api={api} tenant={tenant} branchName={branchName} />}
        </Stack.Screen>
        <Stack.Screen name="CreditTabs" options={{ title: 'Credit book' }}>
          {(props) => <CreditTabsScreen {...props} api={api} />}
        </Stack.Screen>
        <Stack.Screen name="Airtime" options={{ title: 'Sell airtime' }}>
          {(props) => <AirtimeScreen {...props} api={api} />}
        </Stack.Screen>
        <Stack.Screen name="ReceiptPreview" options={{ title: 'Receipt preview' }}>
          {(props) => <ReceiptPreviewScreen {...props} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
