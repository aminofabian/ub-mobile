import { BleManager, type Characteristic, type Device, State } from 'react-native-ble-plx';
import type { DiscoveredPrinter, PrinterTransport } from './transport';

/** How many payload bytes per BLE write. Conservative so it fits the default ATT MTU on any printer. */
const CHUNK = 180;

/** base64 for a byte slice — ble-plx takes characteristic values as base64, and RN has no Buffer. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 63] : '=';
  }
  return out;
}

/**
 * A printer reached over Bluetooth Low Energy. Scans for nearby devices (thermal printers advertise
 * over BLE), connects, finds the first writable characteristic, and streams the receipt to it in
 * small chunks. One manager is shared across the app; it is created lazily so the simulator — where
 * BLE throws on construction — never trips over it unless printing is actually attempted.
 */
export class BleTransport implements PrinterTransport {
  readonly kind = 'bluetooth' as const;
  private manager: BleManager | null = null;
  private device: Device | null = null;
  private writeChar: Characteristic | null = null;
  private writableWithResponse = true;

  private mgr(): BleManager {
    if (!this.manager) this.manager = new BleManager();
    return this.manager;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const state = await this.mgr().state();
      // PoweredOn means the radio is on and usable; anything else (Unsupported on a simulator,
      // PoweredOff, Unauthorized) means we fall back to the mock or ask the cashier to turn it on.
      return state === State.PoweredOn;
    } catch {
      return false;
    }
  }

  async scan(onFound: (printer: DiscoveredPrinter) => void): Promise<() => void> {
    const mgr = this.mgr();
    mgr.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error || !device) return;
      // A printer with no name is almost never the one the cashier wants; skip the noise.
      if (!device.name) return;
      onFound({ id: device.id, name: device.name, rssi: device.rssi ?? null });
    });
    return () => mgr.stopDeviceScan();
  }

  async connect(id: string): Promise<void> {
    const mgr = this.mgr();
    mgr.stopDeviceScan();
    const device = await mgr.connectToDevice(id, { timeout: 15_000 });
    await device.discoverAllServicesAndCharacteristics();
    const services = await device.services();
    let chosen: Characteristic | null = null;
    for (const service of services) {
      const chars = await service.characteristics();
      // Prefer write-with-response (acknowledged), but take write-without-response if that is all a
      // printer offers — many cheap ones only have the latter.
      chosen =
        chars.find((c) => c.isWritableWithResponse) ??
        chars.find((c) => c.isWritableWithoutResponse) ??
        chosen;
      if (chosen?.isWritableWithResponse) break;
    }
    if (!chosen) {
      await device.cancelConnection().catch(() => undefined);
      throw new Error('That device has no writable channel — it may not be a printer.');
    }
    this.device = device;
    this.writeChar = chosen;
    this.writableWithResponse = chosen.isWritableWithResponse;
  }

  async write(bytes: Uint8Array): Promise<void> {
    const char = this.writeChar;
    if (!char) throw new Error('No printer connected.');
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.slice(i, i + CHUNK);
      const value = toBase64(slice);
      if (this.writableWithResponse) {
        await char.writeWithResponse(value);
      } else {
        await char.writeWithoutResponse(value);
      }
    }
  }

  async disconnect(): Promise<void> {
    const device = this.device;
    this.device = null;
    this.writeChar = null;
    if (device) await device.cancelConnection().catch(() => undefined);
  }

  connectedId(): string | null {
    return this.device?.id ?? null;
  }
}
