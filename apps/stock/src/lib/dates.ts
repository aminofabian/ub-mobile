/** A calendar date as the server writes it: "2026-11-23", or [2026, 11, 23] when it sends the parts. Empty when it is neither. */
export function readDate(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every((part) => Number.isInteger(part) && part > 0)) {
    const [y, m, d] = value as number[];
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return '';
}

/** Today on this phone, as yyyy-mm-dd. The shop and the phone are in the same place, so the phone's own calendar is the shop's. */
export function todayOn(now: number): string {
  const date = new Date(now);
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Whole days from one date to another (negative when `to` is earlier). Null when either is not a date. */
export function daysBetween(from: string, to: string): number | null {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);
  if (!a || !b) return null;
  const day = (m: RegExpExecArray): number => Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
  return Math.round(day(b) - day(a));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** A moment as "23 Nov", on this phone's calendar. Empty when there is no moment. */
export function shortDate(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '';
  const date = new Date(ms);
  return `${date.getDate()} ${MONTHS[date.getMonth()] ?? ''}`.trim();
}
