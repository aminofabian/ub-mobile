/**
 * The phone number as the order carries it.
 *
 * The website joins a dial code and the number typed beside it (`frontend/lib/kenyan-phone.ts`,
 * `joinKenyanCheckoutPhone`), so an order from the app reads the same at the shop: "+254 712345678", not
 * whatever the person happened to type. The app takes Kenyan mobiles only, so the dial code is +254.
 *
 * Imports only the Kenyan number rules, so node can run this file's test directly.
 */
import { toKenyanLocal07 } from './phone';

export const KENYA_DIAL_CODE = '+254';

/** `2547XXXXXXXX` for a Kenyan mobile in any of the forms people type it, or null. */
export function toMsisdn254(raw: string): string | null {
  const local = toKenyanLocal07(raw);
  return local ? `254${local.slice(1)}` : null;
}

/**
 * A dial code and the number typed next to it, the way the website writes them. A leading 0 on a Kenyan
 * line is dropped, so "+254" with "0725…" does not become "2540725…". Anything that is not a Kenyan mobile
 * is joined as typed, for the shop to read.
 */
export function joinCheckoutPhone(areaCode: string, national: string): string {
  const code = (areaCode || KENYA_DIAL_CODE).trim() || KENYA_DIAL_CODE;
  const local = national.trim();
  if (!local) return code;
  if (code.replace(/\D/g, '') === '254') {
    const msisdn = toMsisdn254(local);
    if (msisdn) return `${KENYA_DIAL_CODE} ${msisdn.slice(3)}`;
  }
  return `${code} ${local}`.replace(/\s+/g, ' ').trim();
}

/** The number as a Kenyan mobile the person would type it ("0712345678"), from an order's phone. */
export function typedPhoneFrom(orderPhone: string): string {
  return toKenyanLocal07(orderPhone) ?? orderPhone.trim();
}
