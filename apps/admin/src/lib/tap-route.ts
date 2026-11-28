import type { OwnerTab } from './owner-access';

/**
 * Where a tap on a push notification goes. A notice carries a `kind`: a web order opens Orders, supplies and stock open Stock, a credit payment opens Credit. A shift, a void, or a sales step opens Today. A kind this app does not know opens Today too. A tap never fails.
 */
export function tapTab(data: unknown): Exclude<OwnerTab, 'More'> {
  if (!data || typeof data !== 'object') return 'Today';
  const row = data as Record<string, unknown>;
  const raw = typeof row.kind === 'string' ? row.kind : typeof row.type === 'string' ? row.type : '';
  const kind = raw.trim().toLowerCase();
  if (kind.startsWith('web_order') || kind.startsWith('storefront.order') || kind.startsWith('order.') || kind === 'order' || kind === 'orders') return 'Orders';
  if (kind.startsWith('stock') || kind.startsWith('restock') || kind.startsWith('supply')) return 'Stock';
  if (kind.startsWith('credit') || kind === 'tab' || kind === 'tabs' || kind.startsWith('tab_')) return 'Credit';
  return 'Today';
}
