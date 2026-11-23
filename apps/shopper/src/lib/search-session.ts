import type { SearchResult, StoreHit } from '@kiosk/core';

/**
 * The search box's behaviour, apart from the screen: wait a moment after the last key, ask, and keep only
 * the answer to the latest question. A slow answer to "fre" must never replace the answer to "fresh".
 *
 * Time and the network are passed in, so the test can run it with neither. No imports but types.
 */
export const SEARCH_DELAY_MS = 300;

export type SearchView =
  | { kind: 'idle' }
  /** Waiting for the pause to end or for the answer. `hits` is the last answer, kept on screen meanwhile. */
  | { kind: 'searching'; text: string; hits: StoreHit[] }
  | { kind: 'results'; text: string; hits: StoreHit[] }
  | { kind: 'empty'; text: string }
  | { kind: 'offline'; text: string }
  | { kind: 'rate_limited'; text: string; retryAfterSec?: number }
  | { kind: 'unavailable'; text: string };

export interface SearchDeps {
  search: (text: string) => Promise<SearchResult>;
  /** The same tidying the request will get, so "ab" and "ab " are one question. */
  clean: (text: string) => string;
  minLength: number;
  delayMs?: number;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface SearchSession {
  /** The box changed. */
  update: (text: string) => void;
  /** Search now, without the pause: the keyboard's Go. */
  submit: () => void;
  /** Ask again after a failure. */
  retry: () => void;
  dispose: () => void;
}

export function createSearchSession(deps: SearchDeps, onChange: (view: SearchView) => void): SearchSession {
  const delay = deps.delayMs ?? SEARCH_DELAY_MS;
  const setTimer = deps.setTimer ?? ((run: () => void, ms: number) => setTimeout(run, ms));
  const clearTimer = deps.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let current = '';
  let generation = 0;
  let timer: unknown = null;
  let lastHits: StoreHit[] = [];
  let disposed = false;

  const emit = onChange;

  const stopTimer = () => {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  };

  async function ask(text: string, asked: number) {
    let result: SearchResult;
    try {
      result = await deps.search(text);
    } catch {
      result = { kind: 'offline' };
    }
    // The box changed, or a newer question was sent, while this one was away: its answer is old news.
    if (disposed || asked !== generation) {
      return;
    }
    switch (result.kind) {
      case 'results':
        lastHits = result.hits;
        emit(result.hits.length > 0 ? { kind: 'results', text, hits: result.hits } : { kind: 'empty', text });
        return;
      case 'too_short':
        emit({ kind: 'idle' });
        return;
      case 'offline':
        emit({ kind: 'offline', text });
        return;
      case 'rate_limited':
        emit({ kind: 'rate_limited', text, ...(result.retryAfterSec !== undefined ? { retryAfterSec: result.retryAfterSec } : {}) });
        return;
      case 'unavailable':
        emit({ kind: 'unavailable', text });
        return;
    }
  }

  function askNow() {
    if (disposed) {
      return;
    }
    stopTimer();
    generation += 1;
    emit({ kind: 'searching', text: current, hits: lastHits });
    void ask(current, generation);
  }

  return {
    update(text) {
      if (disposed) {
        return;
      }
      const cleaned = deps.clean(text);
      if (cleaned === current) {
        return;
      }
      current = cleaned;
      generation += 1;
      stopTimer();
      if (cleaned.length < deps.minLength) {
        lastHits = [];
        emit({ kind: 'idle' });
        return;
      }
      emit({ kind: 'searching', text: cleaned, hits: lastHits });
      const asked = generation;
      timer = setTimer(() => {
        timer = null;
        void ask(cleaned, asked);
      }, delay);
    },
    submit() {
      if (current.length >= deps.minLength) {
        askNow();
      }
    },
    retry() {
      if (current.length >= deps.minLength) {
        askNow();
      }
    },
    dispose() {
      disposed = true;
      stopTimer();
    },
  };
}
