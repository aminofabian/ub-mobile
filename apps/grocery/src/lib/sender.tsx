import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { pinnedTo } from '@kiosk/core';
import { useFlushLoop, useKept } from '@kiosk/staff';
import { cancelDraft, issueDraft, listOpenDrafts, makeDraft, readDraft } from '../api/grocery-api';
import { usePrinter } from '../store/printer-store';
import { forwardKeeperFor } from '../store/invoice-store';
import { createForwardSender, type ForwardReport } from './forward-sender';
import { prune } from './forward';
import { printForwardedInvoice } from './print-forwarded';
import { useGrocerySession } from './session';
import { pullAndPrintTillSlips } from './till-print-listener';

type Sending = { flush: () => Promise<ForwardReport> };

const Context = createContext<Sending | null>(null);

/**
 * Sends the sales waiting on this phone to the cashier, for as long as the app is open: when one is queued, every half
 * minute, and whenever the app comes back to the front. It lives above every screen, so a sale rung up where there was
 * no signal goes out on its own once the phone is back in range. Only the person who made a sale ever sends it.
 * After a successful issue it prints a department-invoice slip when a printer is paired (same as web `/clerk`).
 */
export function ForwardSenderProvider({ children }: { children: React.ReactNode }) {
  const { api, tenantId, userId, shopName, branchName, clerkName } = useGrocerySession();
  const keeper = useMemo(() => forwardKeeperFor(tenantId), [tenantId]);
  const kept = useKept(keeper);
  // Sales go out through a client pinned to this shop: with another shop made the active one, or another person signed
  // in, a sale still on its way is not sent with their session.
  const client = useMemo(() => pinnedTo(api, tenantId), [api, tenantId]);

  useEffect(() => {
    void usePrinter.getState().load(tenantId);
  }, [tenantId]);

  // Remote order slips targeted at this clerk (same as web CashierTillPrintListener).
  useEffect(() => {
    const tick = () => {
      void pullAndPrintTillSlips(api);
    };
    tick();
    const timer = setInterval(tick, 5_000);
    return () => clearInterval(timer);
  }, [api]);

  const { sender, gate } = useMemo(() => {
    // Open while this sender belongs to the signed-in person and the screen is up; closed the moment it does not.
    const gate = { open: false };
    const shop = { shopName, branchName, clerkName };
    const sender = createForwardSender({
      ownerId: userId,
      read: () => (keeper.isLoaded() ? keeper.get() : null),
      change: (change) => {
        if (keeper.isLoaded()) keeper.update(change);
      },
      makeDraft: (entry) => makeDraft(client, entry),
      issue: (entry) => issueDraft(client, entry),
      openDrafts: {
        list: (entry) => listOpenDrafts(client, entry),
        read: (draftId) => readDraft(client, draftId),
        cancel: (draftId) => cancelDraft(client, draftId),
      },
      // A request goes out only once the note that it is going has been written to the phone.
      saved: () => keeper.saved(),
      live: () => gate.open,
      onIssued: (entry, result) => printForwardedInvoice(entry, result, shop),
    });
    return { sender, gate };
  }, [client, keeper, userId, shopName, branchName, clerkName]);

  // Before the loop below, so that its first pass finds the gate open.
  useEffect(() => {
    gate.open = true;
    return () => {
      gate.open = false;
    };
  }, [gate]);

  useFlushLoop(sender.flush, { enabled: kept.ready });

  // Old sent sales are let go (never an unsent one).
  useEffect(() => {
    if (kept.ready) keeper.update((state) => prune(state, Date.now()));
  }, [kept.ready, keeper]);

  const value = useMemo<Sending>(() => ({ flush: sender.flush }), [sender]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useForwardSender(): Sending {
  const value = useContext(Context);
  if (!value) throw new Error('useForwardSender was used outside ForwardSenderProvider.');
  return value;
}
