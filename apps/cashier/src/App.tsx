import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QrScanner } from '@kiosk/barcode';
import { StaffShell, type PairScannerRenderer, type StaffSession } from '@kiosk/staff';
import { createSyncEngine } from '@kiosk/offline';
import { createRealtimeClient } from '@kiosk/realtime';
import { AppNavigator } from './navigation/AppNavigator';
import { API_BASE_URL } from './lib/config';
import { boundApi, SYNC_REQUEST_WAIT_MS } from './lib/bound-api';
import { cartOwnerKey } from './lib/cart-owner';
import { exportUnsent } from './lib/export-unsent';
import { keepFlags } from './lib/flags-keeper';
import { forgetTillData } from './lib/forget-till';
import { lookAtShop } from './lib/probe';
import { PROBE_EVERY_MS, watchApi } from './lib/reach';
import type { ShopFlags } from './lib/shop-flags';
import type { TillPerson } from './lib/till-person';
import { recordSent } from './lib/till-log';
import { reachSink, useReach } from './store/reach-store';
import { usePosStore } from './store/pos-store';
import { useLiveInvoices } from './store/live-invoices-store';
import { usePrinter } from './store/printer-store';
import { alertInvoiceArrived, primeInvoiceAlert, releaseInvoiceAlert } from './lib/invoice-alert';

// Drawn only when the person chooses to scan a pairing QR: the camera is asked for then, not at start.
const renderScanner: PairScannerRenderer = (props) => <QrScanner {...props} />;

/** The till itself: sends queued sales and listens for live updates while a person is signed in. */
function Till({ session }: { session: StaffSession }) {
  const { api: shellApi, tenant, branchId, branchName, shiftsDisabled, user, signOut } = session;
  // Every call the till makes is watched, so that it finds out when the line to the shop is gone, and when it is back.
  const api = useMemo(() => watchApi(shellApi, reachSink), [shellApi]);
  const person = useMemo<TillPerson>(
    () => ({ userId: user.id, name: user.name, permissions: user.permissions }),
    [user.id, user.name, user.permissions]
  );
  const shopId = tenant.businessId;
  // Who is signed in when a sale reaches the server, which is who the server will record it under.
  const sender = useRef({ id: user.id, name: user.name });
  sender.current = { id: user.id, name: user.name };

  // The phone is shared, and the cart lives in memory for as long as the app runs. Before any screen reads it, drop
  // whatever someone else (or another branch) left; the same person coming back keeps the sale they were ringing.
  const owner = cartOwnerKey({ shop: tenant.slug, branchId, userId: user.id });
  useState(() => usePosStore.getState().claim(owner));
  useEffect(() => {
    usePosStore.getState().claim(owner);
  }, [owner]);

  // Read the printer this till was paired with and reconnect quietly, so the first receipt of the day
  // prints without the cashier opening settings.
  useEffect(() => {
    void usePrinter.getState().load(tenant.businessId);
  }, [tenant.businessId]);

  // Signing out on purpose leaves nothing behind. Choosing to stay signed in (when asked about unsent sales) leaves
  // the cart alone.
  const leave = useCallback(async () => {
    if (await signOut()) {
      usePosStore.getState().release();
      // The next person at this till starts with a clean bell, not the last cashier's invoices.
      useLiveInvoices.getState().clear();
      releaseInvoiceAlert();
    }
  }, [signOut]);

  // A request that never answers must not hold up the sales behind it: the engine waits a while and moves on.
  const sync = useMemo(
    () =>
      createSyncEngine({
        api: boundApi(api, SYNC_REQUEST_WAIT_MS, reachSink),
        // What the till writes down about a sale that was sent after the customer had gone: a total the server worked
        // out differently, a code nobody has checked, and a different person signed in than the one who rang it.
        onSynced: (item, response) => {
          void recordSent(shopId, item, response, sender.current, Date.now());
        },
      }),
    [api, shopId]
  );
  useEffect(() => {
    sync.start();
    // The till also listens on the grocery channel: that is where a clerk's forwarded counter
    // invoice arrives (grocery.invoice.created). primeInvoiceAlert warms the chime player so the
    // first ring is instant.
    primeInvoiceAlert();
    const realtime = createRealtimeClient(API_BASE_URL, api, {
      channels: ['notifications', 'pos', 'storefront', 'grocery'],
    });
    const store = useLiveInvoices.getState();

    const toNum = (v: unknown) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
      return Number.isFinite(n) ? n : 0;
    };

    const offCreated = realtime.subscribe('grocery.invoice.created', (payload) => {
      const d = (payload ?? {}) as Record<string, unknown>;
      const invoiceId = String(d.invoiceId ?? '');
      if (!invoiceId) return;
      const isNew = store.received({
        invoiceId,
        barcodeCode: String(d.barcodeCode ?? ''),
        grandTotal: toNum(d.grandTotal),
        lineCount: Math.max(0, Math.trunc(toNum(d.lineCount))),
        createdByName: String(d.createdByName ?? ''),
        remote: d.remote === true || d.remote === 'true',
        customerPhone: d.customerPhone ? String(d.customerPhone) : null,
      });
      // Ring once, only for a genuinely new invoice — a reconnect replay stays silent.
      if (isNew) alertInvoiceArrived();
    });
    // Paid or cancelled at another till (or by the clerk): drop it from the live list so the bell
    // never sends a cashier to an invoice that is already gone.
    const drop = (payload: unknown) => {
      const id = String((payload as Record<string, unknown> | null)?.invoiceId ?? '');
      if (id) store.remove(id);
    };
    const offPaid = realtime.subscribe('grocery.invoice.paid', drop);
    const offCancelled = realtime.subscribe('grocery.invoice.cancelled', drop);
    const offExpired = realtime.subscribe('grocery.invoice.expired', drop);

    void realtime.connect();
    return () => {
      sync.stop();
      offCreated();
      offPaid();
      offCancelled();
      offExpired();
      realtime.disconnect();
    };
  }, [api, sync]);

  // The moment the line is back, what is waiting is sent, not at the next half minute.
  useEffect(
    () =>
      useReach.subscribe((now, before) => {
        if (before.offline && !now.offline) void sync.sync().catch(() => undefined);
      }),
    [sync]
  );

  // What the shop says about its settings is used, not wasted: the till shows what it allows, and keeps it on the phone
  // for a till that starts with no connection.
  const learn = useCallback(
    (flags: ShopFlags) => {
      usePosStore.getState().setFlags(flags);
      void keepFlags(shopId, flags, Date.now());
    },
    [shopId]
  );
  const look = useCallback(() => lookAtShop(api, learn), [api, learn]);

  // While the line is down, the shop is asked now and then, so that the till finds out when it is back.
  const offline = useReach((state) => state.offline);
  useEffect(() => {
    if (!offline) return undefined;
    const timer = setInterval(() => void look(), PROBE_EVERY_MS);
    return () => clearInterval(timer);
  }, [offline, look]);

  return (
    <AppNavigator
      api={api}
      tenant={tenant}
      branchId={branchId}
      branchName={branchName}
      person={person}
      shiftsDisabled={shiftsDisabled}
      look={look}
      learn={learn}
      onLogout={() => void leave()}
    />
  );
}

export function App() {
  return (
    <SafeAreaProvider>
      <StaffShell
        app="cashier"
        baseURL={API_BASE_URL}
        allowPassword
        isTill
        exportUnsent={exportUnsent}
        onRemoved={forgetTillData}
        renderScanner={renderScanner}
      >
        {(session) => <Till session={session} />}
      </StaffShell>
    </SafeAreaProvider>
  );
}
