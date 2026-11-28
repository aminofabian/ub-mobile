import { useCallback, useEffect, useRef, useState } from 'react';
import { ITEM_PAGE_SIZE, itemsPath, readItemsPage, searchTerms, type ApiClient, type StockItem } from '@kiosk/core';

export type ItemSearchFailure = 'network' | 'unreadable';

export type ItemSearch = {
  query: string;
  setQuery: (text: string) => void;
  items: StockItem[];
  loading: boolean;
  failed: ItemSearchFailure | null;
  total: number | null;
  more: boolean;
  loadMore: () => void;
  reload: () => void;
  /** Looks one scanned code up now. The items the server found, or null when it could not be asked or did not make sense. */
  lookup: (barcode: string) => Promise<StockItem[] | null>;
};

const TYPING_PAUSE_MS = 350;

/** One of each product, the first the server listed, in order. */
function oneOfEach(items: StockItem[]): StockItem[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

/**
 * The items of one branch, by name, code or barcode, a page at a time. Answers that arrive after a newer question was
 * asked are ignored, so a slow answer to "su" never replaces the answer to "sugar". A failed read says so; it never shows
 * as "no items".
 */
export function useItemSearch(
  api: ApiClient,
  branchId: string,
  options: { lowStock?: boolean; zeroStock?: boolean; /** Narrow to one category or department. */ categoryId?: string; /** Narrow to one department (an item type). */ itemTypeId?: string; /** Ask nothing until something is typed. */ idle?: boolean } = {}
): ItemSearch {
  const { lowStock, zeroStock, categoryId, itemTypeId, idle } = options;
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<ItemSearchFailure | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  const page = useRef(0);

  const run = useCallback(
    async (wanted: number, append: boolean) => {
      const mine = ++sequence.current;
      setLoading(true);
      try {
        const terms = searchTerms(query);
        const path = itemsPath({
          branchId,
          ...(terms ?? {}),
          ...(categoryId ? { categoryId } : {}),
          ...(itemTypeId ? { itemTypeId } : {}),
          ...(lowStock ? { lowStock } : {}),
          ...(zeroStock ? { zeroStock } : {}),
          page: wanted,
        });
        const raw = await api.get<unknown>(path);
        if (mine !== sequence.current) return;
        const result = readItemsPage(raw, { page: wanted, size: ITEM_PAGE_SIZE });
        if (!result) {
          setFailed('unreadable');
          return;
        }
        page.current = wanted;
        setItems((before) => {
          if (!append) return oneOfEach(result.items);
          const known = new Set(before.map((item) => item.id));
          return [...before, ...result.items.filter((item) => !known.has(item.id))];
        });
        setMore(result.more);
        setTotal(result.total);
        setFailed(null);
      } catch {
        if (mine === sequence.current) setFailed('network');
      } finally {
        if (mine === sequence.current) setLoading(false);
      }
    },
    [api, branchId, query, lowStock, zeroStock, categoryId, itemTypeId]
  );

  useEffect(() => {
    if (idle && searchTerms(query) === null) {
      sequence.current += 1;
      setItems([]);
      setMore(false);
      setTotal(null);
      setFailed(null);
      setLoading(false);
      return undefined;
    }
    const timer = setTimeout(() => void run(0, false), query ? TYPING_PAUSE_MS : 0);
    return () => clearTimeout(timer);
  }, [run, idle, query, version]);

  const loadMore = useCallback(() => {
    if (more && !loading && failed === null) void run(page.current + 1, true);
  }, [more, loading, failed, run]);

  const reload = useCallback(() => setVersion((n) => n + 1), []);

  const lookup = useCallback(
    async (barcode: string): Promise<StockItem[] | null> => {
      const terms = searchTerms(barcode);
      if (!terms) return null;
      try {
        // Six to fourteen digits is a barcode; any other code a scanner reads (a shop's own labels) is looked up as text.
        const raw = await api.get<unknown>(itemsPath({ branchId, ...terms, size: 5 }));
        return readItemsPage(raw, { page: 0, size: 5 })?.items ?? null;
      } catch {
        return null;
      }
    },
    [api, branchId]
  );

  return { query, setQuery, items, loading, failed, total, more, loadMore, reload, lookup };
}
