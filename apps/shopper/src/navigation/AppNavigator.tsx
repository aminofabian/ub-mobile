import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { CategoryScreen } from '../screens/CategoryScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { CheckoutScreen } from '../screens/CheckoutScreen';
import { PaymentScreen } from '../screens/PaymentScreen';
import { OrderConfirmationScreen } from '../screens/OrderConfirmationScreen';
import { OrderDetailScreen } from '../screens/OrderDetailScreen';
import { AirtimeScreen } from '../screens/AirtimeScreen';
import { KplcScreen } from '../screens/KplcScreen';
import { BasketFloat } from '../components/BasketFloat';
import { MART, TYPE } from '../theme/mart';
import type { RootStackParamList } from './types';

export type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Every pushed screen shares one header, so depth is the only thing that changes. */
const SHEET_HEADER = {
  headerShown: true,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: MART.paper },
  headerTintColor: MART.ink,
  headerTitleStyle: { fontFamily: TYPE.heading.fontFamily, fontSize: TYPE.heading.fontSize, color: MART.ink },
  headerBackButtonDisplayMode: 'minimal',
} as const;

function NavigatorShell({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.shell}>
      {children}
      <BasketFloat />
    </View>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        layout={({ children }) => <NavigatorShell>{children}</NavigatorShell>}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: MART.paper } }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="ProductDetail"
          component={ProductDetailScreen}
          options={{ ...SHEET_HEADER, title: '' }}
        />
        <Stack.Screen
          name="Category"
          component={CategoryScreen}
          options={({ route }) => ({ ...SHEET_HEADER, title: route.params.categoryName })}
        />
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ ...SHEET_HEADER, title: 'Search' }}
        />
        <Stack.Screen
          name="Checkout"
          component={CheckoutScreen}
          options={{ ...SHEET_HEADER, title: 'Checkout' }}
        />
        <Stack.Screen
          name="Payment"
          component={PaymentScreen}
          options={{ ...SHEET_HEADER, title: 'Payment' }}
        />
        <Stack.Screen
          name="OrderConfirmation"
          component={OrderConfirmationScreen}
          options={{ ...SHEET_HEADER, title: 'Order placed', headerBackVisible: false }}
        />
        <Stack.Screen
          name="OrderDetail"
          component={OrderDetailScreen}
          options={{ ...SHEET_HEADER, title: 'Order' }}
        />
        <Stack.Screen
          name="Airtime"
          component={AirtimeScreen}
          options={{ ...SHEET_HEADER, title: 'Airtime' }}
        />
        <Stack.Screen
          name="Kplc"
          component={KplcScreen}
          options={{ ...SHEET_HEADER, title: 'Power tokens' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
});
