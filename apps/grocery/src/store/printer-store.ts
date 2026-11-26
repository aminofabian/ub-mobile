import { create } from 'zustand';
import { readTenantValue, writeTenantValue } from '@kiosk/core';
import { BleTransport } from '../printing/ble-transport';
import { MockTransport } from '../printing/mock-transport';
import type { DiscoveredPrinter, PrinterStatus, PrinterTransport, SavedPrinter } from '../printing/transport';

/**
 * The till's printer: which one is paired, whether it is connected, and the scan in progress. One
 * BLE transport and one mock transport are kept for the life of the app; the store points at
 * whichever a given printer uses. The paired printer is remembered per shop so the till reconnects
 * on its own the next morning.
 */

const ble = new BleTransport();
const mock = new MockTransport();

function transportFor(kind: PrinterTransport['kind']): PrinterTransport {
  return kind === 'mock' ? mock : ble;
}

interface PrinterStore {
  status: PrinterStatus;
  /** Printers the live scan has turned up, strongest signal first. */
  found: DiscoveredPrinter[];
  /** The printer this till is paired with, or null. */
  saved: SavedPrinter | null;
  /** The last thing that went wrong, for the screen to show. */
  error: string | null;
  /** True once the saved printer has been read from storage (so the UI does not flash "none"). */
  loaded: boolean;
  /** The mock transport, exposed so the preview screen can read the last printed bytes. */
  mock: MockTransport;

  /** Read the remembered printer for this shop and try, quietly, to reconnect. */
  load: (tenantId: string) => Promise<void>;
  /** Start scanning. Returns a stop function. */
  startScan: () => Promise<void>;
  stopScan: () => void;
  /** Pair with a found printer: connect, remember it, make it the till's printer. */
  pair: (tenantId: string, printer: DiscoveredPrinter, paper: '58' | '80') => Promise<void>;
  /** Reconnect to the saved printer (after an app restart, or a dropped link). */
  reconnect: () => Promise<boolean>;
  /** Forget the paired printer. */
  forget: (tenantId: string) => Promise<void>;
  /** Send bytes to the connected printer, reconnecting first if the link has dropped. */
  print: (bytes: Uint8Array) => Promise<void>;
}

let stopScanFn: (() => void) | null = null;

export const usePrinter = create<PrinterStore>((set, get) => ({
  status: 'idle',
  found: [],
  saved: null,
  error: null,
  loaded: false,
  mock,

  load: async (tenantId) => {
    try {
      const raw = await readTenantValue('savedPrinter', tenantId);
      const saved = raw ? (JSON.parse(raw) as SavedPrinter) : null;
      set({ saved, loaded: true });
      if (saved) void get().reconnect();
    } catch {
      set({ loaded: true });
    }
  },

  startScan: async () => {
    set({ found: [], error: null, status: 'scanning' });
    // Real Bluetooth if the radio is on; the mock otherwise (simulator, BT off), so the scan list
    // still shows something to try and the flow can be walked end to end.
    const transport = (await ble.isAvailable()) ? (ble as PrinterTransport) : mock;
    try {
      stopScanFn = await transport.scan((printer) => {
        set((state) => {
          if (state.found.some((p) => p.id === printer.id)) return state;
          const found = [...state.found, printer].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
          return { found };
        });
      });
    } catch (e) {
      set({ status: 'error', error: message(e) });
    }
  },

  stopScan: () => {
    stopScanFn?.();
    stopScanFn = null;
    set((state) => (state.status === 'scanning' ? { status: 'idle' } : state));
  },

  pair: async (tenantId, printer, paper) => {
    get().stopScan();
    set({ status: 'connecting', error: null });
    const kind: PrinterTransport['kind'] = printer.id.startsWith('mock-') ? 'mock' : 'bluetooth';
    const transport = transportFor(kind);
    try {
      await transport.connect(printer.id);
      const saved: SavedPrinter = { id: printer.id, name: printer.name, kind, paper };
      await writeTenantValue('savedPrinter', JSON.stringify(saved), tenantId);
      set({ saved, status: 'connected' });
    } catch (e) {
      set({ status: 'error', error: message(e) });
      throw e;
    }
  },

  reconnect: async () => {
    const saved = get().saved;
    if (!saved) return false;
    const transport = transportFor(saved.kind);
    if (transport.connectedId() === saved.id) {
      set({ status: 'connected' });
      return true;
    }
    set({ status: 'connecting' });
    try {
      await transport.connect(saved.id);
      set({ status: 'connected' });
      return true;
    } catch (e) {
      set({ status: 'error', error: message(e) });
      return false;
    }
  },

  forget: async (tenantId) => {
    const saved = get().saved;
    if (saved) await transportFor(saved.kind).disconnect().catch(() => undefined);
    await writeTenantValue('savedPrinter', '', tenantId).catch(() => undefined);
    set({ saved: null, status: 'idle' });
  },

  print: async (bytes) => {
    const saved = get().saved;
    if (!saved) throw new Error('No printer paired. Add one in Printer settings.');
    const transport = transportFor(saved.kind);
    if (transport.connectedId() !== saved.id) {
      const ok = await get().reconnect();
      if (!ok) throw new Error('Could not reach the printer. Check it is on and in range.');
    }
    await transport.write(bytes);
  },
}));

function message(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong with the printer.';
}
