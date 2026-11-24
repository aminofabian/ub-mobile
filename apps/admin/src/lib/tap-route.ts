import type { OwnerTab } from './owner-access';

/**
 * Where a tap on a push notification goes. The pushes the server sends today carry a title and a body and nothing else,
 * so a tap opens Today, which shows everything the owner would want to see. When the server adds a `kind` (or `type`)
 * to what it sends, the tap goes to the matching tab instead: web orders to Orders, stock alerts to Stock, credit
 * reminders to Credit. A kind this app does not know opens Today; a tap never fails.
 */
export function tapTab(data: unknown): Exclude<OwnerTab, 'More'> {
  if (!data || typeof data !== 'object') return 'Today';
  const row = data as Record<string, unknown>;
  const raw = typeof row.kind === 'string' ? row.kind : typeof row.type === 'string' ? row.type : '';
  const kind = raw.trim().toLowerCase();
  if (kind.startsWith('web_order') || kind === 'order' || kind === 'orders') return 'Orders';
  if (kind.startsWith('stock') || kind.startsWith('restock')) return 'Stock';
  if (kind.startsWith('credit') || kind === 'tab' || kind === 'tabs' || kind.startsWith('tab_')) return 'Credit';
  return 'Today';
}
