import type { ApiClient } from '@kiosk/core';
import {
  buildTillSlipEscPos,
  claimTillPrint,
  fetchPendingTillPrints,
  type TillPrintPendingJob,
  type TillSlipKind,
} from '@kiosk/orders';
import { usePrinter } from '../store/printer-store';

const inflight = new Set<string>();
const claimed = new Set<string>();

function paperMm(paper: '58' | '80' | undefined): number {
  return paper === '80' ? 80 : 58;
}

/**
 * Pull remote order/receipt slips queued for this cashier and print them on the
 * paired BLE printer (same jobs web `CashierTillPrintListener` handles).
 */
export async function pullAndPrintTillSlips(api: ApiClient): Promise<void> {
  let rows: TillPrintPendingJob[];
  try {
    rows = await fetchPendingTillPrints(api);
  } catch {
    return;
  }
  for (const job of rows) {
    await deliverOne(api, job);
  }
}

async function deliverOne(api: ApiClient, job: TillPrintPendingJob): Promise<void> {
  const id = job.id?.trim();
  if (!id || inflight.has(id)) return;
  if (claimed.has(id)) {
    await claimTillPrint(api, id).catch(() => undefined);
    return;
  }

  const slip = job.slip;
  if (!slip?.lines?.length) {
    claimed.add(id);
    await claimTillPrint(api, id).catch(() => undefined);
    return;
  }

  const printer = usePrinter.getState();
  if (!printer.saved) {
    // No printer paired — leave the job pending for a web till or a later open.
    return;
  }

  inflight.add(id);
  try {
    const kind: TillSlipKind = job.kind === 'receipt' ? 'receipt' : 'order';
    const bytes = buildTillSlipEscPos(
      {
        reference: slip.reference || job.reference || '',
        supplierName: slip.supplierName,
        businessName: slip.businessName,
        branchName: slip.branchName,
        placedByName: slip.placedByName,
        currency: slip.currency || 'KES',
        lines: slip.lines,
      },
      kind,
      paperMm(printer.saved.paper),
    );
    await printer.print(bytes);
    claimed.add(id);
    await claimTillPrint(api, id).catch(() => undefined);
  } catch {
    // Leave pending for retry on the next poll.
  } finally {
    inflight.delete(id);
  }
}
