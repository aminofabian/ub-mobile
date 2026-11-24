import type { CreditSummary } from './credit';
import { kesOrDash } from './owner-money';
import { awaitingCount, type OwnerOrder } from './orders';
import type { Pulse } from './pulse';

/** What one tile on Today shows: the figure, a line under it, and how loudly to say it. */
export type Tone = 'ok' | 'ask' | 'warn' | 'quiet';
/** A real today-vs-yesterday move, shown next to the headline figure. Never invented: null when there is no yesterday. */
export type Trend = { dir: 'up' | 'down' | 'flat'; label: string; spoken: string };
export type TileView = { value: string; note: string | null; tone: Tone; trend?: Trend | null };

/** The change from yesterday as a whole-percent move, or "flat" when it barely moved and null when there is nothing to compare. */
function trendFrom(todayCents: number | null, yesterdayCents: number | null): Trend | null {
  if (todayCents === null || yesterdayCents === null) return null;
  // The pill sits next to a note that already names yesterday, so the visible label stays to the delta alone;
  // `spoken` carries the full sentence for a screen reader.
  if (yesterdayCents === 0) {
    if (todayCents === 0) return { dir: 'flat', label: 'level', spoken: 'same as yesterday' };
    return { dir: 'up', label: 'new', spoken: 'up on yesterday' };
  }
  const pct = Math.round(((todayCents - yesterdayCents) / yesterdayCents) * 100);
  if (pct === 0) return { dir: 'flat', label: 'level', spoken: 'level with yesterday' };
  const dir = pct > 0 ? 'up' : 'down';
  return { dir, label: `${Math.abs(pct)}%`, spoken: `${Math.abs(pct)} percent ${pct > 0 ? 'up' : 'down'} on yesterday` };
}

/** "1 sale", "3 sales". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Today's takings, how many sales made them, and what yesterday came to when that is known. */
export function takingsView(pulse: Pulse, yesterday: Pulse | null): TileView {
  const sales = pulse.salesCount === null ? null : plural(pulse.salesCount, 'sale', 'sales');
  const before = yesterday !== null && yesterday.revenueCents !== null ? `yesterday ${kesOrDash(yesterday.revenueCents)}` : null;
  return {
    value: kesOrDash(pulse.revenueCents),
    note: [sales, before].filter((part): part is string => part !== null).join(' · ') || null,
    tone: pulse.revenueCents === null ? 'quiet' : 'ok',
    trend: trendFrom(pulse.revenueCents, yesterday?.revenueCents ?? null),
  };
}

/** Tills that are open now. */
export function shiftsView(pulse: Pulse): TileView {
  const open = pulse.openShifts;
  if (open === null) return { value: '—', note: null, tone: 'quiet' };
  if (open === 0) return { value: '0', note: 'No till is open', tone: 'quiet' };
  return { value: String(open), note: open === 1 ? 'Till is open' : 'Tills are open', tone: 'ok' };
}

/** Web orders that are paid and waiting for the owner to confirm them. */
export function ordersView(orders: readonly OwnerOrder[]): TileView {
  const waiting = awaitingCount(orders);
  if (waiting === 0) return { value: '0', note: 'Nothing waiting for you', tone: 'quiet' };
  return { value: String(waiting), note: waiting === 1 ? 'Order to confirm' : 'Orders to confirm', tone: 'ask' };
}

/**
 * Items that need stocking at this branch: the ones that are out and the ones running low. An item is one or the other
 * (the server keeps the two lists apart), so the headline is their sum and the line under it says how it splits.
 */
export function stockView(counts: { low: number; out: number }): TileView {
  const { low, out } = counts;
  if (low === 0 && out === 0) return { value: '0', note: 'Nothing is low or out', tone: 'quiet' };
  const parts = [out > 0 ? `${out} out` : null, low > 0 ? `${low} running low` : null].filter((part): part is string => part !== null);
  return { value: String(low + out), note: parts.join(' · '), tone: 'warn' };
}

/** What customers owe the shop, and what came in today. */
export function creditView(summary: CreditSummary): TileView {
  const owed = summary.owedCents;
  const people = summary.openTabs === null ? null : plural(summary.openTabs, 'person', 'people');
  const collected = summary.collectedCents !== null && summary.collectedCents > 0 ? `${kesOrDash(summary.collectedCents)} paid today` : null;
  const note = [people, collected].filter((part): part is string => part !== null).join(' · ') || null;
  return { value: kesOrDash(owed), note, tone: owed !== null && owed > 0 ? 'warn' : 'quiet' };
}
