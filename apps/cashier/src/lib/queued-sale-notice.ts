import { asSetupRequired, isApiError, type SetupContext } from '@kiosk/core';

/**
 * What to tell a cashier when a sale could not be sent and was saved on the phone instead. The sale is already
 * kept, so nothing here says "try again": ringing it up a second time would record it twice once the first one
 * is sent. Every sentence ends the same way, with what the person should not do.
 */

export interface QueuedSaleNotice {
  title: string;
  body: string;
  /** Something the person can do right now about the reason. */
  action?: 'open_shift';
}

const KEPT = 'The sale is saved on this phone, under Unsent sales.';
const ONCE = 'Do not ring it up again.';
const TYPED =
  "The M-Pesa code was typed in and nothing has checked it yet: keep the customer's M-Pesa message until the shop has.";

/**
 * `typedCode`: the sale was paid by M-Pesa with a code the cashier typed in, so nothing has checked that the money
 * arrived. It is said wherever the sale is described as saved, because the sale goes to the shop on that word alone.
 */
export function describeQueuedSale(
  error: unknown,
  context: SetupContext = {},
  options: { typedCode?: boolean } = {}
): QueuedSaleNotice {
  const notice = describe(error, context);
  if (options.typedCode && notice.body.endsWith(ONCE)) {
    return { ...notice, body: `${notice.body.slice(0, -ONCE.length)}${TYPED} ${ONCE}` };
  }
  return notice;
}

function describe(error: unknown, context: SetupContext): QueuedSaleNotice {
  const needed = asSetupRequired(error);
  if (needed) {
    switch (needed.requirement) {
      case 'shift':
        // A shop that runs without shifts, or an app that does not open them, has nothing to open here.
        if (context.shiftsDisabled || (context.app !== undefined && context.app !== 'cashier')) {
          return {
            title: 'Sale saved. A shift is needed to send it',
            body: `${KEPT} It is sent on its own once a shift is open on the web. ${ONCE}`,
          };
        }
        return {
          title: 'Sale saved. Open a shift to send it',
          body: `No shift is open, so the server did not take the sale yet. ${KEPT} It is sent on its own once a shift is open. ${ONCE}`,
          action: 'open_shift',
        };
      case 'till':
        return {
          title: 'Sale saved. This phone is not approved yet',
          body: `Your manager has to approve this phone as a till. ${KEPT} When it is approved, open Unsent sales and tap Send now. ${ONCE}`,
        };
      case 'branch':
        return {
          title: 'Sale saved. You are not on a branch yet',
          body: `Ask your manager to put you on a branch. ${KEPT} When that is done, open Unsent sales and tap Send now. ${ONCE}`,
        };
      case 'dispensing':
        return {
          title: 'Sale saved. It needs a pharmacist',
          body: `A sale with medicines is finished on the web, not in this app. ${KEPT} ${ONCE}`,
        };
    }
  }

  if (isApiError(error)) {
    if (error.status === 401) {
      return {
        title: 'Sale saved. Sign in again to send it',
        body: `Your sign-in has ended. ${KEPT} It is sent on its own once you have signed in again. ${ONCE}`,
      };
    }
    if (error.status === 423) {
      return {
        title: 'The shop is switched off',
        body: `${KEPT} It cannot be sent until the shop is switched back on: ask the owner to contact support. ${ONCE}`,
      };
    }
    // The server is down or busy: it will take the sale when it is back.
    if (error.status >= 500 || error.status === 408 || error.status === 429) {
      return {
        title: 'Sale saved on this phone',
        body: `The server couldn't take the sale just now. ${KEPT} It is sent on its own when the server is back. ${ONCE}`,
      };
    }
    return {
      title: 'Sale saved on this phone',
      body: `The server did not accept this sale. ${KEPT} Ask your manager to look at it there. ${ONCE}`,
    };
  }

  return {
    title: 'Saved offline',
    body: `No connection. ${KEPT} It is sent on its own when you are back online. ${ONCE}`,
  };
}
