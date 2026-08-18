export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Cart: undefined;
  Account: undefined;
};

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
