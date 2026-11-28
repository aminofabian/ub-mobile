/**
 * A request that never answers must not hold a screen, or a sender, forever. After `ms` the wait ends with a
 * `TimeoutError`, which is not an `ApiError`, so every caller reads it as "no answer": the request may still reach the
 * server later. Nothing sent through here may depend on "no answer" meaning "it did not happen".
 */
export class TimeoutError extends Error {
  readonly ms: number;

  constructor(ms: number) {
    super(`No answer after ${Math.round(ms / 1000)} seconds`);
    this.name = 'TimeoutError';
    this.ms = ms;
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** How long a read, and a write, may take before the app stops waiting for the answer. */
export const READ_TIMEOUT_MS = 20_000;
export const WRITE_TIMEOUT_MS = 60_000;
