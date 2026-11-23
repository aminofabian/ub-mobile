import type { StoreResult } from '@kiosk/core';

/**
 * What the picker says when a shop cannot be opened, and what it offers next (plan §5.12.2). The wording
 * depends on how the person got there, because "no shop has that code" and "no shop called that" lead to
 * different next steps, and on whether shop codes exist yet: nobody should be told to type a code the
 * server cannot look up.
 *
 * No imports but types, so node can run this file's test directly.
 */

/** How the person reached the shop. */
export type EntryMethod = 'name' | 'address' | 'code' | 'scan' | 'link' | 'demo' | 'recent';

/** Everything that can go wrong between "find this shop" and "it is open". */
export type Problem = Exclude<StoreResult, { kind: 'found' }> | { kind: 'not_a_shop' };

export type ProblemAction = 'retry' | 'scan_again' | 'type_code' | 'search' | 'forget';

export interface ProblemCopy {
  title: string;
  body: string;
  /** In the order to show them. */
  actions: ProblemAction[];
}

export interface ProblemContext {
  method: EntryMethod;
  /** What was typed, scanned or tapped, for the sentences that quote it. */
  input?: string;
  /** Shop codes are switched on, so "type the code" is something a person can do. */
  codesEnabled: boolean;
  /** Search by name is switched on, so "search for the shop" is something a person can do. On unless said otherwise. */
  directoryEnabled?: boolean;
}

function canSearch(context: ProblemContext): boolean {
  return context.directoryEnabled !== false;
}

function quote(input: string | undefined): string {
  const text = (input ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }
  return `"${text.length > 40 ? `${text.slice(0, 40)}…` : text}"`;
}

export function problemCopy(problem: Problem, context: ProblemContext): ProblemCopy {
  switch (problem.kind) {
    case 'offline':
      return { title: 'No connection', body: 'Check your connection and try again.', actions: ['retry'] };

    case 'rate_limited': {
      const wait = problem.retryAfterSec;
      return {
        title: 'Too many tries',
        body: wait && wait > 0 ? `Try again in ${wait} second${wait === 1 ? '' : 's'}.` : 'Try again in a minute.',
        actions: ['retry'],
      };
    }

    case 'unavailable': {
      const name = problem.store?.displayName?.trim() || 'This shop';
      if (problem.reason === 'suspended') {
        return {
          title: `${name} is not available right now`,
          body: 'The shop has paused its online service. Please check back later.',
          actions: [],
        };
      }
      if (problem.reason === 'storefront_disabled') {
        return {
          title: `${name} is not taking orders in the app yet`,
          body: 'Try again later, or ask the shop when it will start.',
          actions: [],
        };
      }
      return { title: `${name} is not available in the app`, body: 'This shop cannot be opened in the app right now.', actions: [] };
    }

    case 'not_a_shop': {
      const orElse = context.codesEnabled ? ', or type the shop code' : canSearch(context) ? ', or search for the shop by name' : '';
      return {
        title: 'That is not a shop',
        body: `The QR code is not for a Kiosk shop. Scan the one at the till${orElse}.`,
        actions: context.codesEnabled ? ['scan_again', 'type_code'] : canSearch(context) ? ['scan_again', 'search'] : ['scan_again'],
      };
    }

    case 'not_found':
      switch (context.method) {
        case 'code':
          return {
            title: 'No shop has that code',
            body: 'Check the code with the cashier and try again. Codes use letters and numbers, never I, L, O, 0 or 1.',
            actions: ['type_code'],
          };
        case 'scan':
          // "That QR code", not "that code": while shop codes are off, nothing the app says is about a code.
          return {
            title: 'No shop found for that QR code',
            body: context.codesEnabled
              ? canSearch(context)
                ? 'Ask the cashier for the shop code, or search for the shop by name.'
                : 'Ask the cashier for the shop code.'
              : canSearch(context)
                ? 'Search for the shop by name instead.'
                : 'Try scanning the QR code at the till again.',
            actions: canSearch(context) ? ['scan_again', 'search'] : ['scan_again'],
          };
        case 'link':
          return {
            title: 'We could not find that shop',
            body: context.codesEnabled
              ? canSearch(context)
                ? 'The link may be old. Ask the cashier for the shop code, or search for the shop by name.'
                : 'The link may be old. Ask the cashier for the shop code.'
              : canSearch(context)
                ? 'The link may be old. Search for the shop by name instead.'
                : 'The link may be old. Scan the QR code at the till instead.',
            actions: canSearch(context) ? ['search'] : [],
          };
        case 'demo':
          return { title: 'The demo shop is not available', body: 'Try again later.', actions: ['retry'] };
        case 'recent':
          return {
            title: 'This shop is no longer listed',
            body: 'You can remove it from the shops on this phone.',
            actions: ['forget'],
          };
        default: {
          const typed = quote(context.input);
          return {
            title: 'No shop found',
            body: `${typed ? `We could not find ${typed}. ` : ''}${
              context.codesEnabled
                ? 'Ask the cashier for the shop code.'
                : 'Check the spelling, or look for the short name on a receipt or shelf tag.'
            }`,
            actions: context.codesEnabled ? ['type_code'] : [],
          };
        }
      }
  }
}

/** What the scan screen says when the camera cannot be used. The settings link is shown beside it. */
export function cameraOffText(codesEnabled: boolean, directoryEnabled = true): string {
  if (codesEnabled) {
    return 'The camera is off. Type the code instead.';
  }
  return directoryEnabled
    ? 'The camera is off. Search for the shop by name instead.'
    : 'The camera is off. Turn it on in Settings to scan the QR code.';
}
