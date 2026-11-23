import { cleanDisplayText, isApiError } from '@kiosk/core';
import { formatMoney, toCents } from './money';
import { serverWords } from './server-words';

/**
 * Web orders on the till: what customers ordered on the shop's site for pickup. A paid order is moved along by the
 * person at the till (confirm it, say it is ready, hand it over). Taking payment for an unpaid one is the owner's, at
 * the desk: the till only shows it.
 */

export type Fulfillment = 'awaiting_confirmation' | 'confirmed' | 'dispatched' | 'completed' | 'cancelled' | 'unknown';

export interface WebOrder {
  id: string;
  /** What the customer was told to quote, in capitals. */
  code: string;
  customer: string;
  /** Digits and a leading plus only, so it is safe to dial. Empty when there is none or it is not a number. */
  phone: string;
  totalCents: number | null;
  currency: string;
  paid: boolean;
  /** Not finished, not cancelled and not a payment that failed. */
  open: boolean;
  fulfillment: Fulfillment;
  /** The branch the order is for. Null when the server did not say. */
  branchId: string | null;
  /** When it was placed, in milliseconds. Null when the server did not say. */
  placedAt: number | null;
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** An amount of money as the server sends it: a number, or a number in text. Null for anything else, and for less than zero. */
function amount(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function fulfillmentOf(status: string, raw: string): Fulfillment {
  if (status === 'cancelled') return 'cancelled';
  const word = raw.toLowerCase();
  if (word === '') return 'awaiting_confirmation';
  if (word === 'awaiting_confirmation' || word === 'confirmed' || word === 'dispatched' || word === 'completed') return word;
  return 'unknown';
}

/** One row of the server's list of web orders. Null when it is not an order. */
export function parseWebOrder(raw: unknown): WebOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = text(row.id, 64);
  if (!id) return null;
  const status = text(row.status, 40).toLowerCase();
  const fulfillment = fulfillmentOf(status, text(row.fulfillmentStatus, 40));
  const code = text(row.orderCode, 24);
  // Only the spacing is taken out. Digits pulled out of words ("0712345678 ext 12") would be a number nobody has.
  const phone = text(row.customerPhone, 40).replace(/[\s().-]/g, '');
  const total = amount(row.grandTotal);
  const cents = total === null ? null : toCents(total);
  const placed = Date.parse(text(row.createdAt, 40));
  const branch = text(row.catalogBranchId, 64);
  return {
    id,
    code: /^[A-Za-z0-9-]{1,24}$/.test(code) ? code.toUpperCase() : id.replace(/-/g, '').slice(-8).toUpperCase(),
    customer: cleanDisplayText(row.customerName, 60) || 'Customer',
    phone: /^\+?\d{6,15}$/.test(phone) ? phone : '',
    totalCents: cents,
    currency: cleanDisplayText(row.currency, 6).toUpperCase() || 'KES',
    paid: status === 'paid',
    open: status !== 'cancelled' && status !== 'payment_failed' && fulfillment !== 'completed',
    fulfillment,
    branchId: branch || null,
    placedAt: Number.isNaN(placed) ? null : placed,
  };
}

/** The rows of the server's list, as orders. Anything that is not an order is left out. */
export function parseWebOrders(rows: readonly unknown[]): WebOrder[] {
  const orders: WebOrder[] = [];
  for (const row of rows) {
    const order = parseWebOrder(row);
    if (order) orders.push(order);
  }
  return orders;
}

/** The orders the till still has something to do with at this branch, the newest first. An order with no branch shows everywhere. */
export function openOrdersFor(orders: readonly WebOrder[], branchId: string): WebOrder[] {
  return orders
    .filter((order) => order.open && (order.branchId === null || order.branchId === branchId))
    .sort((a, b) => (b.placedAt ?? 0) - (a.placedAt ?? 0));
}

/** How many of this branch's orders the till can do something about now: the paid ones that are not finished. */
export function waitingCount(orders: readonly WebOrder[], branchId: string): number {
  return openOrdersFor(orders, branchId).filter((order) => nextStep(order) !== null).length;
}

export type Step = { to: 'confirmed' | 'dispatched' | 'completed'; label: string };

/** The one thing the till can do to this order next. Null when there is nothing (unpaid, finished or not understood). */
export function nextStep(order: WebOrder): Step | null {
  if (!order.paid || !order.open) return null;
  switch (order.fulfillment) {
    case 'awaiting_confirmation':
      return { to: 'confirmed', label: 'Confirm' };
    case 'confirmed':
      return { to: 'dispatched', label: 'Ready' };
    case 'dispatched':
      return { to: 'completed', label: 'Handed over' };
    default:
      return null;
  }
}

/** What to ask before a step is taken: each is one-way, and the shop may message the customer about it. */
export function confirmWords(order: WebOrder, step: Step): { title: string; message: string; button: string } {
  switch (step.to) {
    case 'confirmed':
      return {
        title: `Confirm ${order.code}?`,
        message: 'The customer may be messaged that their order is confirmed. A step cannot be taken back.',
        button: 'Confirm',
      };
    case 'dispatched':
      return {
        title: `Mark ${order.code} ready?`,
        message: 'The customer may be messaged that their order is ready to collect. A step cannot be taken back.',
        button: 'Ready',
      };
    case 'completed':
      return {
        title: `Hand over ${order.code}?`,
        message: `The customer has collected it. A step cannot be taken back.`,
        button: 'Handed over',
      };
  }
}

/** Where an order stands, in a word or two. */
export function statusLabel(order: WebOrder): string {
  if (!order.paid) return 'Unpaid';
  switch (order.fulfillment) {
    case 'awaiting_confirmation':
      return 'To confirm';
    case 'confirmed':
      return 'Packing';
    case 'dispatched':
      return 'Ready';
    case 'completed':
      return 'Done';
    default:
      return 'Paid';
  }
}

/** "KES 1,250.00", or the currency alone when the total is not known. */
export function orderTotalWords(order: WebOrder): string {
  return order.totalCents === null ? order.currency : `${order.currency} ${formatMoney(order.totalCents)}`;
}

/** "just now", "12 min ago", "3 h ago", "2 d ago". Empty when it is not known when the order was placed. */
export function placedWords(order: WebOrder, now: number): string {
  if (order.placedAt === null) return '';
  const minutes = Math.max(0, Math.floor((now - order.placedAt) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / (60 * 24))} d ago`;
}

/** What to tell the person when the list of web orders could not be had. `denied`: their role does not allow it. */
export function describeListFailure(error: unknown): { denied: boolean; words: string } {
  if (isApiError(error) && error.status === 403) {
    return {
      denied: true,
      words: 'Your role is not allowed to see web orders. Ask the owner to allow it, or use the web orders page on the desk.',
    };
  }
  return { denied: false, words: 'Could not load web orders. Check the connection and try again.' };
}

/** What to tell the person when an order could not be moved along. `reload`: what is on the screen is out of date. */
export function describeAdvanceFailure(error: unknown): { reload: boolean; words: string } {
  if (isApiError(error)) {
    if (error.status === 409) {
      return { reload: true, words: 'This order has already moved on, or is not paid yet. The list has been refreshed.' };
    }
    if (error.status === 404) return { reload: true, words: 'This order is no longer there. The list has been refreshed.' };
    if (error.status === 403) return { reload: false, words: 'Your role is not allowed to update web orders.' };
    const said = serverWords(error.message, 120);
    if (error.status >= 400 && error.status < 500 && !error.foreign && said) {
      return { reload: false, words: `The server said no: ${said}` };
    }
  }
  return { reload: false, words: 'Could not update the order. Check the connection and try again.' };
}
