import { formatMoney, parseMoney } from './money';
import { wholeShillings, type Tender } from './tender';

export type PayMode = 'cash' | 'mpesa' | 'split' | 'credit';

export interface PayInputs {
  mode: PayMode;
  totalCents: number;
  /** The notes the customer put down, as typed. Empty means exactly what is due. */
  handedText: string;
  /** For a split: how much of the bill is paid by M-Pesa, as typed. */
  mpesaText: string;
  /** The M-Pesa receipt code, from the confirmed prompt or typed from the customer's message. */
  code: string;
}

export type Shares =
  | { ok: true; tenders: Tender[]; mpesaCents: number; cashCents: number }
  | { ok: false; message: string };

const no = (message: string): Shares => ({ ok: false, message });

/** Notes handed over as typed: undefined when left empty (exactly what is due), null when it is not an amount. */
function readHanded(text: string): number | undefined | null {
  if (!text.trim()) return undefined;
  return parseMoney(text);
}

/**
 * Turns what is on the payment screen into who pays how much. Cash and credit take the whole bill. An M-Pesa
 * payment moves whole shillings, so any cents left over are taken in cash. A split takes the M-Pesa share as typed
 * and the rest in cash.
 */
export function sharesFor(inputs: PayInputs): Shares {
  const { mode, totalCents, code } = inputs;
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) return no('There is nothing to pay yet.');

  // The notes handed over only matter where the customer pays cash. What is left in that box when the person moves to
  // credit or to M-Pesa is not read: it is hidden there, and an error about a hidden box cannot be put right.
  const handed = mode === 'cash' || mode === 'split' ? readHanded(inputs.handedText) : undefined;
  if (handed === null) return no('Enter the cash handed over as an amount, like 1,000 or 1000.50.');
  const handedFor = (cents: number) => (handed === undefined || cents <= 0 ? {} : { handedCents: handed });

  switch (mode) {
    case 'cash':
      return {
        ok: true,
        tenders: [{ kind: 'cash', cents: totalCents, ...handedFor(totalCents) }],
        mpesaCents: 0,
        cashCents: totalCents,
      };
    case 'credit':
      return { ok: true, tenders: [{ kind: 'credit', cents: totalCents }], mpesaCents: 0, cashCents: 0 };
    case 'mpesa': {
      const mpesaCents = wholeShillings(totalCents);
      if (mpesaCents <= 0) return no('M-Pesa takes whole shillings. Take this one in cash.');
      const cashCents = totalCents - mpesaCents;
      const tenders: Tender[] = [{ kind: 'mpesa', cents: mpesaCents, code }];
      if (cashCents > 0) tenders.push({ kind: 'cash', cents: cashCents });
      return { ok: true, tenders, mpesaCents, cashCents };
    }
    case 'split': {
      const typed = parseMoney(inputs.mpesaText);
      if (typed === null || typed <= 0) return no('Enter how much the customer is paying by M-Pesa.');
      if (typed % 100 !== 0) return no('M-Pesa takes whole shillings. Take the cents in cash.');
      if (typed === totalCents) return no('That is the whole bill. Choose M-Pesa instead of cash and M-Pesa.');
      if (typed > totalCents) return no(`That is more than the total, ${formatMoney(totalCents)}.`);
      const cashCents = totalCents - typed;
      return {
        ok: true,
        tenders: [
          { kind: 'mpesa', cents: typed, code },
          { kind: 'cash', cents: cashCents, ...handedFor(cashCents) },
        ],
        mpesaCents: typed,
        cashCents,
      };
    }
  }
}

export type CashCheck =
  | { kind: 'exact' }
  | { kind: 'change'; cents: number }
  | { kind: 'short'; cents: number }
  | { kind: 'invalid' };

/** What the cash handed over means for a cash share: exact, change to give back, or still short. */
export function checkCash(dueCents: number, handedText: string): CashCheck {
  const handed = readHanded(handedText);
  if (handed === null) return { kind: 'invalid' };
  if (handed === undefined || handed === dueCents) return { kind: 'exact' };
  return handed > dueCents ? { kind: 'change', cents: handed - dueCents } : { kind: 'short', cents: dueCents - handed };
}
