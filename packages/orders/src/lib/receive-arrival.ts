/**
 * How a delivery line was counted, and where it goes afterwards — the same model the web counter's unpack sheet uses.
 *
 * Stock does not move until put-away, and two of the four decisions never move it at all: a line that **didn't come** or
 * arrived **damaged** stays off the shelf, and the order stays partially delivered so the supplier can be shown the
 * difference. That is why the decision is kept beside the quantity rather than folded into it.
 */

export const ARRIVAL_AS_ORDERED = 'as_ordered';
export const ARRIVAL_MISSING = 'missing';
export const ARRIVAL_SHORT = 'short';
export const ARRIVAL_DAMAGED = 'damaged';

export type ArrivalDecision =
  | typeof ARRIVAL_AS_ORDERED
  | typeof ARRIVAL_MISSING
  | typeof ARRIVAL_SHORT
  | typeof ARRIVAL_DAMAGED;

export const PUT_AWAY_STOCK = 'stock';
export const PUT_AWAY_STORE = 'store';
export type PutAwayDestination = typeof PUT_AWAY_STOCK | typeof PUT_AWAY_STORE;

export type ArrivalMap = Record<string, ArrivalDecision | undefined>;

const MOVES: readonly ArrivalDecision[] = [ARRIVAL_AS_ORDERED, ARRIVAL_SHORT];

/** The decisions, in the order the sheet offers them. */
export const ARRIVAL_DECISIONS: readonly { id: ArrivalDecision; label: string }[] = [
  { id: ARRIVAL_AS_ORDERED, label: 'As ordered' },
  { id: ARRIVAL_SHORT, label: 'Short' },
  { id: ARRIVAL_MISSING, label: "Didn't come" },
  { id: ARRIVAL_DAMAGED, label: 'Damaged' },
];

function qtyWords(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(4))) : '0';
}

/**
 * What the count implies, when the clerk has not chosen.
 *
 * Nothing counted is "didn't come"; less than the rest is "short"; the rest is "as ordered". A line already marked
 * damaged stays damaged whatever the number says — the damage is a fact the count cannot overrule.
 */
export function retargetArrival(
  current: ArrivalMap,
  lineId: string,
  qty: number,
  remaining: number
): ArrivalMap {
  const decision = current[lineId];
  if (decision === ARRIVAL_DAMAGED) return current;
  if (qty <= 0) return decision == null ? current : { ...current, [lineId]: ARRIVAL_MISSING };
  if (qty < remaining) return { ...current, [lineId]: ARRIVAL_SHORT };
  return { ...current, [lineId]: ARRIVAL_AS_ORDERED };
}

/** Mark a line damaged, or clear that mark. */
export function toggleDamaged(current: ArrivalMap, lineId: string, remaining: number, qty: number): ArrivalMap {
  if (current[lineId] === ARRIVAL_DAMAGED) {
    const next = { ...current };
    delete next[lineId];
    return retargetArrival(next, lineId, qty, remaining);
  }
  return { ...current, [lineId]: ARRIVAL_DAMAGED };
}

/** What the line says under its name. */
export function arrivalLabel(decision: ArrivalDecision | undefined, qty: number, ordered: number): string | null {
  if (decision === ARRIVAL_MISSING) return "Didn't come";
  if (decision === ARRIVAL_DAMAGED) return `Damaged · ${qtyWords(qty)}`;
  if (decision === ARRIVAL_SHORT) return `Short · ${qtyWords(qty)} of ${qtyWords(ordered)}`;
  return null;
}

export type PutAwayPlan = { stockLines: { id: string; qty: number }[]; storeLines: { id: string; qty: number }[] };

/**
 * Which lines leave the dock, and where to. Missing and damaged lines are in neither list: they are held, and the shelf
 * is left alone. The web's copy keeps shelf lines as ids only and can default a whole pass to the store room; this one
 * keeps the quantity, and a line with no destination goes to the shelf. `test/put-away-agreement.test.ts` checks the split.
 */
export function planPutAway(
  openLineIds: readonly string[],
  decisions: ArrivalMap,
  qtyByLine: Record<string, number>,
  destByLine: Record<string, PutAwayDestination>
): PutAwayPlan {
  const stockLines: { id: string; qty: number }[] = [];
  const storeLines: { id: string; qty: number }[] = [];
  for (const id of openLineIds) {
    const decision = decisions[id];
    if (decision == null || !MOVES.includes(decision)) continue;
    const qty = qtyByLine[id] ?? 0;
    if (qty <= 0) continue;
    if ((destByLine[id] ?? PUT_AWAY_STOCK) === PUT_AWAY_STORE) storeLines.push({ id, qty });
    else stockLines.push({ id, qty });
  }
  return { stockLines, storeLines };
}

/** How the delivery came in, as one line: "12 as ordered · 2 short · 1 didn't come". */
export function tallyWords(openLineIds: readonly string[], decisions: ArrivalMap): string {
  let asOrdered = 0;
  let short = 0;
  let missing = 0;
  let damaged = 0;
  for (const id of openLineIds) {
    const decision = decisions[id];
    if (decision === ARRIVAL_AS_ORDERED) asOrdered += 1;
    else if (decision === ARRIVAL_SHORT) short += 1;
    else if (decision === ARRIVAL_MISSING) missing += 1;
    else if (decision === ARRIVAL_DAMAGED) damaged += 1;
  }
  const parts = [
    asOrdered > 0 ? `${asOrdered} as ordered` : null,
    short > 0 ? `${short} short` : null,
    missing > 0 ? `${missing} didn't come` : null,
    damaged > 0 ? `${damaged} damaged` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Nothing decided yet';
}
