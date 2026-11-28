import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { mayCloseStockTake, mayCountStock, mayMoveStock, stockAppMayWrite, stockManagerMayEdit } from '@kiosk/core';
import type { ScannerRenderer, StaffSession } from '@kiosk/staff';

/** The signed-in person at one branch, and what they may do in this app. Every screen reads it from here. */
export type StockSession = {
  api: StaffSession['api'];
  tenantId: string;
  /** The shop's own name, for the dashboard hero. */
  shopName: string;
  userId: string;
  branchId: string;
  branchName: string | null;
  signOut: StaffSession['signOut'];
  mayWrite: boolean;
  /** `catalog.items.write`. A local store-room note accepts this or {@link mayWrite}. */
  mayCatalog: boolean;
  mayCount: boolean;
  mayClose: boolean;
  mayMove: boolean;
  /** Draws the camera that reads item barcodes. Absent when the phone has no camera module. */
  renderScanner: ScannerRenderer | undefined;
};

const Context = createContext<StockSession | null>(null);

export function StockSessionProvider({ session, renderScanner, children }: { session: StaffSession; renderScanner?: ScannerRenderer; children: React.ReactNode }) {
  const { api, tenant, user, branchId, branchName, signOut } = session;
  // On until the shop says otherwise. A failed read must not hide Set stock from a stock manager.
  const [managerMayEdit, setManagerMayEdit] = useState(true);
  useEffect(() => {
    let live = true;
    void api
      .get<unknown>('/api/v1/businesses/me')
      .then((body) => {
        if (live) setManagerMayEdit(stockManagerMayEdit(body));
      })
      .catch(() => {
        if (live) setManagerMayEdit(true);
      });
    return () => {
      live = false;
    };
  }, [api]);
  const value = useMemo<StockSession>(
    () => ({
      api,
      tenantId: tenant.businessId,
      shopName: tenant.displayName,
      userId: user.id,
      branchId,
      branchName,
      signOut,
      mayWrite: stockAppMayWrite(user, managerMayEdit),
      mayCatalog: user.permissions.includes('catalog.items.write'),
      mayCount: mayCountStock(user),
      mayClose: mayCloseStockTake(user),
      mayMove: mayMoveStock(user),
      renderScanner,
    }),
    [api, tenant.businessId, tenant.displayName, user, branchId, branchName, signOut, renderScanner, managerMayEdit]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useStockSession(): StockSession {
  const value = useContext(Context);
  if (!value) throw new Error('useStockSession was used outside StockSessionProvider.');
  return value;
}
