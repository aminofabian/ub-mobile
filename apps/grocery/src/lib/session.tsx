import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  counterModes,
  DEFAULT_STOCK_SETTINGS,
  mayOrderAtCounter,
  maySellAtCounter,
  type CounterMode,
  type StaffUser,
  type StockSettings,
} from '@kiosk/core';
import type { ScannerRenderer, StaffSession } from '@kiosk/staff';
import { fetchStockSettings } from '../api/grocery-api';

/** The signed-in person at one branch's grocery counter, and which jobs the shop lets them do. Every screen reads it from here. */
export type GrocerySession = {
  api: StaffSession['api'];
  tenantId: string;
  /** Shop name for receipts and headers. */
  shopName: string;
  userId: string;
  user: StaffUser;
  /** Clerk's display name for the department-invoice slip. */
  clerkName: string | null;
  branchId: string;
  branchName: string | null;
  signOut: StaffSession['signOut'];
  /** Whether this person may sell — build a basket and forward it to the till. A stock-only clerk cannot. */
  maySell: boolean;
  /** Whether this person may place Path A supplier orders (web Order pad). */
  mayOrder: boolean;
  /** Selling, and Spoils and Edit stock when this person may do them and the shop has not switched them off. */
  modes: CounterMode[];
  /** The shop's switches have been asked for (an answer or a failure): until then the modes may still change. */
  settingsReady: boolean;
  /** Draws the camera that reads item barcodes. Absent when the phone has no camera module. */
  renderScanner: ScannerRenderer | undefined;
};

const Context = createContext<GrocerySession | null>(null);

export function GrocerySessionProvider({ session, renderScanner, children }: { session: StaffSession; renderScanner?: ScannerRenderer; children: React.ReactNode }) {
  const { api, tenant, user, branchId, branchName, signOut } = session;
  const [settings, setSettings] = useState<StockSettings>(DEFAULT_STOCK_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    let live = true;
    fetchStockSettings(api).then(
      (result) => {
        if (!live) return;
        setSettings(result);
        setSettingsReady(true);
      },
      () => {
        // The shop's switches could not be read: both jobs stay on, as the web does, and the server still refuses what is not allowed.
        if (live) setSettingsReady(true);
      }
    );
    return () => {
      live = false;
    };
  }, [api]);

  const value = useMemo<GrocerySession>(
    () => ({
      api,
      tenantId: tenant.businessId,
      shopName: tenant.displayName,
      userId: user.id,
      user,
      clerkName: user.name?.trim() || null,
      branchId,
      branchName,
      signOut,
      maySell: maySellAtCounter(user),
      mayOrder: mayOrderAtCounter(user, settings),
      modes: counterModes(user, settings),
      settingsReady,
      renderScanner,
    }),
    [api, tenant.businessId, tenant.displayName, user, branchId, branchName, signOut, settings, settingsReady, renderScanner]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useGrocerySession(): GrocerySession {
  const value = useContext(Context);
  if (!value) throw new Error('useGrocerySession was used outside GrocerySessionProvider.');
  return value;
}
