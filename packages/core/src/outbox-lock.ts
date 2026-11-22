import { onRuntimeReset } from './storage';

/**
 * One change to the queued sales at a time, across every shop.
 *
 * A shop's queue is a list stored under one key. A change reads the list, edits it and writes it back,
 * so two changes that overlap lose one of them, and a lost change here is a lost sale. The tenant
 * module takes the same lock while it moves a queue to a shop's confirmed id or changes which shop is
 * active, so nothing is ever queued into a queue that is on its way somewhere else.
 *
 * It is not re-entrant: work that holds the lock must not ask for it again.
 */
let tail: Promise<unknown> = Promise.resolve();

export function withOutboxLock<T>(work: () => Promise<T>): Promise<T> {
  const run = tail.then(() => work());
  tail = run.catch(() => undefined);
  return run;
}

onRuntimeReset(() => {
  tail = Promise.resolve();
});
