import { cleanDisplayText, plainHost } from './display-text';
import { isApiError } from './problem';
import type { StaffApp } from './role-gate';

/**
 * One reading of the server's `setup_required` answer (plan §5.5): a branch, a shift, a registered
 * till or a dispensing record has to exist before the action can run. The server sends a stable
 * `code`, `requirement` and `hint`; this turns them into one honest step, in words, so no screen
 * matches English or shows a bare 403.
 */

export type SetupRequirement = 'branch' | 'shift' | 'till' | 'dispensing';

export interface SetupRequired {
  requirement: SetupRequirement;
  hint?: string;
}

const REQUIREMENTS: readonly string[] = ['branch', 'shift', 'till', 'dispensing'];

/** The setup step an error asks for, or null when the error is something else. */
export function asSetupRequired(error: unknown): SetupRequired | null {
  if (!isApiError(error) || error.code !== 'setup_required') return null;
  if (!error.requirement || !REQUIREMENTS.includes(error.requirement)) return null;
  return {
    requirement: error.requirement as SetupRequirement,
    ...(error.hint ? { hint: error.hint } : {}),
  };
}

/** What the person can do about it, here or elsewhere. */
export type SetupAction =
  /** Choose one of the shop's branches. */
  | 'pick_branch'
  /** Open a shift (in the Cashier). */
  | 'open_shift'
  /** Scan a pairing QR from the manager. */
  | 'pair'
  /** Nothing to do on this phone: ask the manager. */
  | 'ask_manager'
  /** Nothing to do in the app: it is done on kiosk.ke. */
  | 'finish_on_web';

export interface SetupStep {
  requirement: SetupRequirement;
  title: string;
  body: string;
  action: SetupAction;
}

export interface SetupContext {
  app?: StaffApp;
  /** The shop runs without shifts: the till never asks the person to open one. */
  shiftsDisabled?: boolean;
  /** The platform says pairing works, so "scan a QR" is a real way forward. */
  pairingEnabled?: boolean;
  /** The shop's web address (its host), for steps that are finished on the web. Without it the copy says "the web". */
  web?: string;
}

/** A failed action, ready to show: the setup step when the server asked for one, otherwise its own words. */
export interface FailureNotice {
  title: string;
  body: string;
  /** Set when the server answered `setup_required`: what the person can do about it. */
  setup?: SetupStep;
}

/**
 * What to tell the person when an action failed. A `setup_required` answer becomes its setup step (a
 * title, one sentence and an action); anything else keeps the server's own message, or `fallback.body`
 * when there is none. The title for those is `fallback.title`.
 */
export function describeFailure(
  error: unknown,
  fallback: { title: string; body: string },
  context: SetupContext = {}
): FailureNotice {
  const needed = asSetupRequired(error);
  if (needed) {
    const setup = describeSetup(needed, context);
    return { title: setup.title, body: setup.body, setup };
  }
  // The server's own words are shown as they are, cleaned and capped; a whole web page in their place is not words.
  const own = error instanceof Error ? cleanDisplayText(error.message, 200) : '';
  return { title: fallback.title, body: own && !own.startsWith('<') ? own : fallback.body };
}

export function describeSetup(needed: SetupRequired, context: SetupContext = {}): SetupStep {
  const { requirement, hint } = needed;
  const web = plainHost(context.web) ?? 'the web';
  switch (requirement) {
    case 'branch':
      if (hint === 'none') {
        return {
          requirement,
          title: 'This shop has no branch yet',
          body: `Add a branch on ${web}, then come back.`,
          action: 'finish_on_web',
        };
      }
      if (hint === 'assign') {
        return {
          requirement,
          title: 'You are not on a branch yet',
          body: 'Ask your manager to put you on a branch, then sign in again.',
          action: 'ask_manager',
        };
      }
      return {
        requirement,
        title: 'Choose a branch',
        body: 'Pick the branch you are working at.',
        action: 'pick_branch',
      };
    case 'shift':
      if (context.shiftsDisabled || context.app !== 'cashier') {
        return {
          requirement,
          title: 'A shift is needed',
          body: `This needs an open shift. Open one on ${web}, then try again.`,
          action: 'finish_on_web',
        };
      }
      return {
        requirement,
        title: 'Open a shift to start selling',
        body: 'Open a shift first, then try again.',
        action: 'open_shift',
      };
    case 'till':
      return {
        requirement,
        title: 'This phone is not approved as a till',
        body: context.pairingEnabled
          ? `Scan the pairing QR from your manager, or ask them to approve this phone on ${web}.`
          : `Ask your manager to approve this phone on ${web}, then try again.`,
        action: context.pairingEnabled ? 'pair' : 'ask_manager',
      };
    case 'dispensing':
      return {
        requirement,
        title: 'This sale needs a pharmacist',
        body: `Medicines that need a dispensing record are finished on ${web}, not in this app.`,
        action: 'finish_on_web',
      };
  }
}
