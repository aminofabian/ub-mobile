import { isApiError } from './problem';

/** 125050 -> "1,250.50". Always two decimals, thousands grouped by commas. A figure that is not a number shows as a dash. */
export function formatCents(cents: number): string {
  if (!Number.isFinite(cents)) return '—';
  const rounded = Math.round(cents);
  const negative = rounded < 0;
  const whole = Math.floor(Math.abs(rounded) / 100);
  const fraction = Math.abs(rounded) % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}.${String(fraction).padStart(2, '0')}`;
}

/** 125050 -> "KES 1,250.50". */
export function formatKes(cents: number): string {
  return `KES ${formatCents(cents)}`;
}

/**
 * What a failed read means, as a sentence for the person. The status is read, never the server's own words: the app
 * says what it can stand behind. Anything with no status (no signal, a request that took too long) is "could not reach".
 */
export function readFailureWords(error: unknown): string {
  if (isApiError(error)) {
    if (error.foreign) return 'The connection is not reaching the shop. A sign-in page for the wifi may be in the way.';
    if (error.status === 401) return 'You were signed out. Sign in again.';
    if (error.status === 403) return 'Your role is not allowed to see this.';
    if (error.status === 404) return 'That is no longer there.';
    if (error.status >= 500) return 'The server had a problem. Try again in a minute.';
  }
  return 'Could not reach the server. Check the signal and try again.';
}
