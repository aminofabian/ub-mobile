import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Cart: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  ProductDetail: { itemId: string };
  Category: { categoryId: string; categoryName: string; categoryIcon?: string | null };
  Search: undefined;
  Checkout: undefined;
  Payment: { orderId: string; grandTotal: number; currency: string; customerPhone: string };
  OrderConfirmation: { orderId: string };
  OrderDetail: { orderId: string };
  Airtime: undefined;
  Kplc: undefined;
};
