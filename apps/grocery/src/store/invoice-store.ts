import { create } from 'zustand';

export interface CartLine {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface InvoiceState {
  lines: CartLine[];
  addLine: (item: { id: string; name: string; sellingPrice: number }, qty?: number) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeLine: (itemId: string) => void;
  clear: () => void;
  total: () => number;
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  lines: [],
  addLine: (item, qty = 1) => {
    const lines = [...get().lines];
    const existing = lines.find((l) => l.itemId === item.id);
    if (existing) existing.quantity += qty;
    else lines.push({ itemId: item.id, name: item.name, quantity: qty, unitPrice: item.sellingPrice });
    set({ lines });
  },
  updateQuantity: (itemId, quantity) => {
    if (quantity <= 0) set({ lines: get().lines.filter((l) => l.itemId !== itemId) });
    else set({ lines: get().lines.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)) });
  },
  removeLine: (itemId) => set({ lines: get().lines.filter((l) => l.itemId !== itemId) }),
  clear: () => set({ lines: [] }),
  total: () => get().lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
}));
