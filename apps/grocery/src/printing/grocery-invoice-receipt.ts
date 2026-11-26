import { QTY_SCALE } from '@kiosk/core';
import type { BasketLine } from '../lib/basket';
import { lineTotalCents } from '../lib/basket';
import { EscPosBuilder, PAPER_COLUMNS, type PaperWidth, wrap } from './escpos';

/**
 * Department-invoice slip printed when a clerk forwards a sale to the till — same shape as the web
 * clerk's till-bridge print (`frontend/lib/grocery-invoice-receipt.ts`): shop, code, lines, total,
 * “Pay at cashier”, then a CODE128 of the invoice barcode for the cashier to scan.
 */

export type GroceryInvoiceSlip = {
  businessName: string;
  branchName?: string | null;
  clerkName?: string | null;
  code: string;
  createdAt: number;
  lines: readonly BasketLine[];
  totalCents: number;
};

const GS = 0x1d;

function strip(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();
}

function formatQty(units: number): string {
  const qty = units / QTY_SCALE;
  if (!Number.isFinite(qty)) return '0';
  const rounded = Math.round(qty * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Epson-compatible CODE128 (GS k 73) with HRI below. */
function code128(payload: string): number[] {
  const data = strip(payload);
  if (!data) return [];
  const body = `{B${data}`;
  const out: number[] = [
    GS,
    0x68,
    0x50, // height
    GS,
    0x48,
    0x02, // HRI below
    GS,
    0x6b,
    73, // CODE128
    body.length,
  ];
  for (let i = 0; i < body.length; i++) out.push(body.charCodeAt(i) & 0xff);
  return out;
}

/**
 * Build ESC/POS bytes for a forwarded grocery invoice. Paper width defaults to 80mm like the web clerk.
 */
export function buildGroceryInvoiceReceipt(
  slip: GroceryInvoiceSlip,
  paper: PaperWidth = '80'
): EscPosBuilder {
  const columns = PAPER_COLUMNS[paper];
  const b = new EscPosBuilder(columns);
  const code = strip(slip.code) || '—';

  b.align('center').bold(true).size(2, 2).line(strip(slip.businessName).toUpperCase() || 'KIOSK').size(1, 1).bold(false);
  if (slip.branchName?.trim()) b.line(strip(slip.branchName));
  b.rule('-');
  b.line('DEPARTMENT INVOICE');
  b.line(code);
  b.line(whenText(slip.createdAt));
  if (slip.clerkName?.trim()) b.line(strip(slip.clerkName));
  b.rule('-').align('left');

  for (const line of slip.lines) {
    const name = strip(line.name) || 'Item';
    for (const row of wrap(name, columns)) b.line(row);
    const detail = `${formatQty(line.quantityUnits)} x ${money(line.unitCents)} = ${money(lineTotalCents(line.quantityUnits, line.unitCents))}`;
    b.columns2('', strip(detail));
  }

  b.rule('-');
  b.columns2('TOTAL KES', money(slip.totalCents));
  b.rule('-');
  b.align('center').line('Pay at cashier').line('Scan barcode below').feed(1);
  b.raw(...code128(code)).feed(2).cut();
  return b;
}

function whenText(at: number): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
      .format(date)
      .replace(/[\u00a0\u202f\u2009\u2007]/g, ' ');
  } catch {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}
