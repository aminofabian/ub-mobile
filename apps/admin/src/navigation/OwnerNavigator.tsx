import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNavigationContainerRef, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ApiClient } from '@kiosk/core';
import { OrdersScreen, ReceiveOrderScreen, ReceiveScreen } from '@kiosk/orders';
import { createRealtimeClient } from '@kiosk/realtime';
import { SetStockScreen, type StaffSession } from '@kiosk/staff';
import { API_BASE_URL } from '../lib/config';
import { emitLiveRefresh, type LiveTopic } from '../lib/live-refresh';
import { ownerAccess, visibleTabs, type OwnerAccess, type OwnerTab } from '../lib/owner-access';
import { OwnerCreditScreen } from '../screens/owner/OwnerCreditScreen';
import { OwnerCreditTabScreen } from '../screens/owner/OwnerCreditTabScreen';
import { OwnerMoreScreen } from '../screens/owner/OwnerMoreScreen';
import { OwnerOrdersScreen } from '../screens/owner/OwnerOrdersScreen';
import { OwnerBranchesScreen } from '../screens/owner/OwnerBranchesScreen';
import { OwnerCatalogueScreen } from '../screens/owner/OwnerCatalogueScreen';
import { OwnerReportsScreen } from '../screens/owner/OwnerReportsScreen';
import { OwnerSettingsScreen } from '../screens/owner/OwnerSettingsScreen';
import { OwnerStaffScreen } from '../screens/owner/OwnerStaffScreen';
import { OwnerStockScreen } from '../screens/owner/OwnerStockScreen';
import { InvoicesScreen } from '../screens/InvoicesScreen';
import { SellScreen } from '../screens/SellScreen';
import { TodayScreen } from '../screens/owner/TodayScreen';
import { FONT, MART, TYPE } from '../theme/mart';
import { ensurePushChannels } from '../lib/push-channels';
import { NotificationTapRouter } from './NotificationTapRouter';
import { ShopPulse } from './ShopPulse';
import type { OwnerStackParamList, OwnerTabParamList } from './owner-types';

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

const TAB_ICONS: Record<OwnerTab, keyof typeof Ionicons.glyphMap> = {
  Sell: 'pricetag',
  Today: 'pulse',
  Invoices: 'receipt',
  Orders: 'cart',
  Stock: 'cube',
  Credit: 'wallet',
  More: 'ellipsis-horizontal',
};

const TAB_TITLES: Record<OwnerTab, string> = {
  Sell: 'Sell',
  Today: 'Today',
  Invoices: 'Invoices',
  Orders: 'Orders',
  Stock: 'Stock',
  Credit: 'Credit',
  More: 'More',
};

const Tab = createBottomTabNavigator<OwnerTabParamList>();
const Stack = createNativeStackNavigator<OwnerStackParamList>();

/** A notice while the app is open is our own card. In the background, the phone shows it. */
function showAlertsWhileOpen(): void {
  void ensurePushChannels();
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => {
        const here = AppState.currentState === 'active';
        return {
          shouldShowBanner: !here,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        };
      },
    });
  } catch {
    // Alerts are an extra. An app that cannot set them up still works.
  }
}

type Go = {
  tab: (tab: Exclude<OwnerTab, 'Today' | 'More'>) => void;
};

type Shop = {
  api: ApiClient;
  name: string;
  host: string;
  branchId: string;
  branchName: string | null;
  shiftsDisabled: boolean;
};

/**
 * The Owner app: Today, web orders, stock, credit and More, with the screens those open above them. A person sees the
 * tabs their role allows and no others (`visibleTabs`), and each screen asks the server for what it needs, so a part
 * a role may not see costs no request. The sign-in, the check that the app fits the person and the choice of branch
 * are `StaffShell`'s, and have happened before this is drawn.
 */
