/**
 * When the basket is told to the shop.
 *
 * A tap is shown at once and sent a moment later, so a burst of taps is one call. When the shop does not
 * answer the basket is tried again after a wait that grows (5 s, 10 s, 20 s ... a minute), and a new tap
 * does not make the shopper wait out the rest of it. The screens ask for an immediate send when they open
 * on the basket, and when the app comes back to the front.
 *
 * Timers are passed in, so the waits can be tested without waiting. Imports only other pure files, so node
 * can run this file's test directly.
 */
import { hasPending, nextRetryDelayMs } from './basket';
import type { BasketStore } from './basket-store';
import type { SyncResult, SyncRunner } from './basket-sync';
import { ShopApiError } from './shop-http';

export interface Timers {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
  now(): number;
}

export type SyncStatus = 'idle' | 'sending' | 'no-signal';

export interface SchedulerState {
  status: SyncStatus;
  /** Sends in a row that got no answer. */
  failures: number;
  lastError: ShopApiError | null;
}

export interface BasketScheduler {
  /** The basket changed, or something suggests the signal is back: send it soon. */
  poke(): void;
  /** Send now, and say how it went. */
  syncNow(): Promise<SyncResult>;
  state(): SchedulerState;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

/** How long a change waits for more taps before it is sent. */
export const POKE_DELAY_MS = 350;

export function createBasketScheduler(deps: { store: BasketStore; runner: SyncRunner; timers: Timers }): BasketScheduler {
  const { store, runner, timers } = deps;
  let snapshot: SchedulerState = { status: 'idle', failures: 0, lastError: null };
  let timer: { handle: unknown; at: number } | null = null;
  let flight: Promise<SyncResult> | null = null;
  let disposed = false;
  const listeners = new Set<() => void>();

  const set = (next: SchedulerState) => {
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };
  const clearTimer = () => {
    if (timer) timers.clear(timer.handle);
    timer = null;
  };
  /** One timer at a time; it is moved only to an earlier time. */
  const schedule = (inMs: number, replace = false) => {
    if (disposed) return;
    const at = timers.now() + inMs;
    if (timer && !replace && timer.at <= at) return;
    clearTimer();
    timer = {
      at,
      handle: timers.set(() => {
        timer = null;
        void execute();
      }, inMs),
    };
  };

  /** One send at a time. A second ask while one is on its way is folded into it, and counted once. */
  function execute(): Promise<SyncResult> {
    if (disposed) return Promise.resolve({ kind: 'idle' });
    if (flight) {
      void runner.run();
      return flight;
    }
    clearTimer();
    if (!hasPending(store.get())) {
      if (snapshot.status !== 'idle' || snapshot.failures !== 0) set({ status: 'idle', failures: 0, lastError: null });
      return Promise.resolve({ kind: 'idle' });
    }
    set({ ...snapshot, status: 'sending' });
    const current = (async (): Promise<SyncResult> => {
      let result: SyncResult;
      try {
        result = await runner.run();
      } catch {
        // The runner does not throw on purpose. If it ever does, that is treated like no signal, so the wait
        // grows, instead of the basket being sent again every third of a second.
        result = { kind: 'offline', error: new ShopApiError('network', null, '') };
      }
      if (disposed) return result;
      if (result.kind === 'offline') {
        const failures = snapshot.failures + 1;
        set({ status: 'no-signal', failures, lastError: result.error });
        schedule(nextRetryDelayMs(failures), true);
      } else {
        set({ status: 'idle', failures: 0, lastError: null });
        if (hasPending(store.get())) schedule(POKE_DELAY_MS);
      }
      return result;
    })().finally(() => {
      flight = null;
    });
    flight = current;
    return current;
  }

  const stopListening = store.subscribe(() => {
    if (disposed) return;
    if (hasPending(store.get())) {
      // A change while a send is on its way is picked up by that send, or by the next.
      if (snapshot.status !== 'sending') schedule(POKE_DELAY_MS);
    } else if (snapshot.status === 'no-signal') {
      // Whatever was waiting has been taken back out: there is nothing left to retry.
      clearTimer();
      set({ status: 'idle', failures: 0, lastError: null });
    }
  });

  return {
    poke() {
      if (hasPending(store.get()) && snapshot.status !== 'sending') schedule(POKE_DELAY_MS);
    },
    syncNow: () => execute(),
    state: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      clearTimer();
      stopListening();
      listeners.clear();
    },
  };
}
