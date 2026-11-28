/**
 * What one tap on an out-of-stock tile does.
 *
 * An empty shelf is the one tap worth a second look: the till asks "sell anyway?" before it puts a product in, so a
 * slipped finger never rings up stock the shop does not have. When the shop itself allows selling from an empty shelf,
 * that question has already been answered by the owner, and the tap simply adds.
 */
export function stockTap(input: { out: boolean; armed: boolean; allowOutOfStock: boolean }): 'arm' | 'add' {
  return input.out && !input.armed && !input.allowOutOfStock ? 'arm' : 'add';
}
