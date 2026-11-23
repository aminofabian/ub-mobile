/**
 * Which staff app a person's permissions fit (plan §5.11.4 rule 2).
 *
 * The server decides what a role may do. The app decides only where to send someone, so this reads
 * the permission keys the server returns and never the role key: a custom role that holds the
 * cashier's permissions is a cashier here, and a renamed role is not a stranger.
 *
 * "Fits" means the person holds at least one permission the app's first screens depend on. It keeps
 * out the clearly wrong (a barber in the Cashier) and leaves the rest to the server, which still
 * answers 403 to anything the person may not do.
 */

export type StaffApp = 'cashier' | 'grocery' | 'stock' | 'admin';

export const STAFF_APPS: readonly StaffApp[] = ['cashier', 'grocery', 'stock', 'admin'];

export const APP_NAMES: Readonly<Record<StaffApp, string>> = {
  cashier: 'Cashier',
  grocery: 'Grocery',
  stock: 'Stock',
  admin: 'Admin',
};

/** What each app is for, finishing "This app is for ...". */
export const APP_JOBS: Readonly<Record<StaffApp, string>> = {
  cashier: 'the till',
  grocery: 'counter invoices',
  stock: 'counting and moving stock',
  admin: 'running the shop',
};

/**
 * Read from the server's own rules, so the app and the server agree on what the first screens need.
 * Cashier: the ten permissions the server calls till work (`TillDeviceService.TILL_WORK_PERMISSIONS`,
 * ADR 0017). The others: the permission on each app's first calls.
 */
export const APP_ENTRY_PERMISSIONS: Readonly<Record<StaffApp, readonly string[]>> = {
  cashier: [
    'sales.sell',
    'sales.refund.create',
    'sales.void.any',
    'sales.void.own',
    'sales.payment.adjust',
    'sales.weighed.refund',
    'shifts.open',
    'shifts.close',
    'shifts.update',
    'pos.drafts.write',
  ],
  grocery: ['grocery.invoices.create', 'grocery.invoices.read', 'grocery.invoices.pay', 'grocery.invoices.cancel'],
  stock: ['stocktake.read', 'stocktake.run', 'inventory.read', 'inventory.write'],
  admin: [
    'finance.reports.read',
    'reports.sales.read',
    'reports.inventory.read',
    'storefront.orders.read',
    'users.list',
    'business.manage_settings',
  ],
};

export function fitsApp(app: StaffApp, permissions: readonly string[]): boolean {
  const held = new Set(permissions);
  return APP_ENTRY_PERMISSIONS[app].some((permission) => held.has(permission));
}

/** Every native app these permissions fit, in the order of `STAFF_APPS`. */
export function appsThatFit(permissions: readonly string[]): StaffApp[] {
  return STAFF_APPS.filter((app) => fitsApp(app, permissions));
}

/**
 * The roles the server pins to the branch they were assigned (`BranchResolutionService`). A branch one of
 * these people picks is ignored, and with none assigned the server refuses their shifts and sales. The list
 * is the server's; it stays the authority, and this only keeps the app from offering a choice that cannot work.
 */
export const BRANCH_LOCKED_ROLE_KEYS: readonly string[] = ['stock_manager', 'cashier', 'grocery_clerk', 'butcher_cashier'];

export function isBranchLockedRole(roleKey: string | null | undefined): boolean {
  return typeof roleKey === 'string' && BRANCH_LOCKED_ROLE_KEYS.includes(roleKey.trim().toLowerCase());
}

/**
 * Where a role works on the web, in words, and the path to open on the shop's own address. Only for
 * saying so on the wrong-app screen (plan §5.11.2): it is never read to decide anything. A role this
 * does not know (a custom one) gets the shop's front page.
 */
export function webHomeForRole(roleKey: string): { where: string; path: string } {
  switch (roleKey.trim().toLowerCase()) {
    case 'owner':
    case 'admin':
      return { where: 'the shop overview', path: '/overview' };
    case 'manager':
    case 'viewer':
      return { where: 'the business pages', path: '/business' };
    case 'cashier':
      return { where: 'the shifts page', path: '/shifts' };
    case 'butcher_cashier':
      return { where: 'the butchery counter', path: '/butcher' };
    case 'grocery_clerk':
      return { where: 'the invoices page', path: '/clerk' };
    case 'stock_manager':
      return { where: 'the stock pages', path: '/inventory/stock?view=levels' };
    case 'pharmacist':
      return { where: 'the pharmacy', path: '/pharmacy' };
    case 'waiter':
      return { where: 'the restaurant floor', path: '/restaurant/floor' };
    case 'kitchen_staff':
      return { where: 'the kitchen screen', path: '/restaurant/kitchen' };
    case 'service_staff':
      return { where: 'your earnings page', path: '/my-earnings' };
    case 'clinician':
    case 'nurse':
    case 'clinic_receptionist':
      return { where: 'the clinic', path: '/clinic' };
    default:
      return { where: 'the web', path: '/' };
  }
}
