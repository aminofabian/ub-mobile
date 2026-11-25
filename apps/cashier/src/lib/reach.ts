import { isApiError, type ApiClient } from '@kiosk/core';
import { withTimeout } from './with-timeout';

/**
 * What the till believes about its line to the shop's server, worked out from how its own calls went. The phone is not
 * asked whether it has a network: a Wi-Fi that is joined but has nothing behind it is "connected" to the phone and
 * useless to the till, and only a call that gets no answer says so.
 *
 * It is a belief and nothing more. It decides how long the till waits and what it shows first; it never decides that a
 * sale is not sent, because every sale is still tried (and kept, whatever happens).
 */
export interface Reach {
  /** The last call that mattered got no answer, and nothing has been heard since. */
  offline: boolean;
  /** When the line was lost, for as long as it stays lost. */
  lostAt: number | null;
  /** When the server last answered anything, even a "no". */
  heardAt: number | null;
}

export const FIRST_REACH: Reach = { offline: false, lostAt: null, heardAt: null };

/** The server answered something. */
export function heard(state: Reach, at: number): Reach {
  return { ...state, offline: false, lostAt: null, heardAt: at };
}

/** A call got no answer. The time the line was lost is the first failure's, not the latest. */
export function lost(state: Reach, at: number): Reach {
  return { ...state, offline: true, lostAt: state.offline && state.lostAt !== null ? state.lostAt : at };
}

/**
 * Whether a failed call means nobody answered, as opposed to the server answering "no".
 *
 * Nothing came back (the phone could not connect, the request ran out of time, a page came back that was not JSON), a
 * gateway had no server behind it (502, 503, 504 and Cloudflare's 520 to 524, which is what a deploy looks like from
 * outside) or something in the way answered in the server's place (a firewall, a proxy, a Wi-Fi login page): all of
 * those are "no answer". Any other status is the server, and it was reached.
 */
export function isNoAnswer(error: unknown): boolean {
  if (!isApiError(error)) return true;
  const { status } = error;
  if (error.foreign) return true;
  return status === 502 || status === 503 || status === 504 || (status >= 520 && status <= 524);
}

/** How long a search waits for the shop before it uses the list on the phone. */
export const SEARCH_WAIT_MS = 6_000;
/** The same, when the line is believed to be down: the answer will almost certainly be the phone's list. */
export const SEARCH_WAIT_OFFLINE_MS = 2_000;
/** How long the till waits for the server to take a sale it has already saved, when the line is believed to be down. */
export const SALE_WAIT_OFFLINE_MS = 4_000;
/** How long the till waits for a quick check of the server: whether a shift is open, what the shop allows, the web orders. */
export const CHECK_WAIT_MS = 8_000;
/** How long "Send now" waits for the server to take a sale. */
export const SEND_NOW_WAIT_MS = 30_000;
/** The most the till waits for the shop to check every line of a basket that is being brought back. */
export const RECALL_WAIT_MAX_MS = 40_000;

/**
 * How long to wait for `count` calls that are made `atOnce` at a time and that may each take `perCallMs`: every call
 * gets its turn, with two seconds over, and never more than `capMs`. A wait shorter than the calls themselves ends
 * while they are still answering, and says the line is down when it is only slow.
 */
export function batchWaitMs(count: number, perCallMs: number, atOnce: number, capMs: number): number {
  const rounds = Math.max(1, Math.ceil(Math.max(0, count) / Math.max(1, atOnce)));
  return Math.min(capMs, rounds * perCallMs + 2_000);
}

/** How long between looks at the server while the line is down. */
export const PROBE_EVERY_MS = 20_000;
/** How long one look at the server may take. */
export const PROBE_WAIT_MS = 6_000;

/**
 * For a wait whose calls are already watched one by one (`watchApi`): when the wait runs out the line is not declared
 * lost, because a slow line that is answering would then be shown as down. Each call says for itself.
 */
export const QUIET: Pick<ReachSink, 'lost'> = { lost: () => undefined };

/** What the line to the server was last heard to be, reported by the calls that went through `watchApi`. */
export interface ReachSink {
  heard(): void;
  lost(): void;
}

/** A call that was not answered in the time it was given. It is "no answer", like a line with nothing behind it. */
export class NotAnsweredInTime extends Error {
  constructor() {
    super('The server did not answer in time.');
    this.name = 'NotAnsweredInTime';
  }
}

/**
 * Waits for a call for at most `waitMs`. When it is not answered in time the wait ends with `NotAnsweredInTime` and the
 * till is told the line may be down. The call itself may still finish on its own, but nothing waits for it, so use
 * this only where an answer that comes late is safe to ignore. A call that fails by itself is not told again: the
 * client from `watchApi` has already said what it heard.
 */
export async function waitFor<T>(run: () => Promise<T>, waitMs: number, sink: Pick<ReachSink, 'lost'>): Promise<T> {
  try {
    return await withTimeout(run, waitMs, () => new NotAnsweredInTime());
  } catch (error) {
    if (error instanceof NotAnsweredInTime) sink.lost();
    throw error;
  }
}

/**
 * The same client, with every call reported: an answer is "heard", a failure that is no answer is "lost". Nothing about
 * the call changes: the same request goes out, and the same answer or failure comes back. A client pinned to one shop
 * (`forTenant`, which the sync engine sends through) is watched too, so a sale that goes out in the background tells the
 * till the line is back.
 */
export function watchApi(api: ApiClient, sink: ReachSink): ApiClient {
  const watch = <T>(call: () => Promise<T>): Promise<T> =>
    call().then(
      (value) => {
        sink.heard();
        return value;
      },
      (error: unknown) => {
        if (isNoAnswer(error)) sink.lost();
        else sink.heard();
        throw error;
      }
    );
  const forTenant = api.forTenant;
  return {
    get tenantId() {
      return api.tenantId;
    },
    ...(forTenant ? { forTenant: (tenantId: string) => watchApi(forTenant.call(api, tenantId), sink) } : {}),
    get: <T>(path: string) => watch(() => api.get<T>(path)),
    post: <T>(path: string, body?: unknown, options?: Parameters<ApiClient['post']>[2]) => watch(() => api.post<T>(path, body, options)),
    put: <T>(path: string, body?: unknown, options?: Parameters<ApiClient['put']>[2]) => watch(() => api.put<T>(path, body, options)),
    patch: <T>(path: string, body?: unknown, options?: Parameters<ApiClient['patch']>[2]) => watch(() => api.patch<T>(path, body, options)),
    delete: <T>(path: string, options?: Parameters<ApiClient['delete']>[1]) => watch(() => api.delete<T>(path, options)),
  };
}
