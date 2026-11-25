import { isApiError } from '@kiosk/core';
import { classifyReplayFailure } from '@kiosk/offline';
import type { ServiceTag } from './cart';
import { formatMoney, toCents } from './money';
import type { PayMode } from './pay-inputs';
import { serverWords } from './server-words';
import type { SalePayment } from './tender';
import { withTimeout } from './with-timeout';

/** How long the till waits for the server to take a sale before it stops waiting and keeps the sale on the phone. */
export const SALE_SEND_TIMEOUT_MS = 20_000;

export interface BasketLine {
  itemId: string;
  quantity: number;
  unitPrice: number;
  /** Present when the line is a service: the sale then names the service and who did it, and no product. */
  service?: ServiceTag;
}

/** A product line of a sale. */
export interface GoodsSaleLine {
  itemId: string;
  quantity: number;
  unitPrice: number;
}

/** A service line of a sale: no product, but the service, who did it and what was chosen on it. */
export interface ServiceSaleLine {
  kind: 'SERVICE';
  serviceId: string;
  performerStaffProfileId: string;
  quantity: number;
  unitPrice: number;
  /** What was chosen on the service (a length, an extra). Left out when nothing was. */
  modifierOptionIds?: string[];
}

export type SaleLine = GoodsSaleLine | ServiceSaleLine;

/** One basket line as the server's sale request takes it. A service never carries the made-up id the basket keeps it under. */
export function saleLineOf(line: BasketLine): SaleLine {
  const { service } = line;
  if (service) {
    return {
      kind: 'SERVICE',
      serviceId: service.serviceId,
      performerStaffProfileId: service.performerId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      ...(service.optionIds.length > 0 ? { modifierOptionIds: [...service.optionIds] } : {}),
    };
  }
  return { itemId: line.itemId, quantity: line.quantity, unitPrice: line.unitPrice };
}

export interface SaleBody {
  branchId: string;
  customerId?: string;
  lines: SaleLine[];
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
    lines: cart.map((line) => saleLineOf(line)),
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
  /**
   * The server looked at it and said no. Normally it was not recorded and is not kept: the cart still holds the sale.
   * `kept`: its copy stays on the phone, parked for a manager, because money has already been taken for it.
   */
  | { kind: 'refused'; error: unknown; kept: boolean }
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

/**
 * Said when a sale with a service in it is refused. The server turns a service down for a price that is not the
 * service's now, or for a person who may no longer do it, and a basket holds the price and the person it was made with.
 */
export const SERVICE_CHANGED_WORDS =
  'If a service was changed in the shop (its price, or who does it), take it out of the basket and add it again from Services.';

/** What to tell the cashier when the server refused a sale. `hasService`: the basket has a service in it. */
export function describeSaleRefusal(error: unknown, options: { mpesaPaid?: boolean; typedCode?: boolean; hasService?: boolean } = {}): string {
  const said = isApiError(error) ? serverWords(error.message) : '';
  const reason = said ? `: ${said}` : '.';
  const head = `The server did not accept this sale${reason}`;
  // A prompt that was paid is the stronger fact: the sale is kept for a manager and another prompt would be a second payment.
  // A code the cashier typed is the cashier's to put right (a wrong digit, a wrong amount), but the money is the shop's already.
  const ending = options.mpesaPaid
    ? 'The customer has already paid by M-Pesa, so do not send another prompt. Ask your manager.'
    : options.typedCode
      ? 'Nothing was recorded, and the customer has paid by M-Pesa with the code you typed. Check the code and the amount and try again. If it is still not accepted, ask your manager before the customer leaves.'
      : 'Nothing was recorded. Check the payment and try again.';
  // Not when the customer has paid by M-Pesa: the sale is then the manager's to settle, not to be put together again.
  const service = options.hasService && !options.mpesaPaid ? ` ${SERVICE_CHANGED_WORDS}` : '';
  return `${head}${head.endsWith('.') ? '' : '.'} ${ending}${service}`;
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
 * neither works is the sale `lost`. A sale the server refused is `refused`. In both, the cart must not be cleared,
 * unless the refused sale was `kept` (`keepRefused`: the customer's money has been taken, so the phone's copy is the only
 * record that the sale happened and is parked for a manager, not thrown away).
 */
export async function saveThenSend<Sale>(options: {
  save: () => Promise<void>;
  send: () => Promise<Sale>;
  forget: () => Promise<void>;
  timeoutMs?: number;
  /** Whether the error is the server turning the sale down for good. Defaults to `isSaleRefusal`. */
  refused?: (error: unknown) => boolean;
  /** Keep the phone's copy of a refused sale instead of forgetting it. */
  keepRefused?: boolean;
  /** Marks the kept copy as one a person has to look at. Without it the sync engine marks it on its next pass. */
  park?: (error: unknown) => Promise<void>;
}): Promise<SaleSend<Sale>> {
  const { save, send, forget, timeoutMs = SALE_SEND_TIMEOUT_MS, refused = isSaleRefusal, keepRefused = false, park } = options;

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
      if (saved && keepRefused) {
        // The customer has paid, so this copy may be the only record that the sale happened. It stays, parked.
        await park?.(error).catch(() => undefined);
        return { kind: 'refused', error, kept: true };
      }
      // The copy on the phone would only come back as a sale nobody can send. The cart still holds the real one.
      if (saved) await forget().catch(() => undefined);
      return { kind: 'refused', error, kept: false };
    }
    return saved ? { kind: 'saved', error } : { kind: 'lost', error };
  }
}

