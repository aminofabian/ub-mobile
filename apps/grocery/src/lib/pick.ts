import { parseQty, qtyProblemWords, QTY_SCALE } from '@kiosk/core';
import { addItem, emptyBasket, type BasketProblem, type SaleItem } from './basket';

/** What choosing an item at the counter does. */
export type PickPlan =
  /** Put this many in the basket now. */
  | { kind: 'add'; units: number }
  /** A weighed item: ask how much first. */
  | { kind: 'weigh' }
  /** It cannot be sold, and why. */
  | { kind: 'refuse'; why: BasketProblem };

const NOBODY = { ownerId: '', branchId: '' };

/**
 * `WeightSheet` answers in thousandths of a unit (1 kg → 1000). The basket stores ten-thousandths
 * (`QTY_SCALE` = 10_000, so 1 kg → 10_000). Without this, tapping "1" put 0.1 kg in the basket.
 */
export function unitsFromThousandths(thousandths: number): number {
  return thousandths * (QTY_SCALE / 1000);
}

/**
 * One of a thing sold one by one goes straight into the basket. A thing sold by weight asks how much. A thing that
 * cannot be sold (switched off, or with no price) is said so before anyone is asked a weight for it. The rules of what
 * can be sold are the basket's own: this asks it, so the two can never disagree.
 */
export function planPick(item: SaleItem): PickPlan {
  const probe = addItem(emptyBasket(NOBODY, 0), item, QTY_SCALE, 0, 'probe');
  if (!probe.ok) return { kind: 'refuse', why: probe.why };
  return item.weighed ? { kind: 'weigh' } : { kind: 'add', units: QTY_SCALE };
}

export type TypedQuantity = { ok: true; units: number } | { ok: false; words: string };

/** A quantity typed in a box, in ten-thousandths, or what is wrong with it. The basket then says if the item can take it. */
export function typedQuantity(text: string): TypedQuantity {
  const entry = parseQty(text);
  return entry.ok ? { ok: true, units: entry.units } : { ok: false, words: qtyProblemWords(entry.problem) };
}
