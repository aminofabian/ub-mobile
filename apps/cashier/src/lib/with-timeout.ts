/**
 * Waits for `run` for at most `ms`. When the time is up it stops waiting and fails with the error `late` makes.
 * Whatever `run` does after that is ignored: its answer is dropped and its failure is not reported as unhandled.
 * It cannot cancel the work, so only use it where an answer that arrives late is safe to ignore.
 */
export function withTimeout<T>(run: () => Promise<T>, ms: number, late: () => Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(late()), ms);
    let pending: Promise<T>;
    try {
      pending = run();
    } catch (error) {
      clearTimeout(timer);
      reject(error);
      return;
    }
    pending.then(
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
