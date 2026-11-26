/**
 * Who may do which stock job on a phone. The server is the authority and refuses what a person may not do; this only
 * decides which buttons to show, so nobody is offered a job that is certain to be turned down. It follows the web
 * grocery counter's rules (`grocery-counter-access`) so a shop's switches mean the same on both.
 *
 * One thing the phone cannot see: `GET /api/v1/me` lists only the permissions of a person's role. The server also hands
 * `inventory.write` to a stock manager, and to a grocery clerk when the shop allows the clerk to edit stock or write
 * off spoils, without putting it on the role. So a role is read here as well as the permission list.
 */

export type AccessUser = {
  roleKey: string | null | undefined;
  permissions: readonly string[];
};

export type StockSettings = {
  /** A grocery counter may write off spoiled stock. */
  spoils: boolean;
  /** A grocery counter may set how much is on the shelf. */
  stockEdit: boolean;
  /** A grocery counter may place Path A supplier orders. */
  orderPad: boolean;
};

/** What a shop that has changed nothing allows: jobs on. Used until the shop's own answer is in, and when it cannot be read. */
export const DEFAULT_STOCK_SETTINGS: StockSettings = { spoils: true, stockEdit: true, orderPad: true };

/**
 * The switches from `GET /api/v1/businesses/me` (`inventory.stockLevels`). Only a switch that is plainly `false` turns a
 * job off; a missing one, or one of the wrong type, leaves it on, as the web does.
 */
export function parseStockSettings(body: unknown): StockSettings {
  if (!body || typeof body !== 'object') return DEFAULT_STOCK_SETTINGS;
  const inventory = (body as { inventory?: unknown }).inventory;
  const levels = inventory && typeof inventory === 'object' ? (inventory as { stockLevels?: unknown }).stockLevels : null;
  if (!levels || typeof levels !== 'object') return DEFAULT_STOCK_SETTINGS;
  const switches = levels as Record<string, unknown>;
  return {
    spoils: switches.allowSpoilsForGroceryClerk !== false,
    stockEdit: switches.allowStockEditForGroceryClerk !== false,
    orderPad: switches.allowOrderPadForGroceryClerk !== false,
  };
}

export const INVENTORY_WRITE = 'inventory.write';
export const STOCK_TAKE_RUN = 'stocktake.run';
export const STOCK_TAKE_APPROVE = 'stocktake.approve';
export const INVENTORY_TRANSFER = 'inventory.transfer';
export const CATALOG_ITEMS_READ = 'catalog.items.read';
export const INVENTORY_READ = 'inventory.read';
export const GROCERY_INVOICES_CREATE = 'grocery.invoices.create';
export const GROCERY_INVOICES_PAY = 'grocery.invoices.pay';
export const GROCERY_INVOICES_CANCEL = 'grocery.invoices.cancel';
export const PURCHASING_PATH_A_WRITE = 'purchasing.path_a.write';

function has(user: AccessUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

function isGroceryCounterRole(roleKey: string | null | undefined): boolean {
  const key = (roleKey ?? '').trim().toLowerCase();
  return key === 'grocery_clerk' || key === 'grocery_manager';
}

/** The jobs the grocery counter can be switched to. */
export type CounterMode = 'sell' | 'spoils' | 'stockEdit';

/**
 * Whether this person may sell at the grocery counter — that is, build a basket and forward it to the till as an
 * invoice. It needs the permission to create an invoice (`grocery.invoices.create`); a grocery-counter role has it by
 * default, the way the server delegates it. Someone in the app only to edit stock or write off spoils does not sell,
 * and is not shown the counter.
 */
export function maySellAtCounter(user: AccessUser): boolean {
  return has(user, GROCERY_INVOICES_CREATE) || isGroceryCounterRole(user.roleKey);
}

/**
 * Whether this person may place Path A supplier orders from the grocery app
 * (web `canGroceryOrderPad`).
 */
export function mayOrderAtCounter(user: AccessUser, settings: StockSettings): boolean {
  if (!settings.orderPad) return false;
  return has(user, PURCHASING_PATH_A_WRITE) || isGroceryCounterRole(user.roleKey);
}

/**
 * The modes this person is offered at the grocery counter. Selling is there only for someone who may create an
 * invoice; someone who may write stock, or who works the grocery counter, also sees Spoils and Edit stock unless the
 * shop has switched the job off.
 */
export function counterModes(user: AccessUser, settings: StockSettings): CounterMode[] {
  const modes: CounterMode[] = [];
  if (maySellAtCounter(user)) modes.push('sell');
  const mayWrite = has(user, INVENTORY_WRITE) || isGroceryCounterRole(user.roleKey);
  if (mayWrite && settings.spoils) modes.push('spoils');
  if (mayWrite && settings.stockEdit) modes.push('stockEdit');
  return modes;
}

/**
 * In the Stock app: whether this person may set stock and write it off. The grocery counter's switches are about
 * grocery clerks and do not apply here. A stock manager has the right by default (the server delegates it).
 */
export function stockAppMayWrite(user: AccessUser): boolean {
  return has(user, INVENTORY_WRITE) || (user.roleKey ?? '').trim().toLowerCase() === 'stock_manager';
}

/** Whether this person may start and count a stock take. */
export function mayCountStock(user: AccessUser): boolean {
  return has(user, STOCK_TAKE_RUN);
}

/** Whether this person may close a stock take (the server needs `stocktake.approve`). */
export function mayCloseStockTake(user: AccessUser): boolean {
  return has(user, STOCK_TAKE_APPROVE);
}

/** Whether this person may send, receive and cancel transfers between branches. */
export function mayMoveStock(user: AccessUser): boolean {
  return has(user, INVENTORY_TRANSFER);
}
