import { tenantKeeper, type Keeper } from '@kiosk/core';
import { decodeCopy, encodeCopy, type TakeCopy } from './stock-take';

/**
 * The stock take as this phone holds it, kept per shop. The same keeper is handed to every screen that asks, so the
 * Dashboard's "counts not sent" and the Stock take screen always agree.
 */
export function takeKeeperFor(tenantId: string): Keeper<TakeCopy | null> {
  return tenantKeeper<TakeCopy | null>('stockTake', tenantId, {
    initial: null,
    parse: (text, now) => decodeCopy(text, now),
    serialize: (copy) => encodeCopy(copy),
  });
}

/** How many counts are typed on this phone and not yet taken by the server. */
export function unsentCount(copy: TakeCopy | null): number {
  return copy ? Object.keys(copy.pending).length : 0;
}

/** The supplier a count was last held to, and the take it belonged to. */
export type TakeScope = { takeId: string; supplierId: string; name: string };

/**
 * The supplier scope, kept per shop beside the take itself.
 *
 * A supplier walk is several minutes of counting and often several trips to the shelf; leaving the screen (or the app)
 * should not drop you back into the whole catalogue. It is tied to a take id, so a scope from yesterday's count is never
 * applied to today's.
 */
export function scopeKeeperFor(tenantId: string): Keeper<TakeScope | null> {
  return tenantKeeper<TakeScope | null>('stockScope', tenantId, {
    initial: null,
    parse: (text) => {
      if (!text) return null;
      try {
        const raw = JSON.parse(text) as Record<string, unknown>;
        if (typeof raw.takeId !== 'string' || typeof raw.supplierId !== 'string' || typeof raw.name !== 'string') return null;
        return { takeId: raw.takeId, supplierId: raw.supplierId, name: raw.name.slice(0, 60) };
      } catch {
        return null;
      }
    },
    serialize: (scope) => (scope ? JSON.stringify(scope) : null),
  });
}
