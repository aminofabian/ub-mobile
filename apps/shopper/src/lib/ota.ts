import * as Updates from 'expo-updates';

const WAIT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    void promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

/**
 * Download a waiting OTA and restart into it. Expo’s default only applies the
 * bundle on the *next* cold start, which looks like “nothing changed” after a
 * portal reinstall. No-ops in Expo Go / dev.
 */
export async function applyWaitingOta(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled) return;
  const check = await withTimeout(Updates.checkForUpdateAsync(), WAIT_MS);
  if (!check?.isAvailable) return;
  const fetched = await withTimeout(Updates.fetchUpdateAsync(), WAIT_MS);
  if (!fetched?.isNew) return;
  await Updates.reloadAsync();
}
