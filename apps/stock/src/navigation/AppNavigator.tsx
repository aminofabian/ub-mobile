import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { StockItem } from '@kiosk/core';
import { OrdersScreen, ReceiveOrderScreen, ReceiveScreen } from '@kiosk/orders';
import { FONT, MartText, MART, WEIGHT, type ItemFilter } from '@kiosk/staff';
import { useStockSession } from '../lib/session';
import { BatchCountScreen } from '../screens/BatchCountScreen';
import { BatchReviewScreen } from '../screens/BatchReviewScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { FullCountScreen } from '../screens/FullCountScreen';
import { ItemScreen } from '../screens/ItemScreen';
import { ItemsScreen } from '../screens/ItemsScreen';
import { NewTransferScreen } from '../screens/NewTransferScreen';
import { SetStockRoute } from '../screens/SetStockRoute';
import { StockTakeScreen } from '../screens/StockTakeScreen';
import { StoreRoomScreen } from '../screens/StoreRoomScreen';
import { StoreRowScreen } from '../screens/StoreRowScreen';
import { StoreTodayScreen } from '../screens/StoreTodayScreen';
import { SupplyBatchScreen } from '../screens/SupplyBatchScreen';
import { SupplyBatchesScreen } from '../screens/SupplyBatchesScreen';
import { TransferScreen } from '../screens/TransferScreen';
import { TransfersScreen } from '../screens/TransfersScreen';
import { WriteOffRoute } from '../screens/WriteOffRoute';

export type StockStackParamList = {
  Dashboard: undefined;
  Items: { filter?: ItemFilter } | undefined;
  Item: { itemId: string };
  SetStock: { itemId?: string } | undefined;
  WriteOff: { item?: StockItem } | undefined;
  StockTake: undefined;
  FullCount: undefined;
  BatchCount: { sessionId: string };
  BatchReview: { sessionId: string };
  Transfers: undefined;
  Transfer: { transferId: string };
  NewTransfer: undefined;
  Batches: undefined;
  Batch: { batchId: string };
  Orders: undefined;
  Receive: undefined;
  ReceiveOrder: { purchaseOrderId: string };
  StoreRoom: undefined;
  StoreRow: { storeItemId: string };
  StoreToday: undefined;
};

type StockTabParamList = {
  HomeTab: undefined;
  ItemsTab: undefined;
  CountTab: undefined;
  DeliveriesTab: undefined;
  TransfersTab: undefined;
};

const Stack = createNativeStackNavigator<StockStackParamList>();
const Tab = createBottomTabNavigator<StockTabParamList>();

const TAB_ICON: Record<keyof StockTabParamList, keyof typeof Ionicons.glyphMap> = {
  HomeTab: 'home',
  ItemsTab: 'pricetags',
  CountTab: 'clipboard',
  DeliveriesTab: 'cube',
  TransfersTab: 'swap-horizontal',
};

