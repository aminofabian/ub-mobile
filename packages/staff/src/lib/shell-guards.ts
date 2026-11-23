import type { EntryStage } from './entry';

/**
 * The decisions the shell makes about answers that arrive late. They are plain functions so each one can be
 * tested: a screen that is not on the phone any more, or a shop that is not open any more, must not be handed
 * the answer to a question that was asked for it.
 */

export type ShellStageName = 'signin' | 'checking' | 'signing_out' | 'pairing' | Exclude<EntryStage['name'], 'signed_out'>;

/**
 * Whether "your session is gone" (a request failed and could not be refreshed) is news. On the sign-in screen, the
 * pairing screen and while signing out there is no session to lose: a request that was already on its way when the
 * person left must not put "You were signed out" on the screen they just reached.
 */
export function sessionLossMatters(stage: ShellStageName): boolean {
  return stage !== 'signin' && stage !== 'pairing' && stage !== 'signing_out';
}

/**
 * Whether the person is signed in and may be in the middle of something: a sale being rung, a branch being
 * chosen, an account being checked. A link that would take the phone to another shop waits for them to finish.
 */
export function holdsWork(stage: ShellStageName): boolean {
  return stage === 'ready' || stage === 'checking' || stage === 'pick_branch';
}

/**
 * Whether a link to a shop may be followed now. Any app or page can fire a link at the phone, and following one
 * to another shop ends the session and loses the cart; so while someone is working, only a link to the shop that
 * is already open (which changes nothing) is followed. A link that is not a shop link is left to the handler,
 * which ignores it.
 */
export function mayFollowShopLink(
  stage: ShellStageName,
  link: { slug: string | null; host: string | null } | null,
  here: { slug: string; host: string } | null
): boolean {
  if (!holdsWork(stage) || !here || !link) return true;
  const slug = link.slug?.trim().toLowerCase();
  const host = link.host?.trim().toLowerCase();
  const sameSlug = !!slug && slug === here.slug.trim().toLowerCase();
  const sameHost = !!host && host === here.host.trim().toLowerCase();
  return sameSlug || sameHost;
}

/**
 * What to do with a sign-in that has just come back.
 * - `use`: it is for the shop that is open and the sign-in screen is still showing.
 * - `end`: it is for the shop that is open, but the person has left the screen (for pairing, say). Its session is
 *   ended, not used: a PIN typed on one screen must not open another.
 * - `drop`: it is for a shop that is not open any more. Nothing was kept for it (the sign-in refuses to) and
 *   nothing is done here.
 */
export function judgeSignIn(answerShop: string, now: { shop: string | undefined; stage: ShellStageName }): 'use' | 'end' | 'drop' {
  if (!answerShop || answerShop !== now.shop) return 'drop';
  return now.stage === 'signin' ? 'use' : 'end';
}

/**
 * Whether the answer to an entry check (who is this, which branch, is this phone still a till) is still wanted:
 * nothing newer has started since, and the phone is still at the shop it was asked for.
 */
export function wantsEntryAnswer(
  started: { attempt: number; shop: string },
  now: { attempt: number; shop: string | undefined }
): boolean {
  return started.attempt === now.attempt && started.shop === now.shop;
}

/**
 * Whether the session is ended as soon as this screen is shown. Nothing on these screens asks the server
 * anything, and the only way on is to sign in again, so the phone does not keep a session nobody can use.
 * The screens that offer "Check again" need theirs.
 */
export function endsSessionOn(stage: EntryStage['name']): boolean {
  return stage === 'wrong_app' || stage === 'removed' || stage === 'no_role' || stage === 'no_branch_assigned';
}
