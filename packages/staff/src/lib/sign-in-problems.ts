import { cleanDisplayText, isApiError } from '@kiosk/core';
import type { SignInMethod } from './sign-in-form';

/**
 * What to tell a person whose sign-in did not work, and what the form should do about it (plan
 * §5.12.4). Decided from the server's `code` first and its status second, never from its English,
 * and never showing a status number or a stack.
 */

export type SignInProblemKind =
  | 'wrong_credentials'
  | 'not_approved_till'
  | 'email_not_verified'
  | 'shop_off'
  | 'too_many'
  | 'no_connection'
  | 'server_down'
  | 'rejected'
  | 'unknown';

export interface SignInProblem {
  kind: SignInProblemKind;
  /** One or two plain sentences, shown under the form. */
  message: string;
  /** What was typed in the PIN or password box is wrong or used up: start the next try empty. The email stays. */
  clearSecret: boolean;
  /** A way forward besides trying again. */
  action?: 'pair' | 'resend_verification';
}

export interface SignInProblemContext {
  method: SignInMethod;
  /** The shop's name, for the sentences that name it. */
  shopName?: string;
  /** The platform says pairing works, so the person can be offered it. */
  pairingEnabled?: boolean;
  /**
   * How many times in a row the PIN or password was wrong, counting this one. The server locks an account after
   * enough wrong tries and then says the same "doesn't match" even for the right PIN, so a person who keeps
   * hearing it is pointed at their manager.
   */
  failedTries?: number;
}

/** The wrong tries after which the person is told the account may be locked. */
export const LOCK_HINT_AFTER = 3;

/** How many wrong PINs or passwords in a row, and for whom. */
export interface WrongTries {
  email: string;
  count: number;
}

export const NO_WRONG_TRIES: WrongTries = { email: '', count: 0 };

/**
 * The count after one more try that ended as `kind` for `email`. A wrong PIN or password adds one; for a
 * different person it starts again at one. Anything else (no connection, a server that is down) is not a wrong
 * try, and changes nothing.
 */
export function countWrongTries(before: WrongTries, email: string, kind: SignInProblemKind): WrongTries {
  if (kind !== 'wrong_credentials') return before;
  return { email, count: (before.email === email ? before.count : 0) + 1 };
}

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return error instanceof Error && error.name === 'AbortError';
}

export function describeSignInProblem(error: unknown, context: SignInProblemContext): SignInProblem {
  const shop = cleanDisplayText(context.shopName, 60) || 'this shop';

  if (!isApiError(error)) {
    if (isNetworkFailure(error)) {
      return { kind: 'no_connection', message: 'No connection. Check your internet and try again.', clearSecret: false };
    }
    return { kind: 'unknown', message: "Couldn't sign in. Try again.", clearSecret: false };
  }

  const { status, code } = error;

  // The phone is not an approved till: said exactly when the server says so with its code.
  if (code === 'till_not_registered') {
    return {
      kind: 'not_approved_till',
      message: `This phone isn't approved as a till at ${shop} yet. Your manager has been asked to approve it. Try again after they do.`,
      clearSecret: false,
      ...(context.pairingEnabled ? { action: 'pair' as const } : {}),
    };
  }

  // Until the server sends that code, a 403 with none on a PIN sign-in is that refusal, or an account that is not
  // active yet (the server refuses that one first, and files no request). Say both, and promise only what is true.
  if (code === undefined && status === 403 && context.method === 'pin') {
    return {
      kind: 'not_approved_till',
      message: `Your sign-in was refused. This phone may not be approved as a till at ${shop} yet (if so, your manager has been asked to approve it), or your account may not be active yet. Ask your manager if it keeps happening.`,
      clearSecret: false,
      ...(context.pairingEnabled ? { action: 'pair' as const } : {}),
    };
  }

  if (code === 'email_not_verified' || (code === undefined && status === 403 && context.method === 'password')) {
    return {
      kind: 'email_not_verified',
      message: "Your email isn't verified yet. Open the link we sent you, then try again.",
      clearSecret: false,
      action: 'resend_verification',
    };
  }

  if (status === 401) {
    const locked = (context.failedTries ?? 0) >= LOCK_HINT_AFTER;
    const said = context.method === 'pin' ? "That email and PIN don't match." : "That email and password don't match.";
    return {
      kind: 'wrong_credentials',
      message: locked ? `${said} If it keeps happening, your account may be locked: ask your manager.` : `${said} Try again.`,
      clearSecret: true,
    };
  }

  if (status === 423) {
    return {
      kind: 'shop_off',
      message: `${shop} is switched off right now. Ask the owner to contact support.`,
      clearSecret: false,
    };
  }

  if (status === 429) {
    return { kind: 'too_many', message: 'Too many tries. Wait a minute, then try again.', clearSecret: false };
  }

  if (status >= 500 || status === 408) {
    return { kind: 'server_down', message: "The server isn't answering right now. Try again in a moment.", clearSecret: false };
  }

  if (status === 400) {
    const said = cleanDisplayText(error.message, 160);
    if (said) {
      return { kind: 'rejected', message: said, clearSecret: false };
    }
  }

  return { kind: 'unknown', message: "Couldn't sign in. Try again.", clearSecret: false };
}
