import { cleanDisplayText, formatCents, isApiError } from '@kiosk/core';
import { signedCents } from './owner-money';
import { dialable } from './phone';

/**
 * The shop's web orders as the owner sees them. A paid order is moved along one step at a time (confirm it, say it is
 * ready, mark it handed over). The server allows only the next step and answers 409 to one already taken, so a step
 * that got no answer is safe to look at again and never double-applied: the screen reads the list again after every try
 * and says what it finds. Taking payment for an unpaid order and cancelling a paid one move money records and are left
 * to the web (a cancelled paid order is not refunded by the server).
 */

export type StepTarget = 'confirmed' | 'dispatched' | 'completed';

export type OwnerOrder = {
  id: string;
  /** What the customer was told to quote, in capitals. */
  code: string;
  /** `pending_payment`, `paid`, `payment_failed` or `cancelled`, as the server says it. */
  status: string;
  /**
   * Where the order is in its fulfilment, as the server says it: `awaiting_confirmation`, `confirmed`, `dispatched`,
   * `completed` or `cancelled`. A paid order the server has no step for yet is `awaiting_confirmation`; an unpaid one
   * has none ('').
   */
  fulfilment: string;
  totalCents: number | null;
  currency: string;
  customer: string;
  /** Digits and a leading plus only, so it is safe to dial. Null when there is none or it is not a number. */
  phone: string | null;
  branch: string | null;
  /** When it was placed, in milliseconds. Null when the server did not say. */
  placedAt: number | null;
};

const MAX_ORDERS = 200;
const MAX_ID_LENGTH = 64;
const FINISHED_SHOWN = 10;

function lower(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, max) : '';
}

/**
 * When an instant the server wrote was, in milliseconds; null when it is not a date. The server writes the fraction of
 * a second with six or nine digits, and a phone's date reader may take only three, so it is cut or padded to three
 * first. Without that an order's age and its place in the queue would quietly go.
 */
export function parseInstant(text: string): number | null {
  const ms = Date.parse(normalizeInstant(text));
  return Number.isNaN(ms) ? null : ms;
}

/** An instant with the fraction of a second cut or padded to three digits, the most a phone's date reader is sure to take. */
export function normalizeInstant(text: string): string {
  return text.trim().replace(/\.\d+/, (fraction) => `.${fraction.slice(1).padEnd(3, '0').slice(0, 3)}`);
}

function readOrder(raw: unknown): OwnerOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  if (id.length === 0 || id.length > MAX_ID_LENGTH) return null;
  const status = lower(row.status, 40);
  const stated = lower(row.fulfillmentStatus, 40);
  const fulfilment = stated !== '' ? stated : status === 'paid' ? 'awaiting_confirmation' : '';
  const code = typeof row.orderCode === 'string' ? row.orderCode.trim() : '';
  const placed = typeof row.createdAt === 'string' ? parseInstant(row.createdAt) : null;
  const branch = cleanDisplayText(row.catalogBranchName, 60);
  return {
    id,
    code: /^[A-Za-z0-9-]{1,24}$/.test(code) ? code.toUpperCase() : id.replace(/-/g, '').slice(-8).toUpperCase(),
    status,
    fulfilment,
    totalCents: signedCents(row.grandTotal),
    currency: cleanDisplayText(row.currency, 6).toUpperCase() || 'KES',
    customer: cleanDisplayText(row.customerName, 60) || 'Customer',
    phone: dialable(row.customerPhone),
    branch: branch || null,
    placedAt: placed,
  };
}

/**
 * The orders in a page of `GET /api/v1/web-orders` (a Spring page keeps them in `content`; a bare list is read too).
 * Null when the answer is neither, which is a failed read and not "no orders".
 */
export function readOrders(raw: unknown): OwnerOrder[] | null {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { content?: unknown }).content)
      ? (raw as { content: unknown[] }).content
      : null;
  if (!rows) return null;
  const seen = new Set<string>();
  const orders: OwnerOrder[] = [];
  for (const row of rows.slice(0, MAX_ORDERS)) {
    const order = readOrder(row);
    if (order && !seen.has(order.id)) {
      seen.add(order.id);
      orders.push(order);
    }
  }
  return orders;
}

/** Whether an order still has something to happen to it: not finished, not cancelled and not a payment that failed. */
export function isOpen(order: Pick<OwnerOrder, 'status' | 'fulfilment'>): boolean {
  return order.status !== 'cancelled' && order.status !== 'payment_failed' && order.fulfilment !== 'completed' && order.fulfilment !== 'cancelled';
}

export type Step = { to: StepTarget; label: string };

/** The one thing the owner can do to this order next. Null when there is nothing (unpaid, finished or not understood). */
export function nextStep(order: Pick<OwnerOrder, 'status' | 'fulfilment'>): Step | null {
  if (order.status !== 'paid' || !isOpen(order)) return null;
  switch (order.fulfilment) {
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
export function confirmWords(order: Pick<OwnerOrder, 'code'>, step: Step): { title: string; message: string; button: string } {
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
        message: 'The customer may be messaged that their order is ready, and a delivery parcel may be booked. A step cannot be taken back.',
        button: 'Ready',
      };
    case 'completed':
      return {
        title: `Hand over ${order.code}?`,
        message: 'The customer has collected it, and may be messaged that their order was handed over. A step cannot be taken back.',
        button: 'Handed over',
      };
  }
}

