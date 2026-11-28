import { stockAppMayWrite, type AccessUser } from '@kiosk/core';

/**
 * Which parts of the Owner app a person is offered. The server is the authority and refuses what a role may not do;
 * this only decides which tabs and buttons to show, so nobody is offered a job that is certain to be turned down. It
 * reads the person's permission list (`StaffUser.permissions`), never a role name: a shop can change what a role may do.
 */

export type OwnerAccess = {
  /** Today's takings and the count of open shifts (`finance.reports.read`). */
  takings: boolean;
  /**
   * The list of web orders, and moving a paid order along (`storefront.orders.read`). The server also lets anyone who
   * can sell move an order along, but without the list there is nothing on this phone to move.
   */
  orders: boolean;
  /** The low and out of stock lists (`catalog.items.read`). */
  stock: boolean;
  /** Setting how much of an item is on the shelf (`inventory.write`, or a stock manager). */
  writeStock: boolean;
  /** Who owes the shop what (`credits.customers.read`). */
  credit: boolean;
  /** Recording a payment against a tab (`credits.claims.review`). */
  recordPayments: boolean;
  /**
   * Receiving a delivery against a purchase order, and ordering from suppliers. Both need `purchasing.path_a.read` (to
   * list and open the orders) and `purchasing.path_a.write` (to place one and to confirm what arrived). With only one of
   * the two the screen opens and then fails, so neither alone is offered.
   */
  receive: boolean;
  /** Selling from the back office: the till's own permission, `sales.sell`. */
  sell: boolean;
  /** The counter invoices, and what is owed on them (`grocery.invoices.read`). */
  invoices: boolean;
};

function has(user: AccessUser, permission: string): boolean {
  return user.permissions.includes(permission);
}

export function ownerAccess(person: AccessUser): OwnerAccess {
  // A person from the server always has a list. One built some other way (a preview with a made-up person) may not, and
  // gets no access rather than a crash.
  const user: AccessUser = { roleKey: person.roleKey, permissions: Array.isArray(person.permissions) ? person.permissions : [] };
  return {
    takings: has(user, 'finance.reports.read'),
    orders: has(user, 'storefront.orders.read'),
    stock: has(user, 'catalog.items.read'),
    writeStock: stockAppMayWrite(user),
    credit: has(user, 'credits.customers.read'),
    recordPayments: has(user, 'credits.claims.review'),
    receive: has(user, 'purchasing.path_a.read') && has(user, 'purchasing.path_a.write'),
    sell: has(user, 'sales.sell'),
    invoices: has(user, 'grocery.invoices.read'),
  };
}

export type OwnerTab = 'Sell' | 'Today' | 'Invoices' | 'Orders' | 'Stock' | 'Credit' | 'More';

/** The tabs this person gets, in order. Today and More are always there: Today says what it cannot show, and More signs out. */
export function visibleTabs(access: OwnerAccess): OwnerTab[] {
  // Selling comes first for anyone who may: it is the job the shop actually does.
  const tabs: OwnerTab[] = access.sell ? ['Sell', 'Today'] : ['Today'];
  if (access.invoices) tabs.push('Invoices');
  if (access.orders) tabs.push('Orders');
  if (access.stock) tabs.push('Stock');
  if (access.credit) tabs.push('Credit');
  tabs.push('More');
  return tabs;
}
