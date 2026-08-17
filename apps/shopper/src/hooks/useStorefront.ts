import { useQuery } from '@tanstack/react-query';
import { fetchStorefront } from '../api/storefront';

export function useStorefront(slug: string | undefined) {
  return useQuery({
    queryKey: ['storefront', slug],
    queryFn: () => fetchStorefront(slug!),
    enabled: !!slug,
  });
}
