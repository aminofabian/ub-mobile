/**
 * When to ask the platform about itself again (the oldest version it will run, versions it has pulled).
 * The app asks when it starts; a phone can keep the app in memory for days, and a minimum raised in the
 * meantime would never reach it. It is asked again when the app comes back to the front, not more often
 * than this, and sooner when the last answer never arrived.
 *
 * No imports, so node can run this file's test directly.
 */
export const PLATFORM_REFRESH_MS = 30 * 60 * 1000;
export const PLATFORM_RETRY_MS = 60 * 1000;

export function shouldAskPlatformAgain(input: { now: number; lastAskedAt: number; haveAnswer: boolean }): boolean {
  const wait = input.haveAnswer ? PLATFORM_REFRESH_MS : PLATFORM_RETRY_MS;
  return input.now - input.lastAskedAt >= wait;
}
