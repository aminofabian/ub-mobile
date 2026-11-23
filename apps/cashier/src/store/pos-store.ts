import { create } from 'zustand';
import { keepsCart } from '../lib/cart-owner';
import type { SummarySale } from '../lib/sale-summary';

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

type Item = {
  id: string;
  name: string;
  barcode?: string;
  sellingPrice: number;
  stockOnHand?: number;
};

type CartLine = {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

interface PosState {
  /** Whose cart this is (see `cartOwnerKey`). Null when nobody holds the till. */
  owner: string | null;
  items: Item[];
  cart: CartLine[];
  currentShift: Shift | null;
  lastSale: Sale | null;
  setItems: (items: Item[]) => void;
  addToCart: (item: Item) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  setShift: (shift: Shift | null) => void;
  setLastSale: (sale: Sale | null) => void;
  /** A session starts. What someone else left, or what belongs to another branch, is dropped; the same person keeps theirs. */
  claim: (owner: string) => void;
  /** A session was ended on purpose. Nothing is left for whoever comes next, the same person included. */
  release: () => void;
  cartTotal: () => number;
}

/** What is held for a person at the till. The shop's item list is cleared too: it was loaded for one branch. */
const NOTHING_HELD = { items: [], cart: [], currentShift: null, lastSale: null };

export const usePosStore = create<PosState>((set, get) => ({
  owner: null,
  items: [],
  cart: [],
  currentShift: null,
  lastSale: null,
  setItems: (items) => set({ items }),
  addToCart: (item) => {
    const cart = [...get().cart];
    const existing = cart.find((l) => l.itemId === item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        itemId: item.id,
        name: item.name,
        quantity: 1,
        unitPrice: item.sellingPrice,
      });
    }
    set({ cart });
  },
  updateQuantity: (itemId, quantity) => {
    if (quantity <= 0) {
      set({ cart: get().cart.filter((l) => l.itemId !== itemId) });
      return;
    }
    set({
      cart: get().cart.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)),
    });
  },
  removeFromCart: (itemId) => set({ cart: get().cart.filter((l) => l.itemId !== itemId) }),
  clearCart: () => set({ cart: [] }),
  setShift: (currentShift) => set({ currentShift }),
  setLastSale: (lastSale) => set({ lastSale }),
  claim: (owner) => {
    if (!keepsCart(get().owner, owner)) set({ ...NOTHING_HELD, owner });
  },
  release: () => set({ ...NOTHING_HELD, owner: null }),
  cartTotal: () => get().cart.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
}));
