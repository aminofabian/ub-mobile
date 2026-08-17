import { useQuery } from '@tanstack/react-query';
import { fetchPaymentOptions } from '../api/storefront';

export function usePaymentOptions(slug: string | undefined) {
  return useQuery({
    queryKey: ['paymentOptions', slug],
    queryFn: () => fetchPaymentOptions(slug!),
    enabled: !!slug,
  });
}