/** One stack per tab, so each room keeps its own history and the back button never crosses rooms. */
function stackFor(tab: keyof StockTabParamList) {
  return function TabStack() {
    const { api, branchId } = useStockSession();
    // Screens that pin an action to their foot need the bar's height, or the action sits behind it.
    const tabBarHeight = useBottomTabBarHeight();
    return (
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: MART.paper },
          headerTintColor: MART.ink,
          headerTitleStyle: { fontFamily: FONT.semibold, fontWeight: WEIGHT.semibold, fontSize: 17, color: MART.ink },
          headerLargeTitle: false,
          headerLargeTitleStyle: { fontFamily: FONT.bold, fontWeight: WEIGHT.bold, color: MART.ink },
          headerLargeTitleShadowVisible: false,
          headerShadowVisible: false,
          headerBackTitle: 'Back',
          contentStyle: { backgroundColor: MART.paper },
        }}
      >
        {tab === 'HomeTab' ? (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: false }} />
            <Stack.Screen name="StoreRoom" component={StoreRoomScreen} options={{ title: 'Store room' }} />
            <Stack.Screen name="StoreRow" component={StoreRowScreen} options={{ title: 'Store room' }} />
            <Stack.Screen name="StoreToday" component={StoreTodayScreen} options={{ title: 'Today' }} />
          </>
        ) : null}
        {tab === 'HomeTab' || tab === 'ItemsTab' ? (
          <>
            {tab === 'ItemsTab' ? (
              <Stack.Screen name="Items" component={ItemsScreen} options={{ title: 'Items' }} initialParams={{ filter: 'all' }} />
            ) : null}
            <Stack.Screen
              name="Item"
              component={ItemScreen}
              options={({ navigation: nav }) => ({
                title: 'Item',
                presentation: 'formSheet',
                sheetAllowedDetents: [0.72, 1],
                sheetInitialDetentIndex: 0,
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
                contentStyle: { backgroundColor: MART.paper },
                headerRight: () => (
                  <Pressable onPress={() => nav.goBack()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
                    <MartText variant="label" color={MART.fallbackPrimary}>
                      Close
                    </MartText>
                  </Pressable>
                ),
              })}
            />
            <Stack.Screen name="SetStock" component={SetStockRoute} options={{ title: 'Set stock' }} />
            <Stack.Screen name="WriteOff" component={WriteOffRoute} options={{ title: 'Write off' }} />
          </>
        ) : null}
        {tab === 'CountTab' ? (
          <>
            <Stack.Screen name="StockTake" component={StockTakeScreen} options={{ title: 'Stock take' }} />
            <Stack.Screen name="FullCount" component={FullCountScreen} options={{ title: 'Count in batches' }} />
            <Stack.Screen name="BatchCount" component={BatchCountScreen} options={{ title: 'Count batch' }} />
            <Stack.Screen name="BatchReview" component={BatchReviewScreen} options={{ title: 'Review batch' }} />
          </>
        ) : null}
        {tab === 'DeliveriesTab' ? (
          <>
            <Stack.Screen name="Batches" component={SupplyBatchesScreen} options={{ title: 'Deliveries' }} />
            <Stack.Screen name="Batch" component={SupplyBatchScreen} options={{ title: 'Delivery' }} />
            <Stack.Screen name="Orders" options={{ title: 'Order portal' }}>
              {(props) => <OrdersScreen {...props} api={api} branchId={branchId} />}
            </Stack.Screen>
            <Stack.Screen name="Receive" options={{ title: 'Receive orders' }}>
              {(props) => (
                <ReceiveScreen
                  {...props}
                  api={api}
                  onOpenOrder={(purchaseOrderId) => props.navigation.navigate('ReceiveOrder', { purchaseOrderId })}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="ReceiveOrder" options={{ title: 'Confirm receipt' }}>
              {(props) => (
                <ReceiveOrderScreen
                  {...props}
                  api={api}
                  branchId={branchId}
                  purchaseOrderId={props.route.params.purchaseOrderId}
                  bottomInset={tabBarHeight}
                  onDone={() => props.navigation.goBack()}
                />
              )}
            </Stack.Screen>
          </>
        ) : null}
        {tab === 'TransfersTab' ? (
          <>
            <Stack.Screen name="Transfers" component={TransfersScreen} options={{ title: 'Transfers' }} />
            <Stack.Screen name="Transfer" component={TransferScreen} options={{ title: 'Transfer' }} />
            <Stack.Screen name="NewTransfer" component={NewTransferScreen} options={{ title: 'New transfer' }} />
          </>
        ) : null}
      </Stack.Navigator>
    );
  };
}

/**
 * The five rooms a stockkeeper works in: the shelf's health, the catalogue, counting, what suppliers sent, and moves
 * between branches. The bar is the same one the till and the counter wear, so the whole product reads as one.
 */
export function AppNavigator() {
  // The bar sits above the home indicator rather than under it: a cut-off bar is a broken bar.
  const insets = useSafeAreaInsets();
  const barHeight = 56 + Math.max(insets.bottom, 8);
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: MART.fallbackPrimary,
          tabBarInactiveTintColor: MART.inkQuiet,
          tabBarStyle: [styles.bar, { height: barHeight, paddingBottom: Math.max(insets.bottom, 8) }],
          tabBarLabelStyle: styles.barLabel,
          tabBarIcon: ({ color, size, focused }) => {
            const base = TAB_ICON[route.name as keyof StockTabParamList];
            const name = (focused ? base : `${base}-outline`) as keyof typeof Ionicons.glyphMap;
            return (
              <View style={[styles.iconWrap, focused && styles.iconWrapOn]}>
                <Ionicons name={name} size={(size ?? 22) - 2} color={focused ? MART.paper : color} />
              </View>
            );
          },
        })}
      >
        <Tab.Screen name="HomeTab" component={stackFor('HomeTab')} options={{ title: 'Home' }} />
        <Tab.Screen name="ItemsTab" component={stackFor('ItemsTab')} options={{ title: 'Items' }} />
        <Tab.Screen name="CountTab" component={stackFor('CountTab')} options={{ title: 'Count' }} />
        <Tab.Screen name="DeliveriesTab" component={stackFor('DeliveriesTab')} options={{ title: 'Deliveries' }} />
        <Tab.Screen name="TransfersTab" component={stackFor('TransfersTab')} options={{ title: 'Transfers' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: MART.paperElevated,
    borderTopColor: MART.border,
    paddingTop: 8,
  },
  barLabel: { fontFamily: FONT.medium, fontWeight: WEIGHT.medium, fontSize: 11 },
  iconWrap: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  iconWrapOn: { backgroundColor: MART.fallbackPrimary },
});
