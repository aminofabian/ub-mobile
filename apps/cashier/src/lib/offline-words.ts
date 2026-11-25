import { isNoAnswer } from './reach';
import { serverWords } from './server-words';

/** What the till says while it believes it cannot reach the server. Every sale it takes is still kept on the phone. */

/** The pill in the header. Short: it shares the bar with the count of unsent sales. */
export const OFFLINE_PILL = 'Offline';

/** What the pill means, said once, where there is room. */
export const OFFLINE_NOTE = 'No connection. Sales are saved on this phone and sent on their own when it is back.';

/** Under the buttons that need the server: adding a product, and the web orders. */
export const OFFLINE_NEEDS_CONNECTION = 'Adding a product and the web orders need a connection.';

/** In place of the M-Pesa prompt button. The code box stays: that is how an M-Pesa payment is taken with no connection. */
export const OFFLINE_NO_PROMPT =
  "No connection, so an M-Pesa prompt cannot be sent. Ask the customer to pay the shop's M-Pesa number, then type the code from their M-Pesa message below.";

/** Under the box where an M-Pesa code is typed: the shop takes the code as typed. */
export const TYPED_CODE_NOTE =
  "The shop does not check a typed code. Look at the customer's M-Pesa message: the code and the amount must match.";

/** On the credit tab: the customer is found, and the credit limit checked, by the shop. */
export const OFFLINE_NO_CREDIT =
  'No connection, so credit cannot be used: the shop finds the customer and checks the credit limit. Take cash or M-Pesa, or wait until the connection is back.';

/** Above the unsent sales while the line is down. */
export const UNSENT_OFFLINE_NOTE =
  'No connection right now. These sales are safe on this phone and are sent on their own when it is back.';

/** Said when "Send now" got no answer. */
export const NOT_SENT_NO_ANSWER =
  'There is no connection to the shop, so it could not be sent. It stays on this phone and is sent on its own.';

/** What "Try all again" did. */
export function retryWords(count: number): string {
  if (count <= 0) return 'No sale needed trying again.';
  return count === 1
    ? '1 sale will be tried again within half a minute.'
    : `${count} sales will be tried again within half a minute.`;
}

/** Under the shift buttons while the line is down: a shift is opened and closed with the shop. */
export const SHIFT_NEEDS_CONNECTION = 'Opening and closing a shift need a connection.';

/** Said when the text copy of the unsent sales could not be made. */
export const COPY_NOT_MADE = 'The copy could not be made. The sales are still on this phone.';

/** Beside "Try the shop again". */
export const TRY_AGAIN = 'Try the shop again';

/** What a try that came to nothing says. */
export const STILL_OFFLINE = 'Still no answer from the shop.';

/** What the Shift screen says when a shift could not be checked: the check never finished, which is not "no shift". */
export const SHIFT_UNKNOWN_OFFLINE =
  'The shop did not answer, so the till cannot tell whether a shift is open. Sales can still be rung up and are saved on this phone.';

/** Why "Send now" did not send: the shop could not be reached, or what it said (cleaned). */
export function describeNotSent(error: unknown): string {
  if (isNoAnswer(error)) return NOT_SENT_NO_ANSWER;
  return (error instanceof Error ? serverWords(error.message) : '') || 'The server did not accept it.';
}
