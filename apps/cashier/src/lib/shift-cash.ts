import { formatMoney, fromCents, parseMoney, toCents } from './money';

/** The server writes a variance into the books for any difference larger than one cent. */
export const VARIANCE_TOLERANCE_CENTS = 1;

/**
 * Whether the till shows the cash it expects before the cashier has counted. Off by default: a count made while looking
 * at the answer is not a count. The expected cash and the difference appear when the count is reviewed, and the count
 * can be done again before the shift is closed.
 */
export const SHOW_EXPECTED_BEFORE_COUNT = false;

/** A reason for a difference has to say something. */
export const REASON_MIN_LENGTH = 3;

/**
 * Whether the till writes on the closed shift that the count changed after the cashier had seen what was expected.
 * It is a trail for a manager, not a control: the cashier is never stopped from counting again.
 */
export const NOTE_RECOUNTS = true;

/** Whether a difference this size has to be explained: the server posts it to the books. */
export function needsReason(varianceCents: number): boolean {
  return Math.abs(varianceCents) > VARIANCE_TOLERANCE_CENTS;
}

/** The line written on the closed shift when the final count is not the one made before the expected cash was shown. */
export function recountNote(firstCountedCents: number | null | undefined, finalCountedCents: number): string | undefined {
  if (!NOTE_RECOUNTS) return undefined;
  if (typeof firstCountedCents !== 'number' || firstCountedCents === finalCountedCents) return undefined;
  return `Counted ${formatMoney(firstCountedCents)} first, then ${formatMoney(finalCountedCents)} after seeing the expected cash.`;
}

export type Entry = { ok: true; cents: number } | { ok: false; message: string };

/** The cash counted into the till when a shift opens, as typed. It has to be typed, even if it is nothing. */
export function parseOpeningFloat(text: string): Entry {
  if (!text.trim()) return { ok: false, message: 'Count the cash in the till and type it. Use 0 if there is none.' };
  const cents = parseMoney(text);
  if (cents === null) return { ok: false, message: 'Enter the float as an amount, like 5,000 or 5000.50.' };
  return { ok: true, cents };
}

/**
 * What the last shift on this till counted at close, in cents. Null when it is unknown. It is a hint to check the float
 * against, not a figure to start from: the server gives the count before the cash taken out, so it can be more than
 * was left in the till.
 */
export function suggestedFloat(last: { countedClosingCash?: number | null } | null | undefined): number | null {
  const counted = last?.countedClosingCash;
  if (counted === null || counted === undefined) return null;
  const cents = toCents(counted);
  return cents !== null && cents >= 0 ? cents : null;
}

export interface CloseBody {
  countedClosingCash: number;
  cashTakenOut: number;
  varianceReason?: string;
  /** Written on the closed shift (see `recountNote`). */
  notes?: string;
}

export interface CloseNumbers {
  countedCents: number;
  takenOutCents: number;
  expectedCents: number;
  /** Counted minus expected: below zero is short, above zero is over. */
  varianceCents: number;
  /** What stays in the till for the next shift. */
  leftInTillCents: number;
}

export type ClosePlan =
  /** The counted cash or the amount taken out cannot be used yet. */
  | { step: 'invalid'; message: string }
  /** The count is usable but does not match, and the shift cannot close without saying why. */
  | ({ step: 'reason'; message: string } & CloseNumbers)
  /** Everything is in place to close. */
  | ({ step: 'ready'; body: CloseBody } & CloseNumbers);

const invalid = (message: string): ClosePlan => ({ step: 'invalid', message });

/** Checks a close and works out the difference, from what the cashier typed and what the server expects. */
export function planClose(input: {
  expected: number | null | undefined;
  countedText: string;
  takenOutText: string;
  reasonText: string;
  /** What the cashier counted the first time, before the expected cash was shown. */
  firstCountedCents?: number | null;
}): ClosePlan {
  const expectedCents = input.expected === null || input.expected === undefined ? null : toCents(input.expected);
  if (expectedCents === null) {
    return invalid('The till has not said how much cash it expects. Refresh the shift and try again.');
  }
  if (!input.countedText.trim()) return invalid('Count the cash in the drawer and type the total.');
  const countedCents = parseMoney(input.countedText);
  if (countedCents === null) return invalid('Enter the counted cash as an amount, like 12,500 or 12500.50.');
  if (!input.takenOutText.trim()) {
    return invalid('Enter the cash you are taking out of the till. Use 0 if nothing leaves.');
  }
  const takenOutCents = parseMoney(input.takenOutText);
  if (takenOutCents === null) return invalid('Enter the cash taken out as an amount, like 5,000. Use 0 if nothing leaves.');
  if (takenOutCents > countedCents) {
    return invalid(`You cannot take out more than you counted (${formatMoney(countedCents)}).`);
  }

  const varianceCents = countedCents - expectedCents;
  const numbers: CloseNumbers = {
    countedCents,
    takenOutCents,
    expectedCents,
    varianceCents,
    leftInTillCents: countedCents - takenOutCents,
  };
  const body: CloseBody = { countedClosingCash: fromCents(countedCents), cashTakenOut: fromCents(takenOutCents) };
  const note = recountNote(input.firstCountedCents, countedCents);
  if (note) body.notes = note;

  if (needsReason(varianceCents)) {
    const reason = input.reasonText.trim();
    if (reason.length < REASON_MIN_LENGTH) {
      return {
        step: 'reason',
        message: `${describeVariance(varianceCents)}. Say why before the shift is closed.`,
        ...numbers,
      };
    }
    body.varianceReason = reason;
  }
  return { step: 'ready', body, ...numbers };
}

/** "Short by 50.00", "Over by 12.50" or "The count matches", for a difference in cents. */
export function describeVariance(varianceCents: number): string {
  if (!needsReason(varianceCents)) return 'The count matches';
  return varianceCents < 0 ? `Short by ${formatMoney(-varianceCents)}` : `Over by ${formatMoney(varianceCents)}`;
}

/** What to say before closing a shift while sales are still on the phone, or nothing when none are. */
export function unsentAtClose(unsent: number): string | null {
  if (!Number.isInteger(unsent) || unsent <= 0) return null;
  const these = unsent === 1 ? '1 sale is' : `${unsent} sales are`;
  return `${these} still on this phone and not sent. Cash from them is not in the expected cash yet. When they are sent later they are recorded in whichever shift is open then, under whoever is signed in then. Send them first if you can.`;
}
