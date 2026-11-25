/**
 * "Send now" for one sale on the list of unsent sales. A sale the sync engine, or the Payment screen, is sending this
 * very moment is not sent a second time: two requests under one key at once are how the server comes to turn one of
 * them down for a sale it has recorded.
 */
export type SendNowResult = { kind: 'busy' } | { kind: 'sent'; response: unknown } | { kind: 'failed'; error: unknown };

export async function sendNow(
  item: { id: string },
  deps: {
    isBeingSent: (id: string) => boolean;
    /** Sends it, holding the sale as being sent until the request itself has finished. */
    send: () => Promise<unknown>;
    remove: (id: string) => Promise<void>;
  }
): Promise<SendNowResult> {
  if (deps.isBeingSent(item.id)) return { kind: 'busy' };
  let response: unknown;
  try {
    response = await deps.send();
  } catch (error) {
    return { kind: 'failed', error };
  }
  // The server has it. If taking it off the list fails, the next send is recognised by its key, never recorded twice.
  await deps.remove(item.id).catch(() => undefined);
  return { kind: 'sent', response };
}

export const BEING_SENT_NOW = 'This sale is being sent right now. Give it a moment: it leaves this list once it has reached the server.';
