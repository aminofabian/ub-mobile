import { asSetupRequired, isApiError } from '@kiosk/core';

/**
 * What it means for a queued request that sending it again failed.
 *
 *  - `wait`: nothing is wrong with the request. There was no answer (no connection, a timeout), or the server cannot
 *    take it just now (408, 429, a switched-off shop 423, a session that ended 401). It is tried again later and
 *    does not use up an attempt: a phone that was offline for an hour has not "failed" five times.
 *  - `setup`: the server needs a step done first (a shift opened, a till approved, a branch assigned). It waits for
 *    that, without using up an attempt.
 *  - `broken`: the server failed (5xx). Counts as an attempt, so a sale that crashes the server is looked at.
 *  - `conflict`: 409. The sale is flagged for a person.
 *  - `refused`: any other 4xx. The server understood and said no, and asking again cannot change that, so the sale
 *    is flagged for a person at once and is not sent again by itself.
 *
 * It reads the status, never the words: a server's message is whatever it says, and a product called "Conflict" must
 * not turn a failure into one.
 */
export type ReplayFailure = 'wait' | 'setup' | 'broken' | 'conflict' | 'refused';

/** The `conflictType` of a sale the server refused. */
export const REFUSED = 'refused';

export function classifyReplayFailure(error: unknown): ReplayFailure {
  if (!isApiError(error)) return 'wait';
  if (asSetupRequired(error)) return 'setup';
  const { status } = error;
  if (status === 401 || status === 408 || status === 423 || status === 429) return 'wait';
  if (status === 409) return 'conflict';
  if (status >= 400 && status < 500) return 'refused';
  return 'broken';
}
