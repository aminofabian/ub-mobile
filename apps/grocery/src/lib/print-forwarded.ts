import type { ForwardEntry, ForwardResult } from './forward';
import { buildGroceryInvoiceReceipt } from '../printing/grocery-invoice-receipt';
import { usePrinter } from '../store/printer-store';

export type PrintForwardedShop = {
  shopName: string;
  branchName: string | null;
  clerkName: string | null;
};

/**
 * Print a department-invoice slip after a sale was forwarded, quietly like the web clerk.
 * Never throws to the sender: a missing or failing printer must not block the forward.
 */
export async function printForwardedInvoice(
  entry: ForwardEntry,
  result: ForwardResult,
  shop: PrintForwardedShop
): Promise<void> {
  const code = result.code?.trim();
  if (!code) return;
  const printer = usePrinter.getState();
  if (!printer.saved) return;
  try {
    const slip = buildGroceryInvoiceReceipt(
      {
        businessName: shop.shopName,
        branchName: shop.branchName,
        clerkName: shop.clerkName,
        code,
        createdAt: entry.sentAt ?? entry.createdAt,
        lines: entry.lines,
        totalCents: result.totalCents ?? entry.totalCents,
      },
      printer.saved.paper
    );
    await printer.print(slip.build());
  } catch {
    // Quiet: the sale is already at the cashier; the clerk can reprint from Sales later if needed.
  }
}
