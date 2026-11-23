/**
 * What this app does not do for a shop (plan §5.6, §5.12.2).
 *
 * The server says what a shop does, in `capabilities` and `storeTypes`. The Shopper has no tables,
 * bookings, rooms or prescriptions, so a shop that does those says so here, in plain words, instead of
 * leaving the person to find out. Only an explicit `true` produces a line: a server that says nothing,
 * which is every server today, produces nothing, and a shop looks exactly as it did.
 *
 * No imports, so node can run this file's test directly.
 */
export interface ShopFacts {
  storeTypes?: string[];
  capabilities?: Record<string, boolean>;
}

const LIMITS: Array<{ capability: string; line: string }> = [
  { capability: 'tableOrdering', line: 'Table orders are not taken in this app.' },
  { capability: 'bookings', line: 'Appointments and bookings are not made in this app.' },
  { capability: 'rooms', line: 'Rooms are not booked in this app.' },
  { capability: 'dispensing', line: 'Prescription medicines are not sold in this app.' },
];

/** Plain sentences, in a fixed order, one for each thing the shop does that this app does not. */
export function coverageLimits(shop: ShopFacts | null | undefined): string[] {
  if (!shop) {
    return [];
  }
  const lines = LIMITS.filter((limit) => shop.capabilities?.[limit.capability] === true).map((limit) => limit.line);
  if (shop.storeTypes?.includes('clinic')) {
    lines.push('Clinic visits are not arranged in this app.');
  }
  return lines;
}

/**
 * The counter services the Shopper can show. Airtime also depends on the shop's own airtime setup, which
 * the screen checks; this is only whether the server has switched the service off for the shop. A missing
 * answer is not "off".
 */
export function counterServices(capabilities: Record<string, boolean> | undefined): {
  airtime: boolean;
  powerTokens: boolean;
} {
  return {
    airtime: capabilities?.airtime !== false,
    powerTokens: capabilities?.powerTokens !== false,
  };
}

/** The shop's website, for the "open it in your browser" link. Null unless the host is a plain address. */
export function shopWebUrl(host: string | undefined): string | null {
  const clean = host?.trim().toLowerCase() ?? '';
  return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/.test(clean) ? `https://${clean}` : null;
}
