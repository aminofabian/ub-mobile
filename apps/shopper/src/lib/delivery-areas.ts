/**
 * The places a shop delivers to, and what that means for how an order can be placed.
 *
 * The server holds the list and checks it, in the step that saves the delivery details
 * (`StorefrontLeadCaptureService.requireActiveDeliveryArea`): an area is accepted when it matches an active
 * one, ignoring case, and a shop with no active areas is refused outright. The checkout step that places
 * the order does not look at the area at all, so the app checks it too, against the same list, before it
 * asks.
 *
 * The website has no pickup order. This app has always taken orders collected at the counter, so it keeps
 * them: they are the only kind a shop with no delivery areas can take.
 *
 * No imports, so node can run this file's test directly.
 */
export interface DeliveryArea {
  id?: string;
  name?: string | null;
  active?: boolean;
}

export type Fulfilment = 'delivery' | 'pickup';

export interface FulfilmentChoices {
  /** Whether a delivery can be placed at all. */
  canDeliver: boolean;
  /** Why not: the shop has no areas, or the list has not been loaded. */
  whyNot?: 'no-areas' | 'unknown';
  /** The choice the form starts on. */
  initial: Fulfilment;
}

/** The areas the shop delivers to now, as written, in the order the shop gave them, each once. */
export function activeAreaNames(areas: readonly DeliveryArea[] | null | undefined): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const area of areas ?? []) {
    const name = area.name?.trim();
    if (!area.active || !name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** The shop's own spelling of the area the person picked or typed, or null when it is not on the list. */
export function matchArea(names: readonly string[], typed: string | null | undefined): string | null {
  const wanted = typed?.trim().toLowerCase();
  if (!wanted) return null;
  return names.find((name) => name.toLowerCase() === wanted) ?? null;
}

/**
 * What can be chosen. `areas` is the list as the server last sent it, or undefined when the shop's details
 * have not loaded: then a delivery cannot be checked, and the form says so instead of letting one through.
 */
export function fulfilmentChoices(areas: readonly DeliveryArea[] | null | undefined): FulfilmentChoices {
  if (areas == null) return { canDeliver: false, whyNot: 'unknown', initial: 'pickup' };
  if (activeAreaNames(areas).length === 0) return { canDeliver: false, whyNot: 'no-areas', initial: 'pickup' };
  return { canDeliver: true, initial: 'delivery' };
}

/** The place shown for an address: ward, sub-county and county, each once. */
export function describePlace(parts: { ward?: string; subCounty?: string; county?: string }): string {
  const shown: string[] = [];
  for (const raw of [parts.ward, parts.subCounty, parts.county]) {
    const text = raw?.trim();
    if (text && !shown.some((seen) => seen.toLowerCase() === text.toLowerCase())) shown.push(text);
  }
  return shown.join(' · ');
}
