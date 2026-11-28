import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { pinnedTo } from '@kiosk/core';
import { useFlushLoop, useKept } from '@kiosk/staff';
import { fetchTake, sendCount } from '../api/stock-api';
import { createCountSender, type SendReport } from './count-sender';
import { useStockSession } from './session';
import { heldBy, mergeFresh } from './stock-take';
import { takeKeeperFor } from './take-store';

type Sending = { flush: () => Promise<SendReport> };

const Context = createContext<Sending | null>(null);

/**
 * Sends the counts typed on this phone, for as long as the app is open: when a count is typed, every half minute, and
 * whenever the app comes back to the front. It lives above every screen, so a count typed at the shelf with no signal
 * goes out on its own once the phone is back in range, wherever the person happens to be in the app. Only the person who
 * typed a count, at the branch it was typed for, ever sends it: the server records a count as the signed-in person's.
 */
export function CountSenderProvider({ children }: { children: React.ReactNode }) {
  const { api, tenantId, userId, branchId } = useStockSession();
  const keeper = useMemo(() => takeKeeperFor(tenantId), [tenantId]);
  const kept = useKept(keeper);
  // Counts go out through a client pinned to this shop: with another shop made the active one, a count still on its way
  // is not sent with their session.
  const client = useMemo(() => pinnedTo(api, tenantId), [api, tenantId]);

  const { sender, gate } = useMemo(() => {
    // Open while this sender belongs to the signed-in person and the screen is up; closed the moment it does not.
    const gate = { open: false };
    const sender = createCountSender({
      // Only counts for the stock take at this branch, typed by this person, go out. Counts left from another branch
      // or another person wait for them.
      read: () => {
        if (!keeper.isLoaded()) return null;
        const copy = keeper.get();
        return copy && copy.take.branchId === branchId && heldBy(copy, branchId, userId) === null ? copy : null;
      },
      change: (change) => {
        if (!keeper.isLoaded()) return;
        keeper.update((current) => (current && current.take.branchId === branchId && heldBy(current, branchId, userId) === null ? change(current) : current));
      },
      send: (sessionId, lineId, units) => sendCount(client, sessionId, lineId, units),
      // After a 409, read the stock take again so each refused count can say why (closed, or confirmed by a manager).
      explain: async () => {
        const copy = keeper.isLoaded() ? keeper.get() : null;
        if (!copy) return;
        const fresh = await fetchTake(client, copy.take.id);
        if (fresh) keeper.update((current) => (current ? mergeFresh(current, fresh, Date.now()).copy : current));
      },
      live: () => gate.open,
    });
    return { sender, gate };
  }, [client, keeper, branchId, userId]);

  // Before the loop below, so that its first pass finds the gate open.
  useEffect(() => {
    gate.open = true;
    return () => {
      gate.open = false;
    };
  }, [gate]);

  useFlushLoop(sender.flush, { enabled: kept.ready });

  const value = useMemo<Sending>(() => ({ flush: sender.flush }), [sender]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCountSender(): Sending {
  const value = useContext(Context);
  if (!value) throw new Error('useCountSender was used outside CountSenderProvider.');
  return value;
}
