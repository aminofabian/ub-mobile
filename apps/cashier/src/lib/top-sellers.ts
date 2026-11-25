import { readTenantValue, writeTenantValue } from '@kiosk/core';

/**
 * A running tally, kept on the phone, of which products this till reaches for most — so the grid can
 * lead with the shop's real best-sellers instead of whatever happens to sort first by name. Every
 * time an item goes into the basket its count goes up; the grid then shows the top sellers first,
 * the same idea as the web till's "Top 24 best sellers". A shop with thousands of products never has
 * to scroll to find the twenty it actually sells all day.
 *
 * It is a convenience signal, not a ledger: it lives only on this phone, per shop, and is capped so
 * it cannot grow without bound. Losing it costs nothing — the next few sales rebuild it.
 */

/** item id → how many times it has been added, and when last. */
type Tally = Record<string, { n: number; at: number }>;

/** Keep at most this many items in the tally; the least-recently-used fall off. */
const MAX_TRACKED = 300;

const memory = new Map<string, Tally>();

function keyOf(tenantId: string): string {
  return tenantId;
}

/** Load the tally for a shop into memory (once per session is enough; cheap to repeat). */
export async function loadTopSellers(tenantId: string): Promise<void> {
  if (memory.has(keyOf(tenantId))) return;
  try {
    const raw = await readTenantValue('topSellers', tenantId);
    memory.set(keyOf(tenantId), raw ? (JSON.parse(raw) as Tally) : {});
  } catch {
    memory.set(keyOf(tenantId), {});
  }
}

function tallyFor(tenantId: string): Tally {
  let t = memory.get(keyOf(tenantId));
  if (!t) {
    t = {};
    memory.set(keyOf(tenantId), t);
  }
  return t;
}

/** Record that an item was reached for. Fire-and-forget; a phone that cannot save it still sorts in memory. */
export function recordSellerUse(tenantId: string, itemId: string): void {
  if (!itemId) return;
  const t = tallyFor(tenantId);
  const now = Date.now();
  t[itemId] = { n: (t[itemId]?.n ?? 0) + 1, at: now };

  // Trim to the most-used/most-recent when it grows too large.
  const ids = Object.keys(t);
  if (ids.length > MAX_TRACKED) {
    ids
      .sort((a, b) => (t[a].n - t[b].n) || (t[a].at - t[b].at))
      .slice(0, ids.length - MAX_TRACKED)
      .forEach((id) => delete t[id]);
  }
  void writeTenantValue('topSellers', JSON.stringify(t), tenantId).catch(() => undefined);
}

/** How strongly an item sells, for ordering (0 when never reached for). Higher leads. */
export function sellerRank(tenantId: string, itemId: string): number {
  const entry = tallyFor(tenantId)[itemId];
  return entry ? entry.n : 0;
}

/**
 * Put the best-sellers first, keeping the server's order among items that tie (so a shop with no
 * history yet is simply left as the server sent it). Stable: never shuffles equals.
 */
export function byTopSellers<T extends { id: string }>(tenantId: string, items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index, rank: sellerRank(tenantId, item.id) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .map((x) => x.item);
}
