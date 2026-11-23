import AsyncStorage from '@react-native-async-storage/async-storage';
import { ordersKey } from './shop-storage';

export interface StoredOrder {
  orderId: string;
  slug: string;
  grandTotal: number;
  currency: string;
  customerPhone: string;
  createdAt: string;
}

export async function addOrder(order: StoredOrder): Promise<void> {
  const existing = await getOrders(order.slug);
  const filtered = existing.filter((o) => o.orderId !== order.orderId);
  const next = [order, ...filtered].slice(0, 50);
  await AsyncStorage.setItem(ordersKey(order.slug), JSON.stringify(next));
}

export async function getOrders(slug: string): Promise<StoredOrder[]> {
  const raw = await AsyncStorage.getItem(ordersKey(slug));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredOrder[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearOrders(slug: string): Promise<void> {
  await AsyncStorage.removeItem(ordersKey(slug));
}
