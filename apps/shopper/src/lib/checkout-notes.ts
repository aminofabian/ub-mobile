/**
 * The notes on an order: where it goes and how it is paid, in the one line the shop reads.
 *
 * The format is the website's, character for character (`shop-checkout-form.tsx`, the `notes:` array in
 * `onSubmit`), because the server reads it back (`ShopperOrderNotesParser.java`) to fill a returning
 * shopper's details and the shop's staff read it as it is. A segment is "Label: value", segments are joined
 * with " | ", an empty one is left out, and the order of the segments is fixed.
 *
 * Two things the website does not do. A "|" typed inside a value would end that value early when the line
 * is read back, so it is written as "/". And a pickup order, which the website has no way to place, says so
 * in a segment of its own that the server's reader passes over.
 *
 * No imports, so node can run this file's test directly.
 */

/** What the server accepts in `notes` (`PublicCheckoutRequest`). */
export const MAX_ORDER_NOTES = 2000;

export interface OrderNoteFields {
  /** The shopper pays when the order arrives (on delivery, or at the counter for a pickup). */
  payLater?: boolean;
  /** Collected at the counter, not delivered. The website has no such order. */
  pickup?: boolean;
  street?: string;
  county?: string;
  subCounty?: string;
  ward?: string;
  whatsApp?: string;
  /** Keep this address for next time. */
  setAsDefault?: boolean;
  deliveryNotes?: string;
}

export interface ParsedOrderNotes {
  payLater: boolean;
  pickup: boolean;
  street?: string;
  county?: string;
  subCounty?: string;
  ward?: string;
  whatsApp?: string;
  deliveryNotes?: string;
  isDefault: boolean;
}

export const PICKUP_SEGMENT = 'Pickup at the counter';
export const PAY_ON_DELIVERY_SEGMENT = 'Payment: Pay on delivery';
export const PAY_AT_PICKUP_SEGMENT = 'Payment: Pay at pickup';
export const DEFAULT_ADDRESS_SEGMENT = 'Set as default address';

/** One value of the line: a "|" would split it when read back and a line break has no place in one line. */
export function cleanNoteValue(value: string | undefined): string {
  return (value ?? '').replace(/\s*[\r\n]+\s*/g, ' ').replace(/\|/g, '/').trim();
}

export function buildOrderNotes(fields: OrderNoteFields): string {
  const labelled = (label: string, value: string | undefined) => {
    const clean = cleanNoteValue(value);
    return clean ? `${label}: ${clean}` : '';
  };
  return [
    fields.pickup ? PICKUP_SEGMENT : '',
    fields.payLater ? (fields.pickup ? PAY_AT_PICKUP_SEGMENT : PAY_ON_DELIVERY_SEGMENT) : '',
    labelled('Street', fields.street),
    labelled('County', fields.county),
    labelled('Subcounty', fields.subCounty),
    labelled('Ward', fields.ward),
    labelled('WhatsApp', fields.whatsApp),
    fields.setAsDefault ? DEFAULT_ADDRESS_SEGMENT : '',
    labelled('Notes', fields.deliveryNotes),
  ]
    .filter(Boolean)
    .join(' | ');
}

/** Reads a line back the way the website and the server do. Unknown segments are passed over. */
export function parseOrderNotes(notes: string | null | undefined): ParsedOrderNotes {
  const parsed: ParsedOrderNotes = { payLater: false, pickup: false, isDefault: false };
  const segments = (notes ?? '')
    .split('|')
    .map((segment) => segment.trim())
    .filter(Boolean);
  for (const segment of segments) {
    if (segment.startsWith('Street:')) parsed.street = segment.slice(7).trim();
    else if (segment.startsWith('County:')) parsed.county = segment.slice(7).trim();
    else if (segment.startsWith('Subcounty:')) parsed.subCounty = segment.slice(10).trim();
    else if (segment.startsWith('Ward:')) parsed.ward = segment.slice(5).trim();
    else if (segment.startsWith('WhatsApp:')) parsed.whatsApp = segment.slice(9).trim();
    else if (segment.startsWith('Notes:')) parsed.deliveryNotes = segment.slice(6).trim();
    else if (segment === DEFAULT_ADDRESS_SEGMENT) parsed.isDefault = true;
    else if (segment === PAY_ON_DELIVERY_SEGMENT || segment === PAY_AT_PICKUP_SEGMENT) parsed.payLater = true;
    else if (segment === PICKUP_SEGMENT) parsed.pickup = true;
  }
  return parsed;
}

/** Whether the line is within what the server takes. */
export function notesFit(notes: string): boolean {
  return notes.length <= MAX_ORDER_NOTES;
}
