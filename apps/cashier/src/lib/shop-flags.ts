/**
 * What this shop lets a till do, and what this person is allowed to. The server decides both on every request: the
 * till reads them only to leave out a button that would be refused, and above all to find out BEFORE the customer has
 * paid, not after, that a changed price will not be accepted.
 */

export type ShopFlags = Readonly<Record<string, boolean>>;

/** The shop settings the till reads (the server's names for them). */
export const FLAG = {
  /** Cashiers may sell at a price other than the shelf's. */
  priceEdit: 'pos.cashier_price_edit',
  /** Cashiers may add a product from the till. */
  createProduct: 'pos.cashier_create_product',
  /** Cashiers may mark a product as sold by weight. On unless the owner turns it off. */
  weighedToggle: 'pos.cashier_weighed_toggle',
} as const;

/** The permissions the till reads. */
export const PERMISSION = {
  sell: 'sales.sell',
  setPrice: 'pricing.sell_price.set',
  writeCatalog: 'catalog.items.write',
  readWebOrders: 'storefront.orders.read',
} as const;

const MAX_FLAGS = 200;
const FLAG_NAME = /^[A-Za-z0-9_.:-]{1,80}$/;

/**
 * The shop's feature flags from `GET /api/v1/businesses/me`. Only real booleans with plain names are read: a flag the
 * server sent as text or a number is not "on". A shop that sent none has none on.
 */
export function parseShopFlags(body: unknown): ShopFlags {
  if (!body || typeof body !== 'object') return {};
  const raw = (body as { featureFlags?: unknown }).featureFlags;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const flags: Record<string, boolean> = {};
  for (const [name, value] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_FLAGS)) {
    if (typeof value === 'boolean' && FLAG_NAME.test(name)) flags[name] = value;
  }
  return flags;
}

function holds(permissions: readonly string[], key: string): boolean {
  return permissions.includes(key);
}

/** The server's own rule for a price that is not the shelf's: the permission, or the shop letting cashiers do it. */
export function mayChangePrice(flags: ShopFlags, permissions: readonly string[]): boolean {
  return holds(permissions, PERMISSION.setPrice) || flags[FLAG.priceEdit] === true;
}

/**
 * The server's own rule for adding a product from the till: the right to write the catalogue or the shop letting
 * cashiers create products, and a way to set its price (the right, or either shop setting).
 */
export function mayCreateProduct(flags: ShopFlags, permissions: readonly string[]): boolean {
  const create = flags[FLAG.createProduct] === true;
  const mayWrite = holds(permissions, PERMISSION.writeCatalog) || create;
  const mayPrice = holds(permissions, PERMISSION.setPrice) || flags[FLAG.priceEdit] === true || create;
  return mayWrite && mayPrice;
}

/** The server's own rule for marking a product as sold by weight: the right, or the shop not having turned it off. */
export function mayMarkWeighed(flags: ShopFlags, permissions: readonly string[]): boolean {
  return holds(permissions, PERMISSION.writeCatalog) || flags[FLAG.weighedToggle] !== false;
}

/** Seeing the shop's web orders needs the storefront permission: the server does not give it to a plain cashier. */
export function mayListWebOrders(permissions: readonly string[]): boolean {
  return holds(permissions, PERMISSION.readWebOrders);
}

/** Moving a paid web order along (confirm, ready, complete) is open to anyone who can sell, or see web orders. */
export function mayAdvanceWebOrders(permissions: readonly string[]): boolean {
  return holds(permissions, PERMISSION.sell) || holds(permissions, PERMISSION.readWebOrders);
}
