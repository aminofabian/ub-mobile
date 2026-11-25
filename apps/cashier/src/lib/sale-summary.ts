import { cleanDisplayText } from '@kiosk/core';
import { formatMoney, lineCents, toCents, totalCents } from './money';
import { formatWhen } from './when';

/**
 * A plain account of a sale, for the screen after it and for sharing as text. It is not the shop's official receipt:
 * that is made by the server (PDF or thermal), and says so, because the tax details on it are the server's to
 * state. Nothing here works anything out that the server did not send, except the change a cashier was told.
 */

export interface SummarySale {
  id?: string;
  receiptNo?: number | null;
  grandTotal?: number | null;
  cashReceived?: number | null;
  soldByName?: string | null;
  payments?: { method?: string | null; amount?: number | null; reference?: string | null }[] | null;
  items?: {
    itemId?: string | null;
    /** What kind of line it is: `SERVICE` for a service. A product, and a line the server does not say, have none or another. */
    lineKind?: string | null;
    displayName?: string | null;
    lineLabel?: string | null;
    quantity?: number | null;
    unitPrice?: number | null;
    lineTotal?: number | null;
  }[] | null;
}

export interface SaleSummary {
  heading: string;
  items: { name: string; detail: string; total: string }[];
  total: string;
  payments: { label: string; amount: string; reference?: string }[];
  /** What the cashier gives back, when the customer handed over more than the cash due. */
  change?: string;
  soldBy?: string;
  /** All of it as plain text, for sharing. */
  text: string;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  mpesa: 'M-Pesa',
  mpesa_manual: 'M-Pesa',
  card: 'Card',
  customer_credit: 'On credit',
  customer_wallet: 'Wallet',
  loyalty_redeem: 'Loyalty points',
};

/** "mpesa_manual" -> "M-Pesa". A method nobody has named yet is shown readably rather than hidden. */
export function methodLabel(method: string | null | undefined): string {
  const key = (method ?? '').trim();
  if (!key) return 'Payment';
  return METHOD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/^./, (first) => first.toUpperCase());
}

/** 2 -> "2", 1.5 -> "1.5", 0.250 -> "0.25": no trailing zeros on weighed goods. */
export function quantityText(quantity: number): string {
  return Number.isFinite(quantity) ? String(Number(quantity.toFixed(3))) : '?';
}

/** A code for sharing: the end of it is enough for the customer to find it in their own message. */
export function maskCode(code: string): string {
  return code.length > 4 ? `...${code.slice(-4)}` : code;
}

const money = (amount: number | null | undefined): string => {
  const cents = amount === null || amount === undefined ? null : toCents(amount);
  return cents === null ? '—' : formatMoney(cents);
};

/** The most the server keeps of a line's label. */
const SERVICE_LABEL_MAX = 255;

export function buildSaleSummary(
  sale: SummarySale,
  options: { shopName?: string; soldAt?: string | Date; changeCents?: number } = {}
): SaleSummary {
  const heading = typeof sale.receiptNo === 'number' ? `Sale #${sale.receiptNo}` : 'Sale';

  const items = (sale.items ?? []).map((line) => {
    // Names come from the server and end up in a shared text: one line each, so a name cannot add lines of its own.
    const service = line.lineKind === 'SERVICE';
    const display = cleanDisplayText(line.displayName, 80);
    // A service's label is its name and what was chosen on it, and the server keeps up to 255 characters of it: cut
    // shorter, "Braids (Long, Extra packs, Wash" would end in the middle of a choice.
    const label = cleanDisplayText(line.lineLabel, service ? SERVICE_LABEL_MAX : 80);
    // A service's label is made by the server to be read whole ("Braids (Long, Extra packs)"): it already starts with the
    // service's name, so putting the name in front of it again would say the name twice.
    const name =
      service && label
        ? label
        : display && label && display !== label
          ? `${display} (${label})`
          : display || label || 'Item';
    const quantity = typeof line.quantity === 'number' ? line.quantity : NaN;
    const unit = typeof line.unitPrice === 'number' ? line.unitPrice : NaN;
    const computed = lineCents(quantity, unit);
    return {
      name,
      detail: `${quantityText(quantity)} x ${money(Number.isFinite(unit) ? unit : null)}`,
      total: typeof line.lineTotal === 'number' ? money(line.lineTotal) : computed === null ? '—' : formatMoney(computed),
    };
  });

  const payments = (sale.payments ?? []).map((payment) => ({
    label: methodLabel(payment.method),
    amount: money(payment.amount),
    ...(cleanDisplayText(payment.reference, 40) ? { reference: cleanDisplayText(payment.reference, 40) } : {}),
  }));

  // The change is what the server recorded: the notes handed over, less the cash that went into the sale. It is right
  // even when the server priced the sale differently from the till. Only when the server's record does not say is it the
  // change the cashier was told at the till.
  let changeCents: number | null = null;
  const received = typeof sale.cashReceived === 'number' ? toCents(sale.cashReceived) : null;
  if (received !== null && (sale.payments ?? []).length > 0) {
    const cashTaken = (sale.payments ?? [])
      .filter((payment) => payment.method === 'cash')
      .reduce((sum, payment) => sum + (typeof payment.amount === 'number' ? (toCents(payment.amount) ?? 0) : 0), 0);
    changeCents = received > cashTaken ? received - cashTaken : null;
  } else if (typeof options.changeCents === 'number') {
    changeCents = options.changeCents > 0 ? options.changeCents : null;
  }

  const total = money(sale.grandTotal);
  const change = changeCents === null ? undefined : formatMoney(changeCents);
  const soldBy = cleanDisplayText(sale.soldByName, 60) || undefined;
  const when = options.soldAt === undefined ? null : formatWhen(options.soldAt);

  const lines: (string | null)[] = [
    cleanDisplayText(options.shopName, 80) || null,
    [heading, when].filter((part) => part !== null).join(', '),
    '',
    ...items.map((item) => `${item.name}: ${item.detail} = ${item.total}`),
    '',
    `Total: ${total}`,
    ...payments.map((payment) => `${payment.label}: ${payment.amount}${payment.reference ? ` (${maskCode(payment.reference)})` : ''}`),
    change ? `Change: ${change}` : null,
    soldBy ? `Sold by ${soldBy}` : null,
    '',
    'Sale summary. Not a tax receipt.',
  ];

  return {
    heading,
    items,
    total,
    payments,
    ...(change ? { change } : {}),
    ...(soldBy ? { soldBy } : {}),
    text: lines.filter((line): line is string => line !== null).join('\n'),
  };
}

