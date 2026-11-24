import { isApiError, readFailureWords } from '@kiosk/core';

/**
 * One thing the Owner app reads from the server, with what it knows about it. Each tile and list has its own, so a
 * failure in one never blanks the others, and a failed refresh keeps what was last read (marked as old) instead of
 * showing nothing.
 */
export type Loaded<T> =
  | { state: 'loading' }
  | { state: 'ok'; value: T; stale: boolean }
  | { state: 'denied'; words: string }
  | { state: 'failed'; words: string };

export const LOADING: { state: 'loading' } = { state: 'loading' };

export function loadedOk<T>(value: T): Loaded<T> {
  return { state: 'ok', value, stale: false };
}

/** The same state with what was read turned into something else (a tile's words, say). A read that is not an answer stays what it was. */
export function mapLoaded<T, U>(state: Loaded<T>, convert: (value: T) => U): Loaded<U> {
  return state.state === 'ok' ? { state: 'ok', value: convert(state.value), stale: state.stale } : state;
}

const NOT_UNDERSTOOD = 'The server answered with something this app does not understand. Try again in a minute.';

/**
 * What a read that did not give an answer means: the role is not allowed (`denied`), or it could not be done
 * (`failed`). A role that is no longer allowed is shown as that even when an older answer is held. For any other
 * failure an older answer stays, marked as old.
 */
export function loadedFailure<T>(error: unknown, previous: Loaded<T>): Loaded<T> {
  if (isApiError(error) && error.status === 403 && !error.foreign) return { state: 'denied', words: readFailureWords(error) };
  if (previous.state === 'ok') return { state: 'ok', value: previous.value, stale: true };
  return { state: 'failed', words: readFailureWords(error) };
}

/** An answer the app could read as what it asked for, or the failure that says it was not. */
export function loadedFromRead<T>(value: T | null, previous: Loaded<T>): Loaded<T> {
  if (value !== null) return loadedOk(value);
  if (previous.state === 'ok') return { state: 'ok', value: previous.value, stale: true };
  return { state: 'failed', words: NOT_UNDERSTOOD };
}
