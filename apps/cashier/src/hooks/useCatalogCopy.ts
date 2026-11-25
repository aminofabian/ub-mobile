import { useSyncExternalStore } from 'react';
import type { CatalogCopy, CopyState } from '../lib/catalog-copy';

/** What the phone's copy of the price list is doing, kept current as it is read, made, kept or fails. */
export function useCatalogCopy(copy: CatalogCopy): CopyState {
  return useSyncExternalStore(copy.subscribe, copy.state, copy.state);
}
