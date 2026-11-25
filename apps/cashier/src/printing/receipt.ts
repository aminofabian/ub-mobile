import { formatMoney, toCents } from '../lib/money';
import { methodLabel, quantityText, type SummarySale } from '../lib/sale-summary';
import { EscPosBuilder, PAPER_COLUMNS, type PaperWidth } from './escpos';

/**
 * The shop's own words at the top and bottom of the slip. All optional: a till that knows only its
 * shop name still prints a clean receipt.
 */
export interface ReceiptShop {
  name: string;
  branchName?: string | null;
  /** A line under the name — the shop's phone or till number, say. */
  line?: string | null;
  /** The closing line, e.g. "Asante! Karibu tena." Kept short. */
  footer?: string | null;
}

export interface ReceiptOptions {
  paper?: PaperWidth;
  /** When the sale was rung, for the date line. Defaults to now. */
  soldAt?: string | Date;
  /** Change handed back, in cents, when the till knows it (the server does not). */
  changeCents?: number;
}

const money = (amount: number | null | undefined): string => {
  const cents = amount === null || amount === undefined ? null : toCents(amount);
  return cents === null ? '—' : formatMoney(cents);
};

function whenText(soldAt: string | Date | undefined): string {
  const date = soldAt ? new Date(soldAt) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  // en-KE, Africa/Nairobi — the shop's own clock.
  try {
    const text = new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
    // Intl puts a narrow no-break space before AM/PM; the printer's Latin font has no glyph for it,
    // so flatten every exotic space to a plain one.
    return text.replace(/[\u00a0\u202f\u2009\u2007]/g, " ");
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

/**
 * Turn a recorded sale into a thermal receipt. The layout is the same on 58mm and 80mm paper — only
 * the column count changes — so the one builder serves every till. The totals and payment lines come
 * straight from what the server recorded; only the change is the till's own, because the server does
 * not see the cash drawer.
 */
export function buildReceipt(sale: SummarySale, shop: ReceiptShop, options: ReceiptOptions = {}): EscPosBuilder {
  const columns = PAPER_COLUMNS[options.paper ?? '58'];
  const b = new EscPosBuilder(columns);

  // ── Header: shop name large and centred ──
  b.align('center').bold(true).size(2, 2).line(shop.name.toUpperCase()).size(1, 1);
  if (shop.branchName) b.line(shop.branchName);
  if (shop.line) b.line(shop.line);
  b.bold(false).feed(1);

  // ── Meta: receipt number, date, cashier ──
  b.align('left');
  const receipt = typeof sale.receiptNo === 'number' ? `Receipt #${sale.receiptNo}` : 'Receipt';
  const when = whenText(options.soldAt);
  // On wide paper the number and time sit on one line; on 58mm they would collide, so the time drops
  // to its own line and neither is cut.
  if (columns >= 42 && receipt.length + when.length + 1 <= columns) {
    b.columns2(receipt, when);
  } else {
    b.line(receipt);
    if (when) b.line(when);
  }
  if (sale.soldByName) b.line(`Served by ${sale.soldByName}`);
  b.rule('-');

  // ── Items ──
  for (const raw of sale.items ?? []) {
    const name = (raw.displayName ?? raw.lineLabel ?? 'Item').trim() || 'Item';
    const qty = typeof raw.quantity === 'number' ? raw.quantity : 1;
    const unit = raw.unitPrice;
    const total = money(raw.lineTotal);
    // "2 x 155.00" — the sum a customer can check by hand. A service with no clean unit price just
    // shows its total.
    const qtyPrice = unit != null ? `${quantityText(qty)} x ${money(unit)}` : '';
    b.item(name, qtyPrice, total);
  }
  b.rule('-');

  // ── Totals ──
  b.bold(true).size(1, 2).columns2('TOTAL', `KES ${money(sale.grandTotal)}`).size(1, 1).bold(false);

  // ── Payments ──
  const payments = sale.payments ?? [];
  if (payments.length > 0) {
    b.feed(1);
    for (const p of payments) {
      const label = methodLabel(p.method);
      const ref = p.reference ? ` (${p.reference})` : '';
      b.columns2(label + ref, money(p.amount));
    }
  }
  if (options.changeCents != null && options.changeCents > 0) {
    b.columns2('Change', formatMoney(options.changeCents));
  }

  // ── Footer ──
  b.feed(1).align('center');
  b.line(shop.footer?.trim() || 'Asante! Karibu tena.');
  b.feed(1).line('Powered by Kiosk');
  b.cut();

  return b;
}