/** What to tell the owner once a step has been taken. */
export function stepDoneWords(order: Pick<OwnerOrder, 'code'>, step: Pick<Step, 'to'>): string {
  switch (step.to) {
    case 'confirmed':
      return `${order.code} confirmed.`;
    case 'dispatched':
      return `${order.code} marked ready.`;
    case 'completed':
      return `${order.code} handed over.`;
  }
}

export type OrderTone = 'ask' | 'ok' | 'quiet' | 'warn' | 'bad';

/** Where an order stands, in words for the owner, and how loudly to say it. */
export function orderState(order: Pick<OwnerOrder, 'status' | 'fulfilment'>): { label: string; tone: OrderTone } {
  switch (order.status) {
    case 'pending_payment':
      return { label: 'Waiting for payment', tone: 'warn' };
    case 'payment_failed':
      return { label: 'Payment failed', tone: 'bad' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'quiet' };
    case 'paid':
      break;
    default:
      return { label: 'Not known', tone: 'quiet' };
  }
  switch (order.fulfilment) {
    case 'awaiting_confirmation':
      return { label: 'Paid, waiting for you', tone: 'ask' };
    case 'confirmed':
      return { label: 'Packing', tone: 'ok' };
    case 'dispatched':
      return { label: 'Ready', tone: 'ok' };
    case 'completed':
      return { label: 'Done', tone: 'quiet' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'quiet' };
    default:
      return { label: 'Paid', tone: 'ok' };
  }
}

/** How many paid orders are waiting for the owner to confirm them. */
export function awaitingCount(orders: readonly Pick<OwnerOrder, 'status' | 'fulfilment'>[]): number {
  return orders.filter((order) => order.status === 'paid' && order.fulfilment === 'awaiting_confirmation').length;
}

export type OrderGroup = {
  key: 'confirm' | 'under_way' | 'unpaid' | 'finished';
  title: string;
  orders: OwnerOrder[];
};

function newestFirst(a: OwnerOrder, b: OwnerOrder): number {
  return (b.placedAt ?? 0) - (a.placedAt ?? 0) || a.id.localeCompare(b.id);
}

function oldestFirst(a: OwnerOrder, b: OwnerOrder): number {
  return (a.placedAt ?? Number.MAX_SAFE_INTEGER) - (b.placedAt ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id);
}

/**
 * The owner's queue in the order it needs attention: orders waiting to be confirmed (the one that has waited longest
 * first), then orders being packed or ready, then orders waiting for payment, then the last few finished ones. A group
 * with nothing in it is left out.
 */
export function groupOrders(orders: readonly OwnerOrder[]): OrderGroup[] {
  const confirm: OwnerOrder[] = [];
  const underWay: OwnerOrder[] = [];
  const unpaid: OwnerOrder[] = [];
  const finished: OwnerOrder[] = [];
  for (const order of orders) {
    if (!isOpen(order)) finished.push(order);
    else if (order.status === 'pending_payment') unpaid.push(order);
    else if (order.status === 'paid' && order.fulfilment === 'awaiting_confirmation') confirm.push(order);
    else if (order.status === 'paid') underWay.push(order);
    else finished.push(order);
  }
  const groups: OrderGroup[] = [
    { key: 'confirm', title: 'Waiting for you', orders: confirm.sort(oldestFirst) },
    { key: 'under_way', title: 'Being handled', orders: underWay.sort(newestFirst) },
    { key: 'unpaid', title: 'Waiting for payment', orders: unpaid.sort(newestFirst) },
    { key: 'finished', title: 'Finished', orders: finished.sort(newestFirst).slice(0, FINISHED_SHOWN) },
  ];
  return groups.filter((group) => group.orders.length > 0);
}

/** "KES 1,250.00", or the currency alone when the total is not known. */
export function orderTotalWords(order: Pick<OwnerOrder, 'totalCents' | 'currency'>): string {
  return order.totalCents === null ? order.currency : `${order.currency} ${formatCents(order.totalCents)}`;
}

/** "just now", "12 min ago", "3 h ago", "2 d ago". Empty when it is not known when the order was placed. */
export function placedWords(order: Pick<OwnerOrder, 'placedAt'>, now: number): string {
  if (order.placedAt === null) return '';
  const minutes = Math.max(0, Math.floor((now - order.placedAt) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / (60 * 24))} d ago`;
}

/** What to tell a person whose role may not see web orders (the server answered 403 to the list). */
export const ORDERS_DENIED_WORDS = 'Your role is not allowed to see web orders. Ask the owner of the shop to allow it, or use the web orders page on the web.';

/** What to tell the person when a step could not be taken. `reload`: what is on the screen is out of date. */
export function describeStepFailure(error: unknown): { reload: boolean; words: string } {
  if (isApiError(error) && !error.foreign) {
    if (error.status === 409) {
      return { reload: true, words: 'This order has already moved on, or is not paid yet. The list has been refreshed.' };
    }
    if (error.status === 404) return { reload: true, words: 'This order is no longer there. The list has been refreshed.' };
    if (error.status === 403) return { reload: false, words: 'Your role is not allowed to update web orders.' };
    if (error.status >= 400 && error.status < 500) {
      const said = cleanDisplayText(error.hint || error.message, 120);
      if (said) return { reload: false, words: `The server said no: ${said}` };
    }
  }
  return { reload: true, words: 'Could not tell whether the step went through. The list has been refreshed: look at where the order is now.' };
}
