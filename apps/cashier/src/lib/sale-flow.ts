import { isApiError } from '@kiosk/core';
import { classifyReplayFailure } from '@kiosk/offline';
import type { SalePayment } from './tender';
import { withTimeout } from './with-timeout';

/** How long the till waits for the server to take a sale before it stops waiting and keeps the sale on the phone. */
export const SALE_SEND_TIMEOUT_MS = 20_000;

export interface BasketLine {
  itemId: string;
  quantity: number;
  unitPrice: number;
}

export interface SaleBody {
  branchId: string;
  customerId?: string;
  lines: { itemId: string; quantity: number; unitPrice: number }[];
  payments: SalePayment[];
  /** The notes the customer handed over, when they were recorded. */
  cashReceived?: number;
  clientSoldAt: string;
}

/** The request that records a sale. Only what the server needs: nothing about the screen it was rung on. */
export function buildSaleBody(input: {
  branchId: string;
  cart: BasketLine[];
  payments: SalePayment[];
  cashReceived?: number;
  customerId?: string | null;
  soldAt: Date;
}): SaleBody {
  const { branchId, cart, payments, cashReceived, customerId, soldAt } = input;
  return {
    branchId,
    ...(customerId ? { customerId } : {}),
    lines: cart.map((line) => ({ itemId: line.itemId, quantity: line.quantity, unitPrice: line.unitPrice })),
    payments,
    ...(cashReceived !== undefined ? { cashReceived } : {}),
    clientSoldAt: soldAt.toISOString(),
  };
}

/**
 * Hands out the Idempotency-Key for a sale. The same sale (same branch, customer, lines and payments) always gets the
 * same key, however many times it is tried, so the server can tell a repeat from a new sale. A sale that has changed
 * gets a new key: the server answers a key it already knows with the sale it recorded first, whatever is sent now.
 * The notes the customer handed over are not part of what identifies a sale: they only work out the change.
 */
export function createKeyKeeper(mint: () => string): (body: SaleBody) => string {
  let held: { print: string; key: string } | null = null;
  return (body) => {
    const print = JSON.stringify([body.branchId, body.customerId ?? null, body.lines, body.payments]);
    if (!held || held.print !== print) held = { print, key: mint() };
    return held.key;
  };
}

/** The sale did not get an answer in time. */
export class SaleTimedOut extends Error {
  constructor() {
    super('The server did not answer in time.');
    this.name = 'SaleTimedOut';
  }
}

export type SaleSend<Sale> =
  /** The server recorded it. */
  | { kind: 'sent'; sale: Sale }
  /** It is saved on this phone and will be sent. `error` is why it was not sent now. */
  | { kind: 'saved'; error: unknown }
  /** The server looked at it and said no. It was not recorded and is not kept: the cart still holds the sale. */
  | { kind: 'refused'; error: unknown }
  /** It could not be sent and could not be saved either: it exists nowhere but in the cart. */
  | { kind: 'lost'; error: unknown };

/**
 * The server read the sale and turned it down for what is in it (a payment that does not add up, an M-Pesa code it
 * cannot find, a credit limit), so sending it again unchanged can never work. Anything that may come right on its own
 * or by itself later (no connection, a busy server, a shift that is not open, a shop that is switched off, a conflict
 * a manager can settle) is not a refusal: those sales are kept.
 */
export function isSaleRefusal(error: unknown): boolean {
  return classifyReplayFailure(error) === 'refused';
}

/** What to tell the cashier when the server refused a sale. */
export function describeSaleRefusal(error: unknown, options: { mpesaPaid?: boolean } = {}): string {
  const reason = isApiError(error) && error.message.trim() ? `: ${error.message.trim()}` : '.';
  const head = `The server did not accept this sale${reason}`;
  const ending = options.mpesaPaid
    ? 'The customer has already paid by M-Pesa, so do not send another prompt. Ask your manager.'
    : 'Nothing was recorded. Check the payment and try again.';
  return `${head}${head.endsWith('.') ? '' : '.'} ${ending}`;
}

/**
 * Takes a sale the way money has to be taken: the phone keeps its own copy first, then asks the server, so a crash or a
 * dead battery in between cannot lose a sale the customer has already paid for. The same Idempotency-Key goes with
 * both, so whichever reaches the server first is the one that is recorded and the other is recognised as it.
 *
 *  - `save` puts the sale in the queue of sales waiting to be sent.
 *  - `send` asks the server to record it.
 *  - `forget` takes it out of the queue once the server has it, or has turned it down for good.
 *
 * If saving fails, it still tries the server: a phone with a broken queue and a working connection can sell. Only when
 * neither works is the sale `lost`. A sale the server refused is `refused`. In both, the cart must not be cleared.
 */
export async function saveThenSend<Sale>(options: {
  save: () => Promise<void>;
  send: () => Promise<Sale>;
  forget: () => Promise<void>;
  timeoutMs?: number;
  /** Whether the error is the server turning the sale down for good. Defaults to `isSaleRefusal`. */
  refused?: (error: unknown) => boolean;
}): Promise<SaleSend<Sale>> {
  const { save, send, forget, timeoutMs = SALE_SEND_TIMEOUT_MS, refused = isSaleRefusal } = options;

  let saved = true;
  try {
    await save();
  } catch {
    saved = false;
  }

  try {
    const sale = await withTimeout(send, timeoutMs, () => new SaleTimedOut());
    if (saved) {
      // If this fails the queue still holds a sale the server has: its next send is recognised by the key.
      await forget().catch(() => undefined);
    }
    return { kind: 'sent', sale };
  } catch (error) {
    if (refused(error)) {
      // The copy on the phone would only come back as a sale nobody can send. The cart still holds the real one.
      if (saved) await forget().catch(() => undefined);
      return { kind: 'refused', error };
    }
    return saved ? { kind: 'saved', error } : { kind: 'lost', error };
  }
}
