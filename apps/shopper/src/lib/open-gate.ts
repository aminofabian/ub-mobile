/**
 * One shop is opened at a time, wherever the tap came from: the picker, the list of shops, a link that was
 * offered. Opening changes which shop the whole app works in, so two opens that overlap can leave the screen
 * showing one shop while the phone works in another. While one is running, another is refused, and every
 * control that would start one is switched off (see `useOpening`).
 *
 * No imports, so node can run this file's test directly.
 */
export type GateOutcome<T> = { ran: true; value: T } | { ran: false };

export interface OpenGate {
  isBusy(): boolean;
  /** Runs `work` unless another open is running. The gate is free again however `work` ends. */
  run<T>(work: () => Promise<T>): Promise<GateOutcome<T>>;
  /** Hears about every change between busy and free. Returns the way to stop listening. */
  subscribe(listener: () => void): () => void;
}

export function createOpenGate(): OpenGate {
  let busy = false;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of [...listeners]) {
      listener();
    }
  };
  return {
    isBusy: () => busy,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async run(work) {
      if (busy) {
        return { ran: false };
      }
      busy = true;
      notify();
      try {
        return { ran: true, value: await work() };
      } finally {
        busy = false;
        notify();
      }
    },
  };
}

/** The one gate the app uses. */
export const openGate = createOpenGate();
