import { useQuery } from '@tanstack/react-query';
import { fetchItems } from '../api/storefront';

export function useItems(
  slug: string | undefined,
  options: {
    categoryId?: string;
    typeId?: string;
    cursor?: string;
    limit?: number;
    search?: string;
  } = {}
) {
  return useQuery({
    queryKey: ['items', slug, options],
    queryFn: () => fetchItems(slug!, options),
    enabled: !!slug,
  });
}
