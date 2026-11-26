import type { TillPrintTarget } from '../api/till-prints';

/**
 * What to tell the clerk after an order/receipt slip was queued for one or more
 * tills (web `describeTillSend`).
 */
export function describeTillSend(
  kind: 'order' | 'receipt',
  tills: readonly TillPrintTarget[],
): string {
  const label = kind === 'receipt' ? 'Receipt' : 'Order';
  const names = (rows: readonly TillPrintTarget[]) =>
    rows.map((row) => row.name?.trim() || 'the till').join(', ');
  const online = tills.filter((row) => row.online);
  const offline = tills.filter((row) => !row.online);
  if (tills.length === 0) {
    return `${label} queued for the till.`;
  }
  if (offline.length === 0) {
    return `${label} sent to ${names(online)}. Their screen will chime and the slip will print.`;
  }
  if (online.length === 0) {
    const who = names(offline);
    return tills.length === 1
      ? `${who} is not on Sell right now. The slip is waiting — they will hear a chime and it will print when they open the till.`
      : `${who} are not on Sell right now. The slips are waiting until they open the till.`;
  }
  return `${label} printing for ${names(online)}. ${names(offline)} will get it when they open Sell.`;
}
