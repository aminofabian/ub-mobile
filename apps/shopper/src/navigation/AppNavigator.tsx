import React from 'react';
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

export type RootStackParamList = {
  MainTabs: undefined;
  ProductDetail: { itemId: string };
  Category: { categoryId: string; categoryName: string };
  Search: undefined;
  Checkout: undefined;
  Payment: { orderId: string; grandTotal: number; currency: string; customerPhone: string };
  OrderConfirmation: { orderId: string };
  OrderDetail: { orderId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen
          name="ProductDetail"
          component={ProductDetailScreen}
          options={{ headerShown: true, title: 'Product' }}
        />
        <Stack.Screen
          name="Category"
          component={CategoryScreen}
          options={{ headerShown: true, title: 'Category' }}
        />
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ headerShown: true, title: 'Search' }}
        />
        <Stack.Screen
          name="Checkout"
          component={CheckoutScreen}
          options={{ headerShown: true, title: 'Checkout' }}
        />
        <Stack.Screen
          name="Payment"
          component={PaymentScreen}
          options={{ headerShown: true, title: 'Payment' }}
        />
        <Stack.Screen
          name="OrderConfirmation"
          component={OrderConfirmationScreen}
          options={{ headerShown: true, title: 'Order Confirmed', headerBackVisible: false }}
        />
        <Stack.Screen
          name="OrderDetail"
          component={OrderDetailScreen}
          options={{ headerShown: true, title: 'Order Detail' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
