import { create } from 'zustand';
import {
  addUnit,
  addWeight,
  backToShelf,
  cartCents,
  removeLine,
  setLinePrice,
  setUnits,
  setWeight,
  type CartItem,
  type CartLine,
} from '../lib/cart';
import { keepsCart } from '../lib/cart-owner';
import { addService, type ServiceBook } from '../lib/service-sale';
import { keepMarksFor, markAdded, type PhonePrices } from '../lib/phone-prices';
import {
  dropBasket,
  emptyBook,
  holdCart,
  recallBasket,
  type HoldBook,
  type HoldResult,
  type Holder,
  type Recalled,
} from '../lib/holds';
import type { SummarySale } from '../lib/sale-summary';
import type { ShopFlags } from '../lib/shop-flags';

type Shift = {
  id?: string;
  status?: string;
  openedAt?: string;
  openedByName?: string;
  /** The cash counted into the till when the shift opened. */
  openingCash?: number;
  expectedClosingCash?: number;
};

/** What the server answered when it recorded a sale: everything the sale summary reads. */
type Sale = SummarySale & { status?: string };

type Item = CartItem;

interface PosState {
  /** Whose cart this is (see `cartOwnerKey`). Null when nobody holds the till. */
  owner: string | null;
  items: Item[];
  cart: CartLine[];
  /** Lines of the cart priced from the list saved on the phone: when that list was made, by item (see `phone-prices`). */
  phoneAsOf: PhonePrices;
  currentShift: Shift | null;
  lastSale: Sale | null;
  /** What the shop lets a till do (its feature flags). Read again whenever the till opens. */
  flags: ShopFlags;
  /**
   * Every basket put on hold at this shop, by everyone, as the phone has them. Kept apart from the cart on purpose:
   * it is stored data, not what one person is holding in memory, so a person arriving or leaving never clears it.
   */
  holds: HoldBook;
  /** The shop the books above were read for. Null until they have been read: nothing may be held before then. */
  holdsFor: string | null;
  /** What the shop last listed as services and staff, kept while the app runs so that the list opens when the shop does not answer. */
  serviceBook: ServiceBook | null;
  setItems: (items: Item[]) => void;
  setFlags: (flags: ShopFlags) => void;
  /** One more of an item sold by the unit. False when it cannot be. `phoneAsOf`: the item's price is from the phone's list, made at that time. */
  addToCart: (item: Item, phoneAsOf?: number | null) => boolean;
  /** A weighing (thousandths of a kilogram) of an item sold by weight, added to what is already there. False when it cannot be. */
  addWeighed: (item: Item, thousandths: number, phoneAsOf?: number | null) => boolean;
  /** A service line (see `planService`), added to the basket. False when it cannot be. */
  addServiceLine: (line: CartLine) => boolean;
  setServiceBook: (book: ServiceBook | null) => void;
  /** Weighs a line again. The new weight replaces the old. */
  reweigh: (itemId: string, thousandths: number) => boolean;
  updateQuantity: (itemId: string, quantity: number) => void;
  /** The cashier's price for a line, in cents. */
  changePrice: (itemId: string, cents: number) => boolean;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  /** Puts a basket in front of the cashier, as the lines come out of a recalled and refreshed hold. */
  replaceCart: (lines: CartLine[]) => void;
  setShift: (shift: Shift | null) => void;
  setLastSale: (sale: Sale | null) => void;
  /** Puts every price that was set by hand back to the shelf price. */
  putBackShelfPrices: () => void;
  /** The baskets read from the phone, for this shop. */
  loadHolds: (book: HoldBook, shop: string) => void;
  /** Puts the basket aside. The cart is emptied only when it was held. */
  holdCurrent: (who: Holder, now: number, id: string) => HoldResult;
  /** Picks a held basket up, putting the one in front of the cashier aside. Null when it cannot be done. */
  recallHold: (id: string, who: Holder, now: number, parkedId: string) => Recalled | null;
  discardHold: (id: string, who: Holder) => void;
  /** A session starts. What someone else left, or what belongs to another branch, is dropped; the same person keeps theirs. */
  claim: (owner: string) => void;
  /** A session was ended on purpose. Nothing is left for whoever comes next, the same person included. */
  release: () => void;
  /** The basket's total in shillings, for what still reads it so. 0 when it cannot be counted. */
  cartTotal: () => number;
  /** The basket's total in cents. Null when a line cannot be counted. */
  cartTotalCents: () => number | null;
}

