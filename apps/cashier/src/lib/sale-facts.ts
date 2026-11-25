import { cleanDisplayText } from '@kiosk/core';
import { asOfWords } from './catalog-words';

/**
 * What the till knows about a sale it has queued that the server is never told. It is kept with the queued sale (its
 * `facts`) so that whoever finds the sale later, another cashier or a manager, can tell what they are looking at.
 */
export interface SaleFacts {
  /** Who rang the sale. The server records a sale that is sent later under whoever's session sends it, not under them. */
  rungBy?: string;
  rungById?: string;
  /** Its M-Pesa code was typed in, not read from a prompt the customer paid: nothing has checked it yet. */
  mpesaTyped?: boolean;
  /** Some of its prices came from the list saved on the phone, made at this time (milliseconds since 1970). */
  pricesAsOf?: number;
}

const NAME_LIMIT = 60;
const ID_LIMIT = 80;

/** The facts to keep with a sale as it is queued. Undefined when there is nothing to say. */
export function factsFor(input: {
  person: { userId: string; name: string } | null | undefined;
  payments: readonly { method: string }[];
  /** The M-Pesa payment was confirmed by a prompt the customer paid, so the server already knows it. */
  mpesaConfirmed: boolean;
  /** The oldest phone list a price in the sale came from, or null when every price was the shop's own answer. */
  pricesAsOf: number | null | undefined;
}): Record<string, string | number | boolean> | undefined {
  const facts: Record<string, string | number | boolean> = {};
  const name = cleanDisplayText(input.person?.name, NAME_LIMIT);
  if (name) facts.rungBy = name;
  const id = typeof input.person?.userId === 'string' ? input.person.userId.trim().slice(0, ID_LIMIT) : '';
  if (id) facts.rungById = id;
  if (!input.mpesaConfirmed && input.payments.some((payment) => payment.method === 'mpesa_manual')) facts.mpesaTyped = true;
  if (typeof input.pricesAsOf === 'number' && Number.isFinite(input.pricesAsOf) && input.pricesAsOf >= 0) {
    facts.pricesAsOf = Math.trunc(input.pricesAsOf);
  }
  return Object.keys(facts).length > 0 ? facts : undefined;
}

/** What a queued sale carries, read defensively: anything that is not what was written is left out. */
export function readFacts(item: { facts?: unknown }): SaleFacts {
  const raw = item.facts;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  const facts: SaleFacts = {};
  const name = typeof record.rungBy === 'string' ? cleanDisplayText(record.rungBy, NAME_LIMIT) : '';
  if (name) facts.rungBy = name;
  if (typeof record.rungById === 'string' && record.rungById.trim()) facts.rungById = record.rungById.trim().slice(0, ID_LIMIT);
  if (record.mpesaTyped === true) facts.mpesaTyped = true;
  if (typeof record.pricesAsOf === 'number' && Number.isFinite(record.pricesAsOf) && record.pricesAsOf >= 0) {
    facts.pricesAsOf = record.pricesAsOf;
  }
  return facts;
}

/** Plain lines about a queued sale for the list of unsent sales. `stuck`: the sale needs a person. */
export function describeFacts(item: { facts?: unknown }, options: { now: number; stuck: boolean }): string[] {
  const facts = readFacts(item);
  const lines: string[] = [];
  if (facts.rungBy) lines.push(`Rung by ${facts.rungBy}.`);
  if (facts.mpesaTyped) lines.push('The M-Pesa code was typed in. Nothing has checked it yet.');
  if (facts.pricesAsOf !== undefined) {
    const when = asOfWords(facts.pricesAsOf, options.now);
    lines.push(
      options.stuck
        ? `Priced from this phone's list, ${when}. A price may have changed since.`
        : `Priced from this phone's list, ${when}.`
    );
  }
  return lines;
}
