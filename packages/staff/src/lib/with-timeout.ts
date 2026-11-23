/**
 * Resolves with `fallback` when `work` has not settled within `ms`. The work is not cancelled: its late
 * answer is simply not used. A late failure is swallowed too, so a request nobody waits for any more can
 * never surface as an unhandled rejection.
 */
export function withTimeout<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work.then(
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
