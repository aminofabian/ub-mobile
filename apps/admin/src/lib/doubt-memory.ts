import type { PaymentVerdict } from './credit';

/**
 * Payments that got no answer, kept for as long as the app is open.
 *
 * A payment whose answer was lost may be on the tab already. The tab screen locks its form and says so, but that
 * warning belonged to the screen: leave the customer and open them again, or be sent back to sign in while the payment
 * was on its way, and the new screen knew nothing about it and let the owner enter it a second time. The warning is kept
 * here instead, by shop and customer, and the screen asks for it when it opens.
 *
 * It lives in memory only. An app that is closed forgets it (keeping it on the phone needs a new field in the shared
 * storage, which is the owner's decision; see ADR 0053). Nothing here sends anything or reads the server.
 */

export type RememberedDoubt = {
  kind: 'unsettled';
  verdict: PaymentVerdict;
  words: string;
  owedBeforeCents: number;
  paidCents: number;
};

/** More than this many unsettled payments is not a thing a shop has; the oldest are let go so the list cannot grow without end. */
export const MAX_REMEMBERED = 50;

const held = new Map<string, RememberedDoubt>();

/** One shop's one customer. The shop's address is part of it, so two shops that happen to share an id never meet. */
export function doubtKey(host: string, customerId: string): string {
  return `${host.trim().toLowerCase()}|${customerId.trim()}`;
}

/** Keeps (or replaces) what is known about a payment that got no answer. */
export function rememberDoubt(key: string, doubt: RememberedDoubt): void {
  held.delete(key);
  held.set(key, doubt);
  while (held.size > MAX_REMEMBERED) {
    const oldest = held.keys().next();
    if (oldest.done) break;
    held.delete(oldest.value);
  }
}

/** What is known about this customer's unsettled payment, or null when there is none. */
export function recallDoubt(key: string): RememberedDoubt | null {
  return held.get(key) ?? null;
}

/** The payment is settled (it is on the tab, it was turned down, or the owner has looked and decided). */
export function forgetDoubt(key: string): void {
  held.delete(key);
}

/** Everything, for tests. */
export function forgetAllDoubts(): void {
  held.clear();
}
