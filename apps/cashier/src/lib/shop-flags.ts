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
  /** Cashiers may record a cash pay-out (drawout) from an open till. Off unless the owner turns it on. */
  drawout: 'pos.cashier_drawout',
  /**
   * Not one of the server's settings: the till sets it itself from the formats the shop runs (see `parseShopFlags`), so
   * that a till which starts with no connection still offers services.
   */
  sellsServices: 'kiosk.sells_services',
  /**
   * Not a feature flag either: the shop's `inventory.stockLevels.allowNegativeStock`, read here so the till knows
   * whether an empty shelf may still be sold from. Off only when the shop said so; a shop that has never set it sells.
   */
  allowOutOfStock: 'kiosk.allow_out_of_stock',
} as const;

/** The permissions the till reads. */
export const PERMISSION = {
  sell: 'sales.sell',
  setPrice: 'pricing.sell_price.set',
  writeCatalog: 'catalog.items.write',
  readWebOrders: 'storefront.orders.read',
  /** Void any sale: what lets a person throw away a paid sale that was never sent. */
  voidAny: 'sales.void.any',
  /** Void a sale the person rang up themselves. */
  voidOwn: 'sales.void.own',
  /** See customers' outstanding credit tabs and propose a repayment (which goes for approval). */
  readCredits: 'credits.customers.read',
  /** Sell airtime from the till. */
  sellAirtime: 'airtime.sell',
  /** Open a shift. */
  openShift: 'shifts.open',
  /** Close a shift. */
  closeShift: 'shifts.close',
  /** Read the shop's parked POS drafts. */
  readDrafts: 'pos.drafts.read',
  /** Park and clear POS drafts. */
  writeDrafts: 'pos.drafts.write',
} as const;

const MAX_FLAGS = 200;
const FLAG_NAME = /^[A-Za-z0-9_.:-]{1,80}$/;

/** The real booleans with plain names among the first `max` entries of a map. A flag called `leave` is not read. */
function booleans(raw: unknown, max: number, leave: string | null): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [name, value] of Object.entries(raw as Record<string, unknown>).slice(0, max)) {
      if (typeof value === 'boolean' && FLAG_NAME.test(name) && name !== leave) flags[name] = value;
    }
  }
  return flags;
}

/**
 * The shop's feature flags from `GET /api/v1/businesses/me`. Only real booleans with plain names are read: a flag the
 * server sent as text or a number is not "on". A shop that sent none has none on.
 */
export function parseShopFlags(body: unknown): ShopFlags {
  if (!body || typeof body !== 'object') return {};
  const { featureFlags: raw, profile, onboarding, inventory } = body as {
    featureFlags?: unknown;
    profile?: unknown;
    onboarding?: unknown;
    inventory?: unknown;
  };
  // The mark for services is the till's own, and the server has no setting of that name: one that came under it would
  // be believed either way, so it is not read.
  const flags = booleans(raw, MAX_FLAGS, FLAG.sellsServices);
  // A shop that runs a service format sells services. The record says so under `profile`, which the till reads here
  // and keeps with the flags, so that it needs no second request.
  if (runsServices(profile, onboarding)) flags[FLAG.sellsServices] = true;
  // Only recorded when the shop has actually stated it: a shop that never touched the setting keeps a flags object
  // with nothing in it for it, and `maySellWhenOutOfStock` supplies the default (open).
  const oversell = statedOversell(inventory);
  if (oversell !== null) flags[FLAG.allowOutOfStock] = oversell;
  return flags;
}

/**
 * The shop's own word on overselling, or null when it has not given one.
 *
 * The web reads the same setting for its till, with the same default: a shop that has never touched it may oversell.
 * Only a real boolean from the server counts — text, a number or a missing field says nothing.
 */
function statedOversell(inventory: unknown): boolean | null {
  if (!inventory || typeof inventory !== 'object') return null;
  const levels = (inventory as { stockLevels?: unknown }).stockLevels;
  if (!levels || typeof levels !== 'object') return null;
  const value = (levels as { allowNegativeStock?: unknown }).allowNegativeStock;
  return typeof value === 'boolean' ? value : null;
}

/** Whether this till may put an out-of-stock product in the basket, and so in a sale. */
export function maySellWhenOutOfStock(flags: ShopFlags): boolean {
  return flags[FLAG.allowOutOfStock] !== false;
}

