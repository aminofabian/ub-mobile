import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '../api/storefront';

export function useCategories(slug: string | undefined) {
  return useQuery({
    queryKey: ['categories', slug],
    queryFn: () => fetchCategories(slug!),
    enabled: !!slug,
  });
}
