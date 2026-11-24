import { signedCents } from './owner-money';

/** One business day as the server's finance pulse reports it. A figure it did not send, or sent in a shape we do not trust, is null and never zero. */
export type Pulse = {
  /** The day this is about, `YYYY-MM-DD`, in the shop's own time zone as the server counts it. */
  date: string;
  salesCount: number | null;
  revenueCents: number | null;
  profitCents: number | null;
  expensesCents: number | null;
  netCents: number | null;
  openShifts: number | null;
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function whole(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/** The day before a `YYYY-MM-DD` date, or null when the text is not a real calendar day. No time zone is involved. */
export function dayBefore(date: string): string | null {
  const match = DAY.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // `Date.UTC` reads a year below 100 as 19xx, so the day is set on a date at midnight UTC instead.
  const start = new Date(0);
  start.setUTCFullYear(year, month - 1, day);
  // A day that does not exist (the 30th of February, a 13th month) rolls over into another month, so the month and the day say so.
  if (start.getUTCMonth() !== month - 1 || start.getUTCDate() !== day) return null;
  const before = new Date(start.getTime() - 86_400_000);
  return `${String(before.getUTCFullYear()).padStart(4, '0')}-${two(before.getUTCMonth() + 1)}-${two(before.getUTCDate())}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

/** "Tuesday 24 November" for `2026-11-24`, or an empty string when the text is not a real calendar day. */
export function dayWords(date: string): string {
  if (dayBefore(date) === null) return '';
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const when = new Date(0);
  when.setUTCFullYear(year, month - 1, day);
  return `${WEEKDAYS[when.getUTCDay()]} ${day} ${MONTHS[month - 1]}`;
}

/** The answer of `GET /api/v1/finance/pulse`. Null when it is not a pulse at all (no real date), which is a failed read. */
export function readPulse(raw: unknown): Pulse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.date !== 'string' || dayBefore(row.date) === null) return null;
  return {
    date: row.date,
    salesCount: whole(row.salesCount),
    revenueCents: signedCents(row.revenue),
    profitCents: signedCents(row.grossProfit),
    expensesCents: signedCents(row.expensesTotal),
    netCents: signedCents(row.netOperating),
    openShifts: whole(row.openShifts),
  };
}
