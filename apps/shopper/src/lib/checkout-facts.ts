/**
 * What checkout needs to know about the shop, kept on the phone from the last time the shop answered.
 *
 * The form is filled in where the signal is poor, and the list of areas the shop delivers to and the ways
 * it takes payment come from the shop. Kept for a while, so the form is not empty when the shop does not
 * answer: the server checks the area again when it can, and the shop reads the area on the order.
 *
 * Imports only the area rules, so node can run this file's test directly.
 */
import { activeAreaNames, type DeliveryArea } from './delivery-areas';

/** Past this, what was kept is not trusted: a shop can change where it delivers in a fortnight. */
export const FACTS_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export interface CheckoutFacts {
  areas: string[];
  hasOnlinePay: boolean;
  hasManualPay: boolean;
  savedAt: string;
}

export function factsFrom(
  areas: readonly DeliveryArea[] | null | undefined,
  options: { online?: readonly unknown[] | null; manual?: readonly unknown[] | null } | null | undefined,
  now: Date,
): CheckoutFacts | null {
  // Nothing is kept from a shop that said nothing: an empty list would read as "delivers nowhere".
  if (areas == null || options == null) return null;
  // The payment answer with neither list in it is no answer: kept, it would read "takes no payment" for a fortnight.
  if (options.online == null && options.manual == null) return null;
  return {
    areas: activeAreaNames(areas),
    hasOnlinePay: (options.online?.length ?? 0) > 0,
    hasManualPay: (options.manual?.length ?? 0) > 0,
    savedAt: now.toISOString(),
  };
}

export function parseFacts(raw: string | null | undefined): CheckoutFacts | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CheckoutFacts>;
    if (!Array.isArray(parsed.areas) || typeof parsed.savedAt !== 'string' || Number.isNaN(Date.parse(parsed.savedAt))) {
      return null;
    }
    return {
      areas: parsed.areas.filter((area): area is string => typeof area === 'string' && area.trim() !== ''),
      hasOnlinePay: parsed.hasOnlinePay === true,
      hasManualPay: parsed.hasManualPay === true,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

/** What was kept, if it is still fresh enough to use. */
export function usableFacts(facts: CheckoutFacts | null, now: Date): CheckoutFacts | null {
  if (!facts) return null;
  const age = now.getTime() - Date.parse(facts.savedAt);
  return age >= 0 && age <= FACTS_MAX_AGE_MS ? facts : null;
}

/** How long the form waits for the shop with nothing kept to go on, before it says what it does not know. */
export const WAIT_FOR_SHOP_MS = 8_000;

/** Whether the form should still show that it is waiting, rather than the form with what it knows. */
export function stillWaitingForShop(input: {
  anyAnswer: boolean;
  kept: boolean;
  keptRead: boolean;
  asking: boolean;
  waitedTooLong: boolean;
}): boolean {
  if (input.anyAnswer || input.kept || input.waitedTooLong) return false;
  return !input.keptRead || input.asking;
}

export interface KnownShop {
  /** The areas, or null when neither the shop nor the phone knows them. */
  areaNames: string[] | null;
  hasOnlinePay: boolean | null;
  /** The answer came from the phone, not the shop just now. */
  fromPhone: boolean;
}

/** The shop's own answer wins; the phone's copy fills in when the shop did not answer. */
export function knownShop(
  live: { areas?: readonly DeliveryArea[] | null; online?: readonly unknown[] | null } | null | undefined,
  kept: CheckoutFacts | null,
): KnownShop {
  const liveAreas = live?.areas;
  const liveOnline = live?.online;
  return {
    areaNames: liveAreas != null ? activeAreaNames(liveAreas) : (kept?.areas ?? null),
    hasOnlinePay: liveOnline != null ? liveOnline.length > 0 : (kept?.hasOnlinePay ?? null),
    fromPhone: liveAreas == null && kept != null,
  };
}
