import { useQuery } from '@tanstack/react-query';
import { fetchProduct } from '../api/storefront';

export function useProduct(slug: string | undefined, itemId: string | undefined) {
  return useQuery({
    queryKey: ['product', slug, itemId],
    queryFn: () => fetchProduct(slug!, itemId!),
    enabled: !!slug && !!itemId,
  });
}