/**
 * What decides who a sale is for, apart from the basket. The customer behind an M-Pesa number is looked up once per
 * try and then kept, so that trying again is the same sale under the same key. It is kept only for as long as what
 * decided it stays the same: another way of paying, another number or another credit customer is looked up again, so
 * a customer chosen for one way of paying is never carried into another.
 */
export function customerKey(input: { mode: PayMode; phone: string | null; creditCustomerId: string | null }): string {
  switch (input.mode) {
    case 'cash':
      return 'cash';
    case 'credit':
      return `credit:${input.creditCustomerId ?? ''}`;
    default:
      return `phone:${input.phone ?? ''}`;
  }
}

/**
 * What happens when the person tries to leave the Payment screen.
 *  - `allow`: nothing is in play, or the sale is done.
 *  - `wait`: the sale is being saved and sent. Leaving would hand its answer to a screen that is gone, and ringing the
 *    sale up again would record it twice, so it is not an option until the answer is in.
 *  - `ask`: an M-Pesa payment may be out. Leaving can leave the customer's money without a sale, so it is a choice.
 */
export function leaveGuard(state: { finished: boolean; saving: boolean; holdsMoney: boolean }): 'allow' | 'wait' | 'ask' {
  if (state.finished) return 'allow';
  if (state.saving) return 'wait';
  return state.holdsMoney ? 'ask' : 'allow';
}

/** What to tell the cashier when the server turned down a sale the customer had already paid for by M-Pesa. */
export function describeKeptRefusal(error: unknown): { title: string; body: string } {
  const said = (isApiError(error) ? serverWords(error.message) : '').replace(/[.\s]+$/, '');
  return {
    title: 'Paid by M-Pesa, sale not accepted',
    body: `The customer has paid by M-Pesa, but the server did not accept the sale${said ? `: ${said}` : ''}. The sale is kept on this phone, under Unsent sales, for your manager to look at. Do not ring it up again.`,
  };
}

/**
 * The server priced a sale differently from the till (an active discount, a price that changed): by how much, in cents.
 * Null when they agree, or when the server did not say. The till sends the shelf price and the server may charge less.
 */
export function totalMismatch(tillCents: number, serverTotal: unknown): { serverCents: number; owedBackCents: number } | null {
  if (typeof serverTotal !== 'number') return null;
  const serverCents = toCents(serverTotal);
  if (serverCents === null || serverCents === tillCents) return null;
  return { serverCents, owedBackCents: tillCents - serverCents };
}

/** What to tell the cashier when the server's total is not the till's. The sale is recorded; this is about the money. */
export function describeTotalMismatch(tillCents: number, mismatch: { serverCents: number; owedBackCents: number }): { title: string; body: string } {
  if (mismatch.owedBackCents > 0) {
    return {
      title: 'The sale came to less',
      body: `The server priced this sale at ${formatMoney(mismatch.serverCents)}, not the ${formatMoney(tillCents)} shown here (a discount or a price change). The customer was asked for ${formatMoney(tillCents)}, so ${formatMoney(mismatch.owedBackCents)} is owed back. Give it back from the drawer if they paid cash, or ask your manager if they paid another way.`,
    };
  }
  return {
    title: 'The sale came to more',
    body: `The server priced this sale at ${formatMoney(mismatch.serverCents)}, which is ${formatMoney(-mismatch.owedBackCents)} more than the ${formatMoney(tillCents)} shown here. The customer still owes the difference: ask your manager.`,
  };
}
