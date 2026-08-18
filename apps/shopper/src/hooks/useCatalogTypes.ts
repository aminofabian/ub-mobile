import { useQuery } from '@tanstack/react-query';
import { fetchCatalogTypes } from '../api/storefront';

export function useCatalogTypes(slug: string | undefined) {
  return useQuery({
    queryKey: ['catalog-types', slug],
    queryFn: () => fetchCatalogTypes(slug!),
    enabled: !!slug,
  });
}