export function OwnerNavigator({ session }: { session: StaffSession }) {
  const { api, tenant, user, branchId, branchName, shiftsDisabled, signOut } = session;
  const access = useMemo(() => ownerAccess(user), [user]);
  const tabs = useMemo(() => visibleTabs(access), [access]);
  const navigationRef = useMemo(() => createNavigationContainerRef<OwnerStackParamList>(), []);
  const [ready, setReady] = useState(false);

  useEffect(showAlertsWhileOpen, []);

  // Live updates: the backend already broadcasts sale.completed, supply.posted and the grocery-invoice
  // events to the "pos" channel (an owner has sales.read, so the ticket carries it). We connect, and when
  // one of these fires we nudge the open screen to re-read the figure it affects. Events can arrive in a
  // burst (several sales at once), so a nudge waits a moment and coalesces them into one refresh.
  useEffect(() => {
    const client = createRealtimeClient(API_BASE_URL, api);
    const timers: Partial<Record<LiveTopic, ReturnType<typeof setTimeout>>> = {};
    const nudge = (topic: LiveTopic) => {
      if (timers[topic]) return;
      timers[topic] = setTimeout(() => {
        timers[topic] = undefined;
        emitLiveRefresh(topic);
      }, 600);
    };
    const subs = [
      client.subscribe('sale.completed', () => nudge('sales')),
      client.subscribe('supply.posted', () => nudge('suppliers')),
      client.subscribe('grocery.invoice.paid', () => nudge('suppliers')),
      client.subscribe('grocery.invoice.created', () => nudge('suppliers')),
      client.subscribe('grocery.invoice.cancelled', () => nudge('suppliers')),
    ];
    void client.connect();
    return () => {
      for (const unsub of subs) unsub();
      for (const t of Object.values(timers)) if (t) clearTimeout(t);
      client.disconnect();
    };
  }, [api]);

  const shop = useMemo<Shop>(
    () => ({ api, name: tenant.displayName, host: tenant.host, branchId, branchName, shiftsDisabled }),
    [api, tenant.displayName, tenant.host, branchId, branchName, shiftsDisabled]
  );

  const openTab = useCallback<Go['tab']>(
    (tab) => {
      if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: tab }, { pop: true });
    },
    [navigationRef]
  );

  return (
    <NavigationContainer ref={navigationRef} theme={NAV_THEME} onReady={() => setReady(true)}>
      <NotificationTapRouter ready={ready} navigationRef={navigationRef} tabs={tabs} />
      <ShopPulse
        tabs={tabs}
        onOpen={(tab) => {
          if (!navigationRef.isReady()) return;
          navigationRef.navigate('Main', { screen: tabs.includes(tab) ? tab : 'Today' }, { pop: true });
        }}
      />
      <Stack.Navigator screenOptions={screenChrome}>
        <Stack.Screen name="Main" options={{ headerShown: false }}>
          {() => (
            <MainTabs
              shop={shop}
              access={access}
              tabs={tabs}
              personName={(typeof user.name === 'string' ? user.name.trim() : '') || user.email || 'Signed in'}
              roleName={user.roleName || ''}
              openTab={openTab}
              onSignOut={signOut}
              open={{
                receive: () => navigationRef.isReady() && navigationRef.navigate('ReceiveOrders'),
                orderFromSuppliers: () => navigationRef.isReady() && navigationRef.navigate('OrderPortal'),
                item: (itemId) => navigationRef.isReady() && navigationRef.navigate('SetStock', { itemId }),
                tab: (found) =>
                  navigationRef.isReady() &&
                  navigationRef.navigate('CreditTab', { customerId: found.customerId, name: found.name, owedCents: found.owedCents, phone: found.phone }),
                staff: () => navigationRef.isReady() && navigationRef.navigate('Staff'),
                reports: () => navigationRef.isReady() && navigationRef.navigate('Reports'),
                settings: () => navigationRef.isReady() && navigationRef.navigate('Settings'),
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="SetStock" options={{ title: 'Set stock' }}>
          {({ route }) => <SetStockScreen api={api} branchId={branchId} itemId={route.params.itemId} />}
        </Stack.Screen>
        <Stack.Screen name="CreditTab" options={{ title: 'Credit tab' }}>
          {({ route }) => (
            <OwnerCreditTabScreen
              api={api}
              shopName={shop.name}
              host={shop.host}
              customerId={route.params.customerId}
              name={route.params.name}
              owedCents={route.params.owedCents}
              phone={route.params.phone}
              canRecord={access.recordPayments}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="OrderPortal" options={{ title: 'Order from suppliers' }}>
          {() => <OrdersScreen api={api} branchId={branchId} />}
        </Stack.Screen>
        <Stack.Screen name="ReceiveOrders" options={{ title: 'Receive a delivery' }}>
          {({ navigation }) => (
            <ReceiveScreen api={api} onOpenOrder={(purchaseOrderId) => navigation.navigate('ReceiveOrderDetail', { purchaseOrderId })} />
          )}
        </Stack.Screen>
        <Stack.Screen name="ReceiveOrderDetail" options={{ title: 'Confirm receipt' }}>
          {({ route, navigation }) => (
            <ReceiveOrderScreen api={api} branchId={branchId} purchaseOrderId={route.params.purchaseOrderId} onDone={() => navigation.goBack()} />
          )}
        </Stack.Screen>
        {/* These three carry their own large in-screen header (ScreenHeader), so the nav bar shows only the
            back control — no duplicate title. The `title` still names the route for screen readers and back. */}
        <Stack.Screen name="Staff" options={{ title: 'Staff', headerTitle: '' }}>
          {() => <OwnerStaffScreen api={api} />}
        </Stack.Screen>
        <Stack.Screen name="Reports" options={{ title: 'Reports', headerTitle: '' }}>
          {() => <OwnerReportsScreen api={api} />}
        </Stack.Screen>
        <Stack.Screen name="Settings" options={{ title: 'Settings', headerTitle: '' }}>
          {() => (
            <OwnerSettingsScreen
              api={api}
              host={tenant.host}
              shopName={tenant.displayName}
              branchName={branchName}
              onOpenCatalogue={() => navigationRef.isReady() && navigationRef.navigate('Catalogue')}
              onOpenBranches={() => navigationRef.isReady() && navigationRef.navigate('Branches')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Catalogue" options={{ title: 'Catalogue', headerTitle: '' }}>
          {() => <OwnerCatalogueScreen api={api} branchId={branchId} />}
        </Stack.Screen>
        <Stack.Screen name="Branches" options={{ title: 'Branches', headerTitle: '' }}>
          {() => <OwnerBranchesScreen api={api} currentBranchId={branchId} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

type Opener = {
  receive: () => void;
  orderFromSuppliers: () => void;
  item: (itemId: string) => void;
  tab: (tab: { customerId: string; name: string; owedCents: number; phone: string | null }) => void;
  staff: () => void;
  reports: () => void;
  settings: () => void;
};

function MainTabs({
  shop,
  access,
  tabs,
  personName,
  roleName,
  openTab,
  onSignOut,
  open,
}: {
  shop: Shop;
  access: OwnerAccess;
  tabs: readonly OwnerTab[];
  personName: string;
  roleName: string;
  openTab: Go['tab'];
  onSignOut: () => Promise<boolean>;
  open: Opener;
}) {
  const { api, name, host, branchId, branchName, shiftsDisabled } = shop;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...screenChrome,
        tabBarActiveTintColor: MART.fallbackPrimary,
        tabBarInactiveTintColor: MART.inkQuiet,
        tabBarStyle: { backgroundColor: MART.paper, borderTopColor: MART.border },
        tabBarLabelStyle: { ...TYPE.shelf },
        tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICONS[route.name]} color={color} size={size} />,
      })}
    >
      {tabs.includes('Sell') ? (
        <Tab.Screen name="Sell" options={{ title: TAB_TITLES.Sell }}>
          {() => (
            <SellScreen
              api={api}
              branchId={branchId}
              canCredit={access.credit}
              onSold={(words) => Alert.alert('Sale taken', words, [{ text: 'Done' }])}
            />
          )}
        </Tab.Screen>
      ) : null}
      {tabs.includes('Today') ? (
        <Tab.Screen name="Today" options={{ title: TAB_TITLES.Today }}>
          {() => (
            <TodayScreen
              api={api}
              shopName={name}
              branchId={branchId}
              branchName={branchName}
              shiftsDisabled={shiftsDisabled}
              access={access}
              onOpenTab={openTab}
              onReceive={open.receive}
            />
          )}
        </Tab.Screen>
      ) : null}
      {tabs.includes('Invoices') ? (
        <Tab.Screen name="Invoices" options={{ title: TAB_TITLES.Invoices }}>
          {() => <InvoicesScreen api={api} branchId={branchId} />}
        </Tab.Screen>
      ) : null}
      {tabs.includes('Orders') ? (
        <Tab.Screen name="Orders" options={{ title: TAB_TITLES.Orders }}>
          {() => <OwnerOrdersScreen api={api} />}
        </Tab.Screen>
      ) : null}
      {tabs.includes('Stock') ? (
        <Tab.Screen name="Stock" options={{ title: TAB_TITLES.Stock }}>
          {() => <OwnerStockScreen api={api} branchId={branchId} branchName={branchName} access={access} onOpenItem={open.item} />}
        </Tab.Screen>
      ) : null}
      {tabs.includes('Credit') ? (
        <Tab.Screen name="Credit" options={{ title: TAB_TITLES.Credit }}>
          {() => <OwnerCreditScreen api={api} onOpenTab={open.tab} />}
        </Tab.Screen>
      ) : null}
      <Tab.Screen name="More" options={{ title: TAB_TITLES.More }}>
        {() => (
          <OwnerMoreScreen
            shopName={name}
            host={host}
            personName={personName}
            roleName={roleName}
            branchName={branchName}
            access={access}
            onReceive={open.receive}
            onOrderFromSuppliers={open.orderFromSuppliers}
            onOpenStaff={open.staff}
            onOpenReports={open.reports}
            onOpenSettings={open.settings}
            onSignOut={onSignOut}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
