import type { CartLine } from './cart';
import { toCents } from './money';
import { listedCents, performersFor, type ServiceBook } from './service-sale';

/**
 * Checking a basket with services in it against what the shop lists now, before the customer is asked to pay.
 *
 * The server turns a service down for a price that is not the service's now, or for a person who may no longer do it,
 * and says so only when the sale arrives, which is after the customer has paid. A service in the basket was priced and
 * given a person from the list the till had at the time; the shop may have changed either since. So the till looks again
 * first, and says what changed while the customer is still at the counter.
 */

/** How old the list of services may be before the till reads it again, before payment. */
export const BOOK_FRESH_MS = 2 * 60_000;

/** Whether the list was read recently enough to go by. A list read in the future (a clock set back) is not. */
export function bookIsFresh(book: ServiceBook | null, now: number): boolean {
  if (!book) return false;
  const age = now - book.asOf;
  return age >= 0 && age < BOOK_FRESH_MS;
}

/** What changed about a service in the basket: it is no longer sold, the person no longer does it, a choice is gone, the price differs. */
export type ChangeKind = 'gone' | 'person' | 'choice' | 'price';

export interface ServiceChange {
  kind: ChangeKind;
  itemId: string;
  /** The line's name, as it reads in the basket. */
  name: string;
  /** Who it was written down against. */
  performerName: string;
}

/**
 * The service lines whose service the shop has changed since they were added, in the order they are in the basket.
 * Only what the server would turn down is looked for. A service with a price set at the till is not compared on price:
 * the server takes any price above zero for it.
 */
export function changesIn(cart: readonly CartLine[], book: ServiceBook): ServiceChange[] {
  const changes: ServiceChange[] = [];
  for (const line of cart) {
    const tag = line.service;
    if (!tag) continue;
    const found = (kind: ChangeKind) => changes.push({ kind, itemId: line.itemId, name: line.name, performerName: tag.performerName });
    const service = book.services.find((candidate) => candidate.id === tag.serviceId);
    if (!service) {
      found('gone');
      continue;
    }
    if (!performersFor(service, book.performers).some((person) => person.id === tag.performerId)) {
      found('person');
      continue;
    }
    // The price of what was chosen, as the service has it now. Null when one of the choices is no longer on it.
    const listed = listedCents(service, tag.optionIds);
    if (listed === null) {
      found('choice');
      continue;
    }
    if (!service.variablePrice && toCents(line.unitPrice) !== listed) found('price');
  }
  return changes;
}

/** The most lines named in the words: the rest are counted. */
const NAMED = 3;

function what(change: ServiceChange): string {
  switch (change.kind) {
    case 'gone':
      return `${change.name} is not sold any more`;
    case 'person':
      return `${change.name} is no longer done by ${change.performerName}`;
    case 'choice':
      return `${change.name} no longer has what was chosen on it`;
    case 'price':
      return `${change.name} has a different price now`;
  }
}

/**
 * What the cashier does about it. A service the shop no longer sells cannot be added again, so it is only taken out. The
 * others are taken out and added again, which asks for the price, the person and the choices afresh.
 */
function whatToDo(changes: readonly ServiceChange[]): string {
  const them = changes.length === 1 ? 'it' : 'them';
  const gone = changes.filter((change) => change.kind === 'gone').length;
  if (gone === changes.length) return `Take ${them} out of the basket.`;
  if (gone === 0) return `Take ${them} out of the basket and add ${them} again from Services.`;
  return 'Take them out of the basket, and add again from Services the ones that are still sold.';
}

/** What to tell the cashier, before payment, about services that changed in the shop. Empty when none did. */
export function describeChanges(changes: readonly ServiceChange[]): string {
  if (changes.length === 0) return '';
  const named = changes.slice(0, NAMED).map(what).join('; ');
  const more = changes.length > NAMED ? `; and ${changes.length - NAMED} more` : '';
  const head = changes.length === 1 ? 'A service in the basket has changed in the shop' : 'Services in the basket have changed in the shop';
  return `${head}: ${named}${more}. ${whatToDo(changes)}`;
}

/** What the check needs from the till. Each is a function so that the answer is the one at that moment, after any waiting. */
export interface CheckDeps {
  /** What is in front of the cashier now. */
  cart: () => readonly CartLine[];
  /** The list the till holds for this shop, or null when it holds none. */
  held: () => ServiceBook | null;
  /** The till believes the shop cannot be reached, so it is not asked. */
  offline: () => boolean;
  /** Reads the shop's list again. Rejects when the shop does not answer in time. */
  read: () => Promise<ServiceBook>;
  /** Keeps a list that was read. */
  keep: (book: ServiceBook) => void;
  now: () => number;
}

/**
 * Which services in the basket the shop has changed, for the till to say before the customer is asked to pay. The list the
 * till holds is used when it was read a moment ago, or when the shop cannot be asked; otherwise the shop is asked, and
 * when it does not answer the till goes on with what it holds, since the server still checks the sale and says so. The
 * basket is read again after the wait, because the cashier may have changed it meanwhile.
 */
export async function servicesChangedBeforePay(deps: CheckDeps): Promise<ServiceChange[]> {
  const held = deps.held();
  let book = held;
  if (!bookIsFresh(held, deps.now()) && !deps.offline()) {
    try {
      book = await deps.read();
      deps.keep(book);
    } catch {
      book = held;
    }
  }
  return book ? changesIn(deps.cart(), book) : [];
}