/**
 * "2 x Bread, 1 x Milk, +3 more": what was in a sale, in a line a manager can use to find it again. A service says who
 * did it ("1 x Haircut by Wanjiku"): the sale is the only record of whose work it was until it reaches the server.
 */
export function saleLabel(cart: { name: string; quantity: number; service?: { performerName: string } }[], show = 3, maxLength = 160): string {
  const named = cart.slice(0, show).map((line) => {
    const what = `${quantityText(line.quantity)} x ${line.name.trim() || 'Item'}`;
    const by = line.service ? cleanDisplayText(line.service.performerName, 60) : '';
    return by ? `${what} by ${by}` : what;
  });
  const rest = cart.length - named.length;
  const label = rest > 0 ? `${named.join(', ')}, +${rest} more` : named.join(', ');
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

/** The entries of a list that are objects. A queued request is read back from the phone's storage: nothing in it is trusted to be the shape it was written in. */
export function objectsIn<T extends object>(list: unknown): T[] {
  return Array.isArray(list) ? (list.filter((entry) => entry !== null && typeof entry === 'object') as T[]) : [];
}

/** Whether a queued sale includes an M-Pesa payment: the customer has paid, and the sale is the only record of it. */
export function paidByMpesa(item: { body?: unknown }): boolean {
  const body = item.body as { payments?: unknown } | null | undefined;
  return objectsIn<{ method?: string }>(body?.payments).some(
    (payment) => payment.method === 'mpesa_manual' || payment.method === 'mpesa'
  );
}

/**
 * What to say before a queued sale is thrown away. A sale that includes an M-Pesa payment says so: the customer's money
 * is already with the shop, and without the sale nothing on this phone records that.
 */
export function discardWarning(item: { body?: unknown }): string {
  return paidByMpesa(item)
    ? "This sale includes an M-Pesa payment, so the customer has already paid. If it is discarded nothing records that the sale happened. It will not be sent to the server, and it cannot be brought back."
    : 'It will not be sent to the server, and it cannot be brought back.';
}

/** What an unsent request is, in words. A sale reads as a sale; anything else falls back to what it is. */
export function describeQueuedItem(item: { method: string; path: string; body?: unknown; label?: string }): {
  title: string;
  detail: string | null;
} {
  const body = item.body as { lines?: unknown; payments?: unknown } | null | undefined;
  if (item.path !== '/api/v1/sales' || !body || !Array.isArray(body.lines)) {
    return { title: `${item.method} ${item.path}`, detail: item.label?.trim() || null };
  }
  const lines = objectsIn<{ quantity: number; unitPrice: number }>(body.lines);
  const total = totalCents(lines.map((line) => ({ quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })));
  const methods = [...new Set(objectsIn<{ method?: string }>(body.payments).map((payment) => methodLabel(payment.method)))];
  const count = `${lines.length} ${lines.length === 1 ? 'item' : 'items'}`;
  return {
    title: total === null ? 'Sale' : `Sale of ${formatMoney(total)}`,
    detail: [item.label?.trim() || count, methods.join(' + ')].filter(Boolean).join(' · ') || null,
  };
}