/** What is held for a person at the till. The shop's item list is cleared too: it was loaded for one branch. */
const NOTHING_HELD = { items: [], cart: [], phoneAsOf: {}, currentShift: null, lastSale: null, flags: {}, serviceBook: null };

export const usePosStore = create<PosState>((set, get) => ({
  owner: null,
  items: [],
  cart: [],
  phoneAsOf: {},
  currentShift: null,
  lastSale: null,
  flags: {},
  holds: emptyBook(),
  holdsFor: null,
  serviceBook: null,
  setItems: (items) => set({ items }),
  setFlags: (flags) => set({ flags }),
  addToCart: (item, phoneAsOf = null) => {
    const before = get().cart;
    const cart = addUnit(before, item);
    if (!cart) return false;
    set({ cart, phoneAsOf: markAdded(get().phoneAsOf, before, item.id, phoneAsOf) });
    return true;
  },
  addWeighed: (item, thousandths, phoneAsOf = null) => {
    const before = get().cart;
    const cart = addWeight(before, item, thousandths);
    if (!cart) return false;
    set({ cart, phoneAsOf: markAdded(get().phoneAsOf, before, item.id, phoneAsOf) });
    return true;
  },
  addServiceLine: (line) => {
    const cart = addService(get().cart, line);
    if (!cart || !line.service) return false;
    set({ cart });
    return true;
  },
  setServiceBook: (serviceBook) => set({ serviceBook }),
  reweigh: (itemId, thousandths) => {
    const cart = setWeight(get().cart, itemId, thousandths);
    if (!cart) return false;
    set({ cart });
    return true;
  },
  updateQuantity: (itemId, quantity) => {
    const cart = setUnits(get().cart, itemId, quantity);
    if (cart) set({ cart, phoneAsOf: keepMarksFor(cart, get().phoneAsOf) });
  },
  changePrice: (itemId, cents) => {
    const cart = setLinePrice(get().cart, itemId, cents);
    if (!cart) return false;
    set({ cart });
    return true;
  },
  removeFromCart: (itemId) => {
    const cart = removeLine(get().cart, itemId);
    set({ cart, phoneAsOf: keepMarksFor(cart, get().phoneAsOf) });
  },
  clearCart: () => set({ cart: [], phoneAsOf: {} }),
  // A basket that is brought back has been checked against the shop, or said it could not be: it carries no marks.
  replaceCart: (cart) => set({ cart, phoneAsOf: {} }),
  setShift: (currentShift) => set({ currentShift }),
  setLastSale: (lastSale) => set({ lastSale }),
  putBackShelfPrices: () => set({ cart: backToShelf(get().cart) }),
  loadHolds: (holds, holdsFor) => set({ holds, holdsFor }),
  holdCurrent: (who, now, id) => {
    const result = holdCart(get().holds, get().cart, who, now, id);
    if (result.ok) set({ holds: result.book, cart: [], phoneAsOf: {} });
    return result;
  },
  recallHold: (id, who, now, parkedId) => {
    const recalled = recallBasket(get().holds, get().cart, id, who, now, parkedId);
    if (recalled) set({ holds: recalled.book, cart: recalled.lines, phoneAsOf: {} });
    return recalled;
  },
  discardHold: (id, who) => set({ holds: dropBasket(get().holds, id, who) }),
  claim: (owner) => {
    if (!keepsCart(get().owner, owner)) set({ ...NOTHING_HELD, owner });
  },
  release: () => set({ ...NOTHING_HELD, owner: null }),
  cartTotal: () => (cartCents(get().cart) ?? 0) / 100,
  cartTotalCents: () => cartCents(get().cart),
}));
