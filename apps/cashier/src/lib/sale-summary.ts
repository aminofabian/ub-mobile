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

const money = (amount: number | null | undefined): string => {
  const cents = amount === null || amount === undefined ? null : toCents(amount);
  return cents === null ? '—' : formatMoney(cents);
};

export function buildSaleSummary(
  sale: SummarySale,
  options: { shopName?: string; soldAt?: string | Date; changeCents?: number } = {}
): SaleSummary {
  const heading = typeof sale.receiptNo === 'number' ? `Sale #${sale.receiptNo}` : 'Sale';

  const items = (sale.items ?? []).map((line) => {
    const display = line.displayName?.trim() ?? '';
    const label = line.lineLabel?.trim() ?? '';
    const name = display && label && display !== label ? `${display} (${label})` : display || label || 'Item';
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
    ...(payment.reference ? { reference: payment.reference } : {}),
  }));

  let changeCents: number | null = null;
  if (typeof options.changeCents === 'number') {
    changeCents = options.changeCents > 0 ? options.changeCents : null;
  } else if (typeof sale.cashReceived === 'number') {
    const received = toCents(sale.cashReceived);
    const cashTaken = (sale.payments ?? [])
      .filter((payment) => payment.method === 'cash')
      .reduce((sum, payment) => sum + (typeof payment.amount === 'number' ? (toCents(payment.amount) ?? 0) : 0), 0);
    changeCents = received !== null && received > cashTaken ? received - cashTaken : null;
  }

  const total = money(sale.grandTotal);
  const change = changeCents === null ? undefined : formatMoney(changeCents);
  const soldBy = sale.soldByName?.trim() || undefined;
  const when = options.soldAt === undefined ? null : formatWhen(options.soldAt);

  const lines: (string | null)[] = [
    options.shopName?.trim() || null,
    [heading, when].filter((part) => part !== null).join(', '),
    '',
    ...items.map((item) => `${item.name}: ${item.detail} = ${item.total}`),
    '',
    `Total: ${total}`,
    ...payments.map((payment) => `${payment.label}: ${payment.amount}${payment.reference ? ` (${payment.reference})` : ''}`),
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

/** "2 x Bread, 1 x Milk, +3 more": what was in a sale, in a line a manager can use to find it again. */
export function saleLabel(cart: { name: string; quantity: number }[], show = 3, maxLength = 160): string {
  const named = cart.slice(0, show).map((line) => `${quantityText(line.quantity)} x ${line.name.trim() || 'Item'}`);
  const rest = cart.length - named.length;
  const label = rest > 0 ? `${named.join(', ')}, +${rest} more` : named.join(', ');
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
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
  const lines = body.lines as { quantity: number; unitPrice: number }[];
  const total = totalCents(lines.map((line) => ({ quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })));
  const methods = Array.isArray(body.payments)
    ? [...new Set((body.payments as { method?: string }[]).map((payment) => methodLabel(payment.method)))]
    : [];
  const count = `${lines.length} ${lines.length === 1 ? 'item' : 'items'}`;
  return {
    title: total === null ? 'Sale' : `Sale of ${formatMoney(total)}`,
    detail: [item.label?.trim() || count, methods.join(' + ')].filter(Boolean).join(' · ') || null,
  };
}
