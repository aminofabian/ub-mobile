import type { DiscoveredPrinter, PrinterTransport } from './transport';

/**
 * A pretend printer, for when there is no Bluetooth — the iOS Simulator, or a till where the cashier
 * wants to see the receipt before pairing anything. It "discovers" a couple of demo printers,
 * "connects" instantly, and keeps the last receipt's bytes so the preview can render exactly what a
 * real printer would have received. Nothing leaves the phone.
 */
export class MockTransport implements PrinterTransport {
  readonly kind = 'mock' as const;
  private id: string | null = null;
  /** The bytes of the last "print", so a screen can show the finished slip. */
  lastBytes: Uint8Array | null = null;

  private static readonly DEMO: DiscoveredPrinter[] = [
    { id: 'mock-58', name: 'Demo Printer 58mm', rssi: -40 },
    { id: 'mock-80', name: 'Demo Printer 80mm', rssi: -55 },
  ];

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async scan(onFound: (printer: DiscoveredPrinter) => void): Promise<() => void> {
    // Reveal the demo printers one after another, the way a real scan trickles them in.
    let cancelled = false;
    MockTransport.DEMO.forEach((p, i) => {
      setTimeout(() => {
        if (!cancelled) onFound(p);
      }, 350 * (i + 1));
    });
    return () => {
      cancelled = true;
    };
  }

  async connect(id: string): Promise<void> {
    await new Promise<void>((r) => setTimeout(() => r(), 300));
    this.id = id;
  }

  async write(bytes: Uint8Array): Promise<void> {
    await new Promise<void>((r) => setTimeout(() => r(), 200));
    this.lastBytes = bytes;
  }

  async disconnect(): Promise<void> {
    this.id = null;
  }

  connectedId(): string | null {
    return this.id;
  }
}