/** The shop formats that sell services: the server's own list (ADR 0014), and how it decides a shop is one. */
const SERVICE_FORMATS: readonly string[] = ['barbershop', 'salon', 'spa', 'nail-studio', 'beauty-parlour'];

/** The formats a record names: its list of them, or the one the shop started with when it lists none. */
function formatsIn(record: unknown): string[] {
  if (!record || typeof record !== 'object') return [];
  const { storeTypes, storeType } = record as { storeTypes?: unknown; storeType?: unknown };
  const listed = Array.isArray(storeTypes) ? storeTypes.filter((format): format is string => typeof format === 'string' && format.trim() !== '') : [];
  if (listed.length > 0) return listed;
  return typeof storeType === 'string' && storeType.trim() !== '' ? [storeType] : [];
}

/**
 * Whether any of the formats the shop runs sells services. The profile says which, and when it names none the answers
 * given in the shop's setup do: the web and the server read them in that order too.
 */
function runsServices(profile: unknown, onboarding: unknown): boolean {
  const answers = onboarding && typeof onboarding === 'object' ? (onboarding as { answers?: unknown }).answers : undefined;
  const fromProfile = formatsIn(profile);
  const formats = fromProfile.length > 0 ? fromProfile : formatsIn(answers);
  return formats.some((format) => SERVICE_FORMATS.includes(format.trim().toLowerCase()));
}

/** How long what the shop last said is believed by a till that cannot ask again: a week. After that the till offers only what the person's own permissions allow. */
export const STORED_FLAGS_LIFETIME_MS = 7 * 24 * 60 * 60_000;

/** The settings as they are kept on the phone, with when the shop said them. */
export function encodeStoredFlags(flags: ShopFlags, at: number): string {
  return JSON.stringify({ v: 1, at: Math.trunc(at), flags });
}

/**
 * What the phone kept of the shop's settings, for a till that starts with no connection. Believed only while it is
 * recent and not from the future; anything that is not a plain true or false is left out, as when the shop sends it.
 * Null when there is nothing to believe: the till then offers only what the person's own permissions allow.
 */
export function parseStoredFlags(text: string | null, now: number): ShopFlags | null {
  if (!text) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as { v?: unknown; at?: unknown; flags?: unknown };
  if (record.v !== 1 || typeof record.at !== 'number' || !Number.isFinite(record.at)) return null;
  if (record.at > now || now - record.at > STORED_FLAGS_LIFETIME_MS) return null;
  // What the phone kept is the till's own copy, the mark for services included: the shop's settings and then the mark.
  return booleans(record.flags, MAX_FLAGS + 1, null);
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

/** Viewing customers' credit tabs and proposing a repayment needs the credits-read permission. */
export function mayManageCredit(permissions: readonly string[]): boolean {
  return holds(permissions, PERMISSION.readCredits);
}

/** Voiding a sale needs the right to void any sale, or to void one's own. */
export function mayVoidSale(permissions: readonly string[]): boolean {
  return holds(permissions, PERMISSION.voidAny) || holds(permissions, PERMISSION.voidOwn);
}

/** Selling airtime needs the airtime-sell permission. */
export function maySellAirtime(permissions: readonly string[]): boolean {
  return holds(permissions, PERMISSION.sellAirtime);
}

/** Parking and resuming POS drafts needs both read and write on drafts. */
export function mayUseDrafts(permissions: readonly string[]): boolean {
  return holds(permissions, PERMISSION.readDrafts) && holds(permissions, PERMISSION.writeDrafts);
}

/**
 * Recording a cash pay-out from the till needs the right to work a shift AND the shop to have turned
 * on cashier drawouts. (The server also checks a per-cashier access list; a refusal there is handled
 * when the call is made.)
 */
export function mayDrawout(flags: ShopFlags, permissions: readonly string[]): boolean {
  const worksShift = holds(permissions, PERMISSION.openShift) || holds(permissions, PERMISSION.closeShift);
  return worksShift && flags[FLAG.drawout] === true;
}

/** Moving a paid web order along (confirm, ready, complete) is open to anyone who can sell, or see web orders. */
export function mayAdvanceWebOrders(permissions: readonly string[]): boolean {
  return holds(permissions, PERMISSION.sell) || holds(permissions, PERMISSION.readWebOrders);
}

/** Selling services: the shop runs a service format, and this person may sell (the server's own condition for reading the list). */
export function mayShowServices(flags: ShopFlags, permissions: readonly string[]): boolean {
  return flags[FLAG.sellsServices] === true && holds(permissions, PERMISSION.sell);
}
