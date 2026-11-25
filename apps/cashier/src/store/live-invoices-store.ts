import { create } from 'zustand';

/**
 * One counter invoice the grocery clerk just sent, as it arrived over the live line. This is the
 * nudge, not the invoice itself — the till reads the full invoice (and pays it) from the Invoices
 * tab, which the barcode on this card scans straight to.
 */
export interface LiveInvoice {
  /** The server's invoice id — also the dedupe key, so the same frame twice counts once. */
  invoiceId: string;
  /** The code the cashier scans to pull the invoice up on the Invoices tab. */
  barcodeCode: string;
  /** Total due, in KES. */
  grandTotal: number;
  /** How many lines the clerk rang up. */
  lineCount: number;
  /** The clerk who sent it, for the card ("from Mary"). */
  createdByName: string;
  /** Sent from a phone away from the counter (a runner), not the fixed clerk station. */
  remote: boolean;
  /** Customer's phone, when the clerk took one (for an M-Pesa push at the till). */
  customerPhone: string | null;
  /** When it landed on this phone (ms), for the "2m ago" line and ordering. */
  at: number;
  /** Not yet looked at: drives the bell's badge. Cleared when the cashier opens the bell. */
  unread: boolean;
}

/** The newest invoices are kept; older ones fall off so the bell list never grows without bound. */
const MAX_KEPT = 30;

interface LiveInvoicesStore {
  invoices: LiveInvoice[];
  /** How many unread — what the bell badge shows. */
  unreadCount: number;
  /**
   * A grocery invoice arrived. Adds it (newest first), or, if its id is already here, leaves the
   * list alone so a duplicate frame or a reconnect replay never double-counts. Returns true only
   * when it was genuinely new, so the caller chimes exactly once.
   */
  received: (invoice: Omit<LiveInvoice, 'at' | 'unread'>) => boolean;
  /** The cashier opened the bell: every card is now seen, badge back to zero. */
  markAllRead: () => void;
  /** One invoice was paid/cancelled elsewhere — drop it from the live list. */
  remove: (invoiceId: string) => void;
  /** Sign-out / branch switch: start clean. */
  clear: () => void;
}

export const useLiveInvoices = create<LiveInvoicesStore>((set, get) => ({
  invoices: [],
  unreadCount: 0,
  received: (incoming) => {
    const existing = get().invoices;
    if (existing.some((i) => i.invoiceId === incoming.invoiceId)) {
      return false;
    }
    const next: LiveInvoice = { ...incoming, at: Date.now(), unread: true };
    const invoices = [next, ...existing].slice(0, MAX_KEPT);
    set({ invoices, unreadCount: invoices.filter((i) => i.unread).length });
    return true;
  },
  markAllRead: () =>
    set((state) => ({
      invoices: state.invoices.map((i) => (i.unread ? { ...i, unread: false } : i)),
      unreadCount: 0,
    })),
  remove: (invoiceId) =>
    set((state) => {
      const invoices = state.invoices.filter((i) => i.invoiceId !== invoiceId);
      return { invoices, unreadCount: invoices.filter((i) => i.unread).length };
    }),
  clear: () => set({ invoices: [], unreadCount: 0 }),
}));
