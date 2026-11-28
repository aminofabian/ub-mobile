import { cleanDisplayText, isApiError } from '@kiosk/core';
import { MAX_UNITS } from './cart';
import { formatMoney } from './money';
import { isNoAnswer } from './reach';
import type { Service, ServiceGroup } from './service-sale';
import { formatWhen } from './when';

/** What the till says about services. Plain words, no jargon: it is read by whoever is at the till. */

/** The shop has no service the till can sell. */
export const NO_SERVICES_WORDS = 'This shop has no services on sale yet. The owner adds them on the web.';

/** The shop lists services but no staff member who can be named on one: a service cannot be sold without one. */
export const NO_PERFORMERS_WORDS =
  'No staff are set up to serve customers, and a service cannot be sold without saying who did it. The owner sets this up on the web.';

/** Said in the box for one service when no one is allowed to do it. */
export const NO_ONE_DOES_WORDS = 'No one is set up to do this service. The owner sets it up on the web.';

/**
 * The services could not be read. `haveList`: an earlier list is on the screen. The shop not answering at all, with a
 * list on the screen, is said by `servicesFromPhoneWords` instead, so this is what is said for the other cases.
 */
export function describeServicesFailure(error: unknown, haveList = false): string {
  // A "no" that something in the way said in the shop's place (a Wi-Fi login page) is not the shop saying it.
  if (isApiError(error) && error.status === 403 && !error.foreign) {
    return 'Your role is not allowed to see the services. Ask the owner to allow it.';
  }
  if (haveList) {
    return 'The shop could not give the services just now, so the list below is the one read earlier. Try again in a moment.';
  }
  return isNoAnswer(error)
    ? 'Could not read the services, and this phone has not kept a list yet. Check the connection and try again.'
    : 'The shop could not give the services. Try again in a moment, and tell the owner if it keeps happening.';
}

/** Said above the list when it is the one read earlier: the shop did not answer this time. */
export function servicesFromPhoneWords(asOf: number): string {
  return `The shop did not answer. This list was read at ${formatWhen(asOf)}. A price the shop has changed since is not accepted when the sale is sent.`;
}

/** The line could not be put in the basket (it would pass the most one line may hold). */
export const SERVICE_NOT_ADDED_WORDS = `That could not be added to the basket: a line holds ${MAX_UNITS.toLocaleString('en-US')} at most.`;

/** Said once the line is in the basket. */
export function serviceAddedWords(name: string, performerName: string): string {
  return `Added ${name}, done by ${performerName}.`;
}

/** What the Checkout button says. While the till looks at the shop for services that changed, it says so and is not tapped again. */
export function checkoutWords(checking: boolean): string {
  return checking ? 'Checking...' : 'Checkout';
}

/** What a question on a service asks of the cashier, under its name. */
export function groupWords(group: ServiceGroup): string {
  if (group.required) return group.multiple ? 'choose at least one' : 'choose one';
  return group.multiple ? 'choose any' : 'optional';
}

/** What is in the basket, for the bottom of the services list. A line is an item, as it is for a held basket. */
export function basketWords(lines: number, totalText: string | null): string {
  if (lines === 0) return 'The basket is empty.';
  const count = lines === 1 ? '1 item' : `${lines} items`;
  return totalText === null ? `${count} in the basket.` : `${count} in the basket, ${totalText}.`;
}

/**
 * What the box for a price set at the till is called, and what it shows while nothing is typed. What is chosen on the
 * service is added to the price typed (the web till does the same, and so does the server's own ticket), so when a
 * choice adds money the box asks for the price before it, and a person who types the whole price is not counted twice.
 */
export function priceBoxWords(service: Service): { heading: string; placeholder: string } {
  const adds = service.groups.some((group) => group.options.some((option) => option.extraCents > 0));
  return {
    heading: adds ? 'Price before extras' : 'Price for one',
    // The listed price is what is used while nothing is typed, so it is what the empty box shows.
    placeholder: service.priceCents > 0 ? formatMoney(service.priceCents) : 'Enter the price',
  };
}

/** How the price of one comes together, when what is chosen adds to it: "1,000.00 + 500.00 extras = 1,500.00 each". */
export function sumWords(parts: { baseCents: number; extrasCents: number; unitCents: number } | null): string | null {
  if (!parts || parts.extrasCents <= 0) return null;
  return `KES ${formatMoney(parts.baseCents)} + ${formatMoney(parts.extrasCents)} extras = ${formatMoney(parts.unitCents)} each`;
}

/** The most shared names said in the words: the rest are counted. */
const MAX_SHARED_NAMED = 4;

/**
 * Said under the names of the people who may do a service, when some of them share a name. The server does not keep
 * display names apart, and the till has nothing else to tell two of them by.
 */
export function sharedNamesWords(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  let who: string;
  if (names.length === 1) {
    who = `More than one person here is called ${names[0]}.`;
  } else {
    // Not "people with the same name (Peter, Mary)": that reads as though Peter and Mary share one. It is each name that is shared.
    const named = names.slice(0, MAX_SHARED_NAMED).join(', ');
    const more = names.length > MAX_SHARED_NAMED ? `, and ${names.length - MAX_SHARED_NAMED} more` : '';
    who = `Each of these names belongs to more than one person here: ${named}${more}.`;
  }
  return `${who} Check that you pick the right one.`;
}

/** What the services screen puts where. Pure, so that what each case says is tested, not only seen on a phone. */
export interface ServicesView {
  /** Above the list: the shop did not answer and the list is the one read earlier, or it answered with a refusal. */
  above: { kind: 'old' | 'problem'; words: string } | null;
  /** Services are listed but no one is set up to do them. */
  noPerformers: boolean;
  /** In place of the rows, when there are none to show. */
  instead: { kind: 'loading' | 'failed' | 'none' | 'nomatch'; words: string } | null;
}

export function servicesView(input: {
  /** The list read for this shop, or null when none has been read. */
  book: { asOf: number; services: number; performers: number } | null;
  /** How many services are left after the search. */
  shown: number;
  /** What is typed in the search box. */
  typed: string;
  loading: boolean;
  /** What went wrong in the latest read. Null when it went well, or has not ended. */
  failed: { error: unknown } | null;
}): ServicesView {
  const { book, shown, typed, loading, failed } = input;
  let above: ServicesView['above'] = null;
  if (book && failed) {
    above = isNoAnswer(failed.error)
      ? { kind: 'old', words: servicesFromPhoneWords(book.asOf) }
      : { kind: 'problem', words: describeServicesFailure(failed.error, true) };
  }
  const noPerformers = book !== null && book.services > 0 && book.performers === 0;
  let instead: ServicesView['instead'] = null;
  if (shown === 0) {
    if (!book) {
      instead = loading ? { kind: 'loading', words: 'Loading...' } : { kind: 'failed', words: describeServicesFailure(failed ? failed.error : null) };
    } else if (book.services === 0) {
      instead = { kind: 'none', words: NO_SERVICES_WORDS };
    } else {
      instead = { kind: 'nomatch', words: `No service has "${cleanDisplayText(typed, 40)}" in its name.` };
    }
  }
  return { above, noPerformers, instead };
}
