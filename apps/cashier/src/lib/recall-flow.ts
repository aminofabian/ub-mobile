import type { CartLine } from './cart';
import { describeRecall, refreshLines, type Freshness, type HeldBasket } from './holds';

/**
 * Brings a held basket up to date before it is put in front of the cashier. The shop is asked about each line; an
 * answer that cannot be had at all (no connection, a failed request) leaves every line as it was held, said plainly,
 * rather than stopping the cashier from picking their basket up.
 */
export async function prepareRecall(
  basket: HeldBasket,
  askShop: (lines: readonly CartLine[]) => Promise<Freshness>
): Promise<{ lines: CartLine[]; notes: string[] }> {
  let fresh: Freshness = {};
  try {
    fresh = await askShop(basket.lines);
  } catch {
    fresh = {};
  }
  const { lines, report } = refreshLines(basket.lines, fresh);
  return { lines, notes: describeRecall(report) };
}
