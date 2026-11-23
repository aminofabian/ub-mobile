import { create } from 'zustand';
import {
  addUnit,
  addWeight,
  cartCents,
  removeLine,
  setLinePrice,
  setUnits,
  setWeight,
  type CartItem,
  type CartLine,
} from '../lib/cart';
import { keepsCart } from '../lib/cart-owner';
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
  setItems: (items: Item[]) => void;
  setFlags: (flags: ShopFlags) => void;
  /** One more of an item sold by the unit. False when it cannot be. */
  addToCart: (item: Item) => boolean;
  /** A weighing (thousandths of a kilogram) of an item sold by weight, added to what is already there. False when it cannot be. */
  addWeighed: (item: Item, thousandths: number) => boolean;
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
const NOTHING_HELD = { items: [], cart: [], currentShift: null, lastSale: null, flags: {} };

export const usePosStore = create<PosState>((set, get) => ({
  owner: null,
  items: [],
  cart: [],
  currentShift: null,
  lastSale: null,
  flags: {},
  holds: emptyBook(),
  holdsFor: null,
  setItems: (items) => set({ items }),
  setFlags: (flags) => set({ flags }),
  addToCart: (item) => {
    const cart = addUnit(get().cart, item);
    if (!cart) return false;
    set({ cart });
    return true;
  },
  addWeighed: (item, thousandths) => {
    const cart = addWeight(get().cart, item, thousandths);
    if (!cart) return false;
    set({ cart });
    return true;
  },
  reweigh: (itemId, thousandths) => {
    const cart = setWeight(get().cart, itemId, thousandths);
    if (!cart) return false;
    set({ cart });
    return true;
  },
  updateQuantity: (itemId, quantity) => {
    const cart = setUnits(get().cart, itemId, quantity);
    if (cart) set({ cart });
  },
  changePrice: (itemId, cents) => {
    const cart = setLinePrice(get().cart, itemId, cents);
    if (!cart) return false;
    set({ cart });
    return true;
  },
  removeFromCart: (itemId) => set({ cart: removeLine(get().cart, itemId) }),
  clearCart: () => set({ cart: [] }),
  replaceCart: (cart) => set({ cart }),
  setShift: (currentShift) => set({ currentShift }),
  setLastSale: (lastSale) => set({ lastSale }),
  loadHolds: (holds, holdsFor) => set({ holds, holdsFor }),
  holdCurrent: (who, now, id) => {
    const result = holdCart(get().holds, get().cart, who, now, id);
    if (result.ok) set({ holds: result.book, cart: [] });
    return result;
  },
  recallHold: (id, who, now, parkedId) => {
    const recalled = recallBasket(get().holds, get().cart, id, who, now, parkedId);
    if (recalled) set({ holds: recalled.book, cart: recalled.lines });
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
