import { isProvisionalId, type PairingCodeParse, type PairingProblem } from '@kiosk/core';

/** The words for pairing a phone to a till (plan §5.5): one plain sentence for each thing that can go wrong. */

export function describeCodeProblem(parse: Exclude<PairingCodeParse, { kind: 'ok' }>): string {
  switch (parse.kind) {
    case 'incomplete':
      return 'Enter the whole code from your manager.';
    case 'too_long':
      return 'That code is too long. Check it and try again.';
    case 'invalid_characters':
      return 'Codes use letters and numbers, never I, L, O, 0 or 1.';
  }
}

export function describePairingFailure(result: PairingProblem): string {
  switch (result.kind) {
    case 'not_found':
      return "We couldn't find that code. Check it, or ask your manager for a new one.";
    case 'expired':
      return 'That code has expired. Ask your manager for a new one.';
    case 'used':
      // A pairing whose answer was lost on the way looks like this the second time: the phone is already a till.
      return 'That code was already used. If you just paired this phone, go back and sign in. If not, ask your manager for a new one.';
    case 'refused':
      return "That code didn't work. Check it, or ask your manager for a new one.";
    case 'rate_limited':
      return result.retryAfterSec
        ? `Too many tries. Try again in ${result.retryAfterSec} ${result.retryAfterSec === 1 ? 'second' : 'seconds'}.`
        : 'Too many tries. Try again in a minute.';
    case 'offline':
      return "Couldn't reach the server. Check your internet and try again.";
  }
}

export function describeWrongShop(codeShopName: string, openShopName: string): string {
  return `This code is for ${codeShopName}, not ${openShopName}. Ask your manager for a code for ${openShopName}.`;
}

/**
 * Whether the shop a code names is the shop that is open. The server's own id settles it when both sides have a
 * real one (a shop that changed its address is still itself); otherwise the address or the short name decides,
 * in any case.
 */
export function isSameShop(
  codeShop: string,
  open: { host: string; slug: string; businessId?: string },
  codeShopId?: string
): boolean {
  const theirs = codeShopId?.trim();
  const ours = open.businessId?.trim();
  if (theirs && ours && !isProvisionalId(ours)) return theirs === ours;
  const named = codeShop.trim().toLowerCase();
  return named.length > 0 && (named === open.host.trim().toLowerCase() || named === open.slug.trim().toLowerCase());
}
