import { isApiError } from '@kiosk/core';

/** What to tell the cashier when looking a customer up by phone number did not work. */
export function describeLookupFailure(error: unknown): { title: string; body: string } {
  if (isApiError(error) && error.status === 403) {
    return {
      title: 'This till cannot look customers up',
      body: 'Your role is not allowed to find customers. Ask your manager, or take this sale in cash or by M-Pesa.',
    };
  }
  return { title: "Couldn't look them up", body: 'Check the connection and try again.' };
}
