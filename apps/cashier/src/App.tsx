import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Share } from 'react-native';
import { QrScanner } from '@kiosk/barcode';
import { StaffShell, useAuthStore, type PairScannerRenderer, type StaffSession } from '@kiosk/staff';
import { createSyncEngine, exportOutbox } from '@kiosk/offline';
import { createRealtimeClient } from '@kiosk/realtime';
import { AppNavigator } from './navigation/AppNavigator';
import { API_BASE_URL } from './lib/config';
import { cartOwnerKey } from './lib/cart-owner';
import type { TillPerson } from './lib/till-person';
import { confirmExport } from './lib/confirm-export';
import { usePosStore } from './store/pos-store';

// Drawn only when the person chooses to scan a pairing QR: the camera is asked for then, not at start.
const renderScanner: PairScannerRenderer = (props) => <QrScanner {...props} />;

/** Hands the sales that were never sent to the share sheet, as text the person can keep or send to support. */
async function exportUnsent(): Promise<void> {
  // The copy can be sent to any app on the phone, so the person is told what it holds first.
  if (!(await confirmExport())) return;
  const text = await exportOutbox(useAuthStore.getState().tenant?.businessId);
  await Share.share({ title: 'Unsent sales', message: text });
}

/** The till itself: sends queued sales and listens for live updates while a person is signed in. */
function Till({ session }: { session: StaffSession }) {
  const { api, tenant, branchId, shiftsDisabled, user, signOut } = session;
  const person = useMemo<TillPerson>(
    () => ({ userId: user.id, name: user.name, permissions: user.permissions }),
    [user.id, user.name, user.permissions]
  );

  // The phone is shared, and the cart lives in memory for as long as the app runs. Before any screen reads it, drop
  // whatever someone else (or another branch) left; the same person coming back keeps the sale they were ringing.
  const owner = cartOwnerKey({ shop: tenant.slug, branchId, userId: user.id });
  useState(() => usePosStore.getState().claim(owner));
  useEffect(() => {
    usePosStore.getState().claim(owner);
  }, [owner]);

  // Signing out on purpose leaves nothing behind. Choosing to stay signed in (when asked about unsent sales) leaves
  // the cart alone.
  const leave = useCallback(async () => {
    if (await signOut()) usePosStore.getState().release();
  }, [signOut]);

  useEffect(() => {
    const sync = createSyncEngine({ api });
    sync.start();
    const realtime = createRealtimeClient(API_BASE_URL, api);
    void realtime.connect();
    return () => {
      sync.stop();
      realtime.disconnect();
    };
  }, [api]);

  return (
    <AppNavigator
      api={api}
      tenant={tenant}
      branchId={branchId}
      person={person}
      shiftsDisabled={shiftsDisabled}
      onLogout={() => void leave()}
    />
  );
}

export function App() {
  return (
    <StaffShell
      app="cashier"
      baseURL={API_BASE_URL}
      allowPassword
      isTill
      exportUnsent={exportUnsent}
      renderScanner={renderScanner}
    >
      {(session) => <Till session={session} />}
    </StaffShell>
  );
}
