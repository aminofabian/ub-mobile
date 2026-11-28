/**
 * What to call a supplier who is not really one.
 *
 * A shop migrated from another system has every product linked to a bucket called "Unassigned (migrate)", kept under
 * the code `SYS-UNASSIGNED`. That bucket is a filing trick, not a company: it must never appear in a list of suppliers
 * a cashier can pick, and a product linked only to it has no supplier at all.
 */
export const SYSTEM_UNASSIGNED_SUPPLIER_CODE = 'SYS-UNASSIGNED';

/** What the till says where a product has no supplier: a fact, not a migrated placeholder. */
export const NO_SUPPLIER_WORDS = 'No supplier linked';

/** The names the bucket has worn: the migration's own, and the plain one someone may have typed since. */
const UNASSIGNED_NAMES = new Set(['unassigned (migrate)', 'unassigned (migrated)', 'unassigned']);

export function isSystemUnassignedSupplier(input: { code?: string | null; name?: string | null }): boolean {
  if (input.code?.trim().toUpperCase() === SYSTEM_UNASSIGNED_SUPPLIER_CODE) return true;
  const name = input.name?.trim().toLowerCase();
  return name !== undefined && UNASSIGNED_NAMES.has(name);
}

/** Only the suppliers a person could actually buy from. */
export function realSuppliers<T extends { code?: string | null; name?: string | null }>(list: readonly T[]): T[] {
  return list.filter((supplier) => !isSystemUnassignedSupplier(supplier));
}

/** The name to show for a supplier, or the till's words for "there is none". */
export function supplierNameOrLink(input: { name?: string | null; code?: string | null }): string {
  if (isSystemUnassignedSupplier(input)) return NO_SUPPLIER_WORDS;
  const trimmed = input.name?.trim();
  return trimmed ? trimmed : NO_SUPPLIER_WORDS;
}
