import { create } from 'zustand';

type Shift = {
  id?: string;
  status?: string;
  openedAt?: string;
  expectedClosingCash?: number;
};

type Sale = {
  id?: string;
  status?: string;
  grandTotal?: number;
  items?: { itemId?: string; quantity?: number; unitPrice?: number; lineTotal?: number }[];
};

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
  cartTotal: () => number;
}

export const usePosStore = create<PosState>((set, get) => ({
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
  cartTotal: () => get().cart.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
}));
