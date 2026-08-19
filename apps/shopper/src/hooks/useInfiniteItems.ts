import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchItems } from '../api/storefront';

const PAGE_SIZE = 24;

export function useInfiniteItems(
  slug: string | undefined,
  options: { categoryId?: string; typeId?: string; search?: string } = {},
  enabled = true
) {
  const query = useInfiniteQuery({
    queryKey: ['items-infinite', slug, options.categoryId, options.typeId, options.search],
    queryFn: ({ pageParam }) =>
      fetchItems(slug!, {
        categoryId: options.categoryId,
        typeId: options.typeId,
        search: options.search,
        cursor: pageParam,
        limit: PAGE_SIZE,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor?.trim() || undefined,
    enabled: !!slug && enabled,
  });

  const items = query.data?.pages.flatMap((page) => page.items ?? []) ?? [];
  const currency = query.data?.pages[0]?.currency;
  const totalCount = query.data?.pages[0]?.totalCount ?? null;

  return {
    ...query,
    items,
    currency,
    totalCount,
  };
}
