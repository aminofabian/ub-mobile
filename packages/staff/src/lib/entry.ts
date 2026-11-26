import {
  appsThatFit,
  fitsApp,
  isApiError,
  isBranchLockedRole,
  type BranchOption,
  type StaffApp,
  type StaffUser,
  type TillCheck,
} from '@kiosk/core';
import { withTimeout } from './with-timeout';

/**
 * How long the whole check may take. The calls behind it have no time limit of their own, so on a phone
 * that is online but cut off from the internet they would wait for ever; after this the person is told the
 * check did not work and can try again or sign out.
 */
export const ENTRY_TIMEOUT_MS = 20_000;

/** The till check, the branch name and the shifts lookup never block the app: no answer in this time is no answer. */
export const SECONDARY_TIMEOUT_MS = 8_000;

export interface EntryLimits {
  timeoutMs?: number;
  secondaryTimeoutMs?: number;
}

/**
 * What happens between "the server accepted the sign-in" and "the app opens" (plan §5.11.4, §5.12.2):
 * who is this, does this app fit them, which branch are they working at, and is this phone still a
 * till. Each step is a question the server answers; this only decides what to do with the answers, so
 * it is plain code with its questions passed in.
 */

export type EntryStage =
  /** The account could not be read: no connection, or the server failed. Retryable. */
  | { name: 'check_failed' }
  /** The session is gone. Back to sign-in. */
  | { name: 'signed_out' }
  /** The shop is switched off (the server answered 423). */
  | { name: 'shop_off' }
  /** The account exists but has no role, so there is nothing for it to open. */
  | { name: 'no_role'; user: StaffUser }
  | { name: 'wrong_app'; user: StaffUser; fits: StaffApp[] }
  /** The branches could not be listed. Retryable. */
  | { name: 'branches_failed'; user: StaffUser }
  | { name: 'no_branch'; user: StaffUser }
  /** A role the server pins to one branch, with none assigned: a branch picked here would be ignored. */
  | { name: 'no_branch_assigned'; user: StaffUser }
  | { name: 'pick_branch'; user: StaffUser; branches: BranchOption[] }
  /** This phone was a registered till at this branch and is not any more. */
  | { name: 'removed'; user: StaffUser; branchId: string }
  | { name: 'ready'; user: StaffUser; branchId: string; branchName: string | null; shiftsDisabled: boolean };

export interface EntryQuestions {
  app: StaffApp;
  loadMe: () => Promise<StaffUser>;
  loadBranches: () => Promise<BranchOption[]>;
  /** Asked only where the phone is a till (the Cashier). Left out, no check is made. */
  checkTill?: (branchId: string) => Promise<TillCheck>;
  /**
   * Ask the owner to trust this phone when it is not a registered till. Fire-and-forget:
   * entry never waits on it, and selling is not blocked here.
   */
  askTillAccess?: (branchId: string) => Promise<void>;
  /** Asked only where shifts matter (the Cashier). Left out, or no answer, means shifts are on. */
  loadShiftsDisabled?: () => Promise<boolean>;
}

function notifyOwnerAboutTill(questions: EntryQuestions, till: TillCheck, branchId: string): void {
  if (!questions.askTillAccess) return;
  if (till !== 'not_registered' && till !== 'removed') return;
  void questions.askTillAccess(branchId).catch(() => undefined);
}

async function askTill(questions: EntryQuestions, branchId: string, limitMs: number): Promise<TillCheck> {
  if (!questions.checkTill) return 'unknown';
  try {
    return await withTimeout(questions.checkTill(branchId), limitMs, 'unknown' as TillCheck);
  } catch {
    // No answer is not "removed": the person keeps working.
    return 'unknown';
  }
}

async function shiftsAreOff(questions: EntryQuestions, limitMs: number): Promise<boolean> {
  if (!questions.loadShiftsDisabled) return false;
  try {
    return (await withTimeout(questions.loadShiftsDisabled(), limitMs, false)) === true;
  } catch {
    // No answer is not "off": the person is offered a shift, which always works.
    return false;
  }
}

async function branchNameFor(questions: EntryQuestions, branchId: string, limitMs: number): Promise<string | null> {
  try {
    const branches = await withTimeout(questions.loadBranches(), limitMs, [] as BranchOption[]);
    return branches.find((branch) => branch.id === branchId)?.name?.trim() || null;
  } catch {
    // The name is only for the header. The branch itself is already known.
    return null;
  }
}

async function settle(
  questions: EntryQuestions,
  user: StaffUser,
  branchId: string,
  knownName: string | null | undefined,
  limitMs: number
): Promise<EntryStage> {
  const [till, branchName, shiftsDisabled] = await Promise.all([
    askTill(questions, branchId, limitMs),
    knownName !== undefined ? Promise.resolve(knownName) : branchNameFor(questions, branchId, limitMs),
    shiftsAreOff(questions, limitMs),
  ]);
  if (till === 'removed') {
    notifyOwnerAboutTill(questions, till, branchId);
    return { name: 'removed', user, branchId };
  }
  // The shop passed /me but is switched off: every call from here would be turned away, and sales would be saved
  // as "offline" for a server that will refuse them.
  if (till === 'shop_off') return { name: 'shop_off' };
  notifyOwnerAboutTill(questions, till, branchId);
  return { name: 'ready', user, branchId, branchName, shiftsDisabled };
}

async function begin(questions: EntryQuestions, limitMs: number): Promise<EntryStage> {
  let user: StaffUser;
  try {
    user = await questions.loadMe();
  } catch (error) {
    if (isApiError(error)) {
      if (error.status === 401) return { name: 'signed_out' };
      if (error.status === 423) return { name: 'shop_off' };
    }
    return { name: 'check_failed' };
  }

  if (!user.roleKey) {
    return { name: 'no_role', user };
  }

  if (!fitsApp(questions.app, user.permissions)) {
    return { name: 'wrong_app', user, fits: appsThatFit(user.permissions) };
  }

  if (user.branchId) {
    return settle(questions, user, user.branchId, undefined, limitMs);
  }

  // The server ignores the branch a pinned role picks and refuses their shifts and sales without an assigned one.
  if (isBranchLockedRole(user.roleKey)) {
    return { name: 'no_branch_assigned', user };
  }

  let branches: BranchOption[];
  try {
    branches = await questions.loadBranches();
  } catch {
    return { name: 'branches_failed', user };
  }
  const first = branches[0];
  if (!first) return { name: 'no_branch', user };
  if (branches.length === 1) return settle(questions, user, first.id, first.name?.trim() || null, limitMs);
  return { name: 'pick_branch', user, branches };
}

export function enterApp(questions: EntryQuestions, limits: EntryLimits = {}): Promise<EntryStage> {
  return withTimeout<EntryStage>(
    begin(questions, limits.secondaryTimeoutMs ?? SECONDARY_TIMEOUT_MS),
    limits.timeoutMs ?? ENTRY_TIMEOUT_MS,
    { name: 'check_failed' }
  );
}

/** The person chose one of the branches the server listed. */
export function enterBranch(
  questions: EntryQuestions,
  user: StaffUser,
  branch: BranchOption,
  limits: EntryLimits = {}
): Promise<EntryStage> {
  return withTimeout<EntryStage>(
    settle(questions, user, branch.id, branch.name?.trim() || null, limits.secondaryTimeoutMs ?? SECONDARY_TIMEOUT_MS),
    limits.timeoutMs ?? ENTRY_TIMEOUT_MS,
    { name: 'check_failed' }
  );
}
