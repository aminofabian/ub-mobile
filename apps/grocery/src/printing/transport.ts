/**
 * A printer the till can send bytes to, and the ways to find one. The receipt builder makes the
 * bytes; a transport carries them — over Bluetooth to a real printer, or to the on-screen mock when
 * there is no hardware (the simulator, or a till with no printer paired yet).
 */

/** A printer the scan turned up. `id` is stable for reconnecting; `name` is what the cashier sees. */
export interface DiscoveredPrinter {
  id: string;
  name: string;
  /** Signal strength when found, for ordering the list (stronger first). Null when unknown. */
  rssi: number | null;
}

export type PrinterStatus = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

/**
 * One concrete way to reach a printer. The BLE transport talks to real hardware; the mock transport
 * pretends, so the whole flow — scan, connect, print — works on a simulator and the receipt can be
 * previewed without a printer in the room.
 */
export interface PrinterTransport {
  /** Human name for logs / the "how am I printing?" line. */
  readonly kind: 'bluetooth' | 'mock';
  /** Whether this transport can run here (BLE off / unsupported / simulator → false). */
  isAvailable(): Promise<boolean>;
  /**
   * Scan for printers, calling `onFound` as each appears (deduplicated by id upstream). Resolves the
   * returned stop function; call it to end the scan.
   */
  scan(onFound: (printer: DiscoveredPrinter) => void): Promise<() => void>;
  /** Connect to a printer by id. Rejects on failure. */
  connect(id: string): Promise<void>;
  /** Send raw bytes to the connected printer, chunked as the link needs. */
  write(bytes: Uint8Array): Promise<void>;
  /** Drop the connection. Safe to call when not connected. */
  disconnect(): Promise<void>;
  /** The id of the printer this transport is connected to, or null. */
  connectedId(): string | null;
}

/** A printer the till remembers between sessions, so it reconnects without a fresh scan. */
export interface SavedPrinter {
  id: string;
  name: string;
  /** Which transport paired it, so we rebuild the right one on reconnect. */
  kind: PrinterTransport['kind'];
  /** 58mm or 80mm paper, chosen when pairing — decides the receipt's column width. */
  paper: '58' | '80';
}
