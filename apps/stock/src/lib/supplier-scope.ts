import type { SupplierItemLinkRecord, SupplierRecord } from '@kiosk/orders';

/**
 * Counting by supplier: the same stock take, seen through the products one supplier sends.
 *
 * The take the server opens covers the whole shelf, and every line belongs to it — so this is a *view*, not a second
 * take. A count typed against a scoped list is the same count against the same line, sent the same way. A supplier whose
 * products are not on the shelf scopes to nothing, and the screen says so rather than showing an empty list as if the
 * shelf were empty.
 */

/** A supplier this shop buys from. The links are read one supplier at a time, so the count of products is not known yet. */
export type SupplierChoice = { id: string; name: string };

export function suppliersForCounting(suppliers: readonly SupplierRecord[]): SupplierChoice[] {
  return suppliers
    .filter((supplier) => supplier.status?.toLowerCase() === 'active' && !supplier.deletedAt)
    // "Unassigned (migrate)" is where the migration parks unfiled products: not a supplier to count for
    .filter((supplier) => !/^unassigned/i.test((supplier.name ?? '').trim()))
    .map((supplier) => ({ id: supplier.id, name: supplier.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The product ids one supplier sends, so the list can be held to them. */
export function itemIdsOf(links: readonly SupplierItemLinkRecord[]): Set<string> {
  return new Set(links.map((link) => link.itemId));
}
