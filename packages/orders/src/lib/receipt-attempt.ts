/**
 * Confirming a delivery sends the server two things: the goods receipt, which puts the stock on the shelf, and the
 * supplier invoice for it. Each is sent with a key the server remembers, so a second try that carries the same key and
 * the same body gets the first answer back instead of being done again.
 *
 * That only helps if the keys belong to the ATTEMPT and not to each press of the button. A screen that made a new key
 * for every call put the stock on the shelf twice when the invoice step failed and the person pressed the button
 * again, because the goods receipt went out again with a key the server had never seen. So an attempt is made once,
 * with its keys and the times it will send, kept for as long as the person keeps asking for the same thing, and a
 * repeat sends exactly what the first try sent. Once the goods receipt has an id, it is never sent again at all.
 */

export type ReceiptLine = { purchaseOrderLineId: string; qtyReceived: number };

export type ReceiptAttempt = {
  /** What was asked for. A press with anything else is a different receipt, not a repeat. */
  signature: string;
  goodsReceiptKey: string;
  invoiceKey: string;
  invoiceNumber: string;
  /** When the goods arrived, fixed at the first press: a repeat with a different time would be a different request. */
  receivedAt: string;
  invoiceDate: string;
  /** The server's id for the goods receipt, once it has one. From then on only the invoice may be sent. */
  goodsReceiptId: string | null;
};

/** What a receipt is, for telling a repeat from a new one: the order, the branch, and how much of each line. Line order does not matter. */
export function receiptSignature(input: { purchaseOrderId: string; branchId: string; lines: readonly ReceiptLine[] }): string {
  const lines = input.lines
    .map((line) => `${line.purchaseOrderLineId}:${line.qtyReceived}`)
    .sort();
  return [input.purchaseOrderId, input.branchId, ...lines].join('|');
}

export type AttemptPlan =
  /** Send this attempt: the first try, or a repeat of it. */
  | { kind: 'go'; attempt: ReceiptAttempt }
  /** The goods of an earlier try are already received, and what is being asked for now is something else. */
  | { kind: 'half_done'; attempt: ReceiptAttempt };

/**
 * Decides what a press of "Confirm receipt" is. The same thing as before is a repeat of the same attempt. Something else
 * after the goods were received would receive them again on top, so it is held back; something else before that is a
 * fresh attempt with fresh keys.
 */
export function planAttempt(
  previous: ReceiptAttempt | null,
  input: { signature: string; poNumber: string },
  make: { key: () => string; now: () => number }
): AttemptPlan {
  if (previous && previous.signature === input.signature) return { kind: 'go', attempt: previous };
  if (previous && previous.goodsReceiptId !== null) return { kind: 'half_done', attempt: previous };
  const at = new Date(make.now());
  return {
    kind: 'go',
    attempt: {
      signature: input.signature,
      goodsReceiptKey: make.key(),
      invoiceKey: make.key(),
      invoiceNumber: `${input.poNumber}-R${String(at.getTime()).slice(-4)}`,
      receivedAt: at.toISOString(),
      invoiceDate: at.toISOString().slice(0, 10),
      goodsReceiptId: null,
    },
  };
}

export type ReceiptTools = {
  /** Sends the goods receipt with this key. Throws when it is turned down or gets no answer. */
  postGoodsReceipt: (key: string) => Promise<{ goodsReceiptId: string }>;
  /** Sends the invoice for a goods receipt with this key. */
  postInvoice: (goodsReceiptId: string, key: string) => Promise<unknown>;
};

/**
 * Sends what is left of an attempt: the goods receipt while it has no id, then the invoice. The id is kept on the
 * attempt as soon as it is known, so when the invoice step fails and the person tries again, only the invoice goes out.
 */
export async function sendAttempt(attempt: ReceiptAttempt, tools: ReceiptTools): Promise<void> {
  if (attempt.goodsReceiptId === null) {
    const receipt = await tools.postGoodsReceipt(attempt.goodsReceiptKey);
    const id = receipt && typeof receipt.goodsReceiptId === 'string' ? receipt.goodsReceiptId.trim() : '';
    // An answer that does not say which receipt was made cannot be built on. The same key is used again, so the server
    // gives back the receipt it made rather than making another.
    if (id === '') throw new Error('The server did not say which receipt it made.');
    attempt.goodsReceiptId = id;
  }
  await tools.postInvoice(attempt.goodsReceiptId, attempt.invoiceKey);
}

/** What to tell the person when confirming failed, and what is safe to do next. */
export function receiptFailureWords(attempt: Pick<ReceiptAttempt, 'goodsReceiptId'>, error: unknown): string {
  const said = error instanceof Error && error.message.trim() !== '' ? error.message.trim() : 'Could not confirm the order.';
  if (attempt.goodsReceiptId !== null) {
    return `The goods are recorded as received, but the invoice could not be saved: ${said} Press Confirm receipt again to finish it. The goods will not be counted twice.`;
  }
  return `${said} Press Confirm receipt again to try once more. It will not be counted twice.`;
}

/** What to tell the person who asks for a different receipt after part of the last one went through. */
export const HALF_DONE_WORDS =
  'The goods from your last try are already received. Go back and open this order again to see what is still to come, so nothing is counted twice.';
