import { asSetupRequired, isApiError } from '@kiosk/core';

/**
 * What it means for a queued request that sending it again failed.
 *
 *  - `wait`: nothing is wrong with the request. There was no answer (no connection, a timeout), or the server cannot
 *    take it just now (408, 429, a switched-off shop 423, a session that ended 401, a gateway with nothing behind it
 *    502, 503, 504 or Cloudflare's 520 to 524, which is what a deploy looks like from outside). It is tried again later
 *    and does not use up an attempt: a phone that was offline for an hour has not "failed" five times.
 *  - `setup`: the server needs a step done first (a shift opened, a till approved, a branch assigned). It waits for
 *    that, without using up an attempt.
 *  - `broken`: the server failed (another 5xx), or something in the way answered in its place (a 4xx that is a web
 *    page or nothing, from a firewall, a proxy or a login page), or it could not store the write and said nothing more
 *    (a 400 of type `data-integrity`: what the loser of two requests under one Idempotency-Key is told while the
 *    winner is recorded). Counts as an attempt, so a sale that crashes the server, or a block that does not lift, ends
 *    up in front of a person, and a blip does not. The next try under the same key is answered with the sale the
 *    winner recorded.
 *  - `conflict`: 409. The sale is flagged for a person.
 *  - `refused`: any other 4xx the app itself wrote. The server understood and said no, and asking again cannot change
 *    that, so the sale is flagged for a person at once and is not sent again by itself.
 *
 * It reads the status, never the words: a server's message is whatever it says, and a product called "Conflict" must
 * not turn a failure into one.
 */
export type ReplayFailure = 'wait' | 'setup' | 'broken' | 'conflict' | 'refused';

/** The `conflictType` of a sale the server refused. */
export const REFUSED = 'refused';

/** The server's catch-all for a write it could not store. Read from the problem's type, never from its words. */
function isDataIntegrity(error: { type?: string }): boolean {
  return typeof error.type === 'string' && /(^|[:/])data-integrity$/.test(error.type);
}

export function classifyReplayFailure(error: unknown): ReplayFailure {
  if (!isApiError(error)) return 'wait';
  if (asSetupRequired(error)) return 'setup';
  const { status } = error;
  if (status === 401 || status === 408 || status === 423 || status === 429) return 'wait';
  if (status === 502 || status === 503 || status === 504 || (status >= 520 && status <= 524)) return 'wait';
  if (status === 409) return 'conflict';
  if (status === 400 && isDataIntegrity(error)) return 'broken';
  if (status >= 400 && status < 500) return error.foreign ? 'broken' : 'refused';
  return 'broken';
}
