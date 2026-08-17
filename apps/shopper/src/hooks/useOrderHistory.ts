import { useQuery } from '@tanstack/react-query';
import { getOrders, type StoredOrder } from '../lib/orderHistory';

export function useOrderHistory(slug: string | undefined) {
  return useQuery<StoredOrder[], Error>({
    queryKey: ['orderHistory', slug],
    queryFn: () => getOrders(slug!),
    enabled: !!slug,
  });
}
