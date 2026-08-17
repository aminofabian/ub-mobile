import { useQuery } from '@tanstack/react-query';
import { fetchPaymentStatus } from '../api/storefront';

export function usePaymentStatus(
  slug: string | undefined,
  orderId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: ['paymentStatus', slug, orderId],
    queryFn: () => fetchPaymentStatus(slug!, orderId!),
    enabled: !!slug && !!orderId && enabled,
    refetchInterval: enabled ? 3000 : false,
  });
}
