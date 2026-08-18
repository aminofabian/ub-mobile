import { useQuery } from '@tanstack/react-query';
import { fetchAirtimeConfig } from '../api/storefront';

export function useAirtimeConfig(slug: string | undefined) {
  return useQuery({
    queryKey: ['airtime-config', slug],
    queryFn: () => fetchAirtimeConfig(slug!),
    enabled: !!slug,
  });
}
