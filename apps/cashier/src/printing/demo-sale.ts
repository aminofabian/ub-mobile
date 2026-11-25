import type { SummarySale } from '../lib/sale-summary';

/** A believable sale for the test print and the preview, so a cashier sees a real-looking slip. */
export function demoSale(): SummarySale {
  // 1860 + 455 + 640 = 2955.
  return {
    receiptNo: 1042,
    grandTotal: 2955,
    soldByName: 'Mary W.',
    items: [
      { displayName: 'Sunlight Powder 500gm', quantity: 12, unitPrice: 155, lineTotal: 1860 },
      { displayName: 'Bella Tissues 10 Pack', quantity: 1, unitPrice: 455, lineTotal: 455 },
      { displayName: 'Rina Cooking Oil 1L', quantity: 2, unitPrice: 320, lineTotal: 640 },
    ],
    payments: [{ method: 'cash', amount: 3000 }],
  };
}
