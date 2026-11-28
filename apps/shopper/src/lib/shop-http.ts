/**
 * Talking to a shop's public API, and saying honestly how a call failed.
 *
 * The shared client throws "API error: 400 Bad Request" and drops what the server said, so a shopper who
 * asked for an area the shop does not serve, or for more than is in stock, saw the same words as one with no
 * signal. Here a failure keeps three things apart that matter to checkout:
 *
 * - the server answered, and said no: nothing was done, and its own words say why;
 * - no answer came: the call may or may not have been carried out;
 * - an answer came but could not be read: the same, for a call that changes something.
 *
 * Only `answered` is safe to treat as "nothing was done". No imports, so node can run this file's test
 * directly; the address of the server is passed in.
 */
export type FailureKind = 'network' | 'timeout' | 'unreadable' | 'http';

function fallbackMessage(kind: FailureKind, status: number | null): string {
  switch (kind) {
    case 'network':
      return 'No connection to the shop.';
    case 'timeout':
      return 'The shop took too long to answer.';
    case 'unreadable':
      return 'The shop answered, but the answer could not be read.';
    default:
      return `The shop answered with an error (${status ?? 'unknown'}).`;
  }
}

export class ShopApiError extends Error {
  readonly kind: FailureKind;
  /** The HTTP status when there was one. */
  readonly status: number | null;
  /** What the server said, in its own words, when it said anything readable. */
  readonly detail: string;
  /** The answer was the shop's own (its Problem+JSON), not something in between: a gateway, a proxy, a portal. */
  readonly fromShop: boolean;

  constructor(kind: FailureKind, status: number | null, detail: string, fromShop = false) {
    super(detail || fallbackMessage(kind, status));
    this.name = 'ShopApiError';
    this.kind = kind;
    this.status = status;
    this.detail = detail;
    this.fromShop = fromShop;
  }

  /** The server gave a readable answer. Anything else leaves a change it was asked for in doubt. */
  get answered(): boolean {
    return this.kind === 'http';
  }
}

const MAX_DETAIL = 240;

/** The server's reason, from an error body. It writes `detail` (and some routes `message`); never HTML. */
export function readableDetail(body: string): string {
  const text = body.trim();
  if (!text) return '';
  try {
    const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown };
    for (const candidate of [parsed?.detail, parsed?.message]) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().slice(0, MAX_DETAIL);
    }
    return '';
  } catch {
    // Not JSON. A short plain sentence is worth showing; a web page or a proxy's error is not.
    if (text.length <= MAX_DETAIL && !/<[a-z!/][^>]*>/i.test(text)) return text;
    return '';
  }
}

/**
 * Whether an error body is the shop's own. The server writes every failure as Problem+JSON, with a `title`
 * and the `status` it answered with; a gateway's page, a proxy's one line or a captive portal's login is not
 * that, and says nothing about whether a call reached the shop.
 */
export function isShopsOwnAnswer(body: string, status: number): boolean {
  try {
    const parsed = JSON.parse(body) as { title?: unknown; status?: unknown } | null;
    return !!parsed && typeof parsed === 'object' && parsed.status === status && typeof parsed.title === 'string';
  } catch {
    return false;
  }
}

export function errorFromThrown(error: unknown, aborted: boolean): ShopApiError {
  const name = (error as { name?: string } | null)?.name;
  if (aborted || name === 'AbortError') return new ShopApiError('timeout', null, '');
  return new ShopApiError('network', null, '');
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<FetchResponseLike>;

export interface ShopRequest {
  /** The server's address, no trailing slash. */
  baseUrl: string;
  slug: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** What follows /api/v1/public/businesses/{slug}, starting with "/". */
  path: string;
  body?: unknown;
  /** The signed-in shopper's access token, when there is one. */
  bearer?: string | null;
  /** The shop's note of a guest, so the server can find the details they saved (`X-Checkout-Guest-Key`). */
  guestKey?: string | null;
  timeoutMs?: number;
  correlationId?: string;
  fetchImpl?: FetchLike;
}

export const DEFAULT_TIMEOUT_MS = 20_000;

export async function shopRequest<T>(request: ShopRequest): Promise<T> {
  const fetchImpl = request.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const url = `${request.baseUrl}/api/v1/public/businesses/${encodeURIComponent(request.slug)}${request.path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (request.body !== undefined) headers['Content-Type'] = 'application/json';
  if (request.correlationId) headers['X-Correlation-Id'] = request.correlationId;
  if (request.bearer) headers.Authorization = `Bearer ${request.bearer}`;
  if (request.guestKey) headers['X-Checkout-Guest-Key'] = request.guestKey;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), request.timeoutMs ?? DEFAULT_TIMEOUT_MS) : null;
  try {
    let response: FetchResponseLike;
    try {
      response = await fetchImpl(url, {
        method: request.method,
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: controller?.signal,
      });
    } catch (error) {
      throw errorFromThrown(error, controller?.signal.aborted === true);
    }
    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      // The answer began and did not finish. For a call that changes something that is not "no".
      const cut = errorFromThrown(error, controller?.signal.aborted === true);
      throw cut.kind === 'timeout' ? cut : new ShopApiError('unreadable', response.status, '');
    }
    if (!response.ok) throw new ShopApiError('http', response.status, readableDetail(text), isShopsOwnAnswer(text, response.status));
    if (!text.trim()) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new ShopApiError('unreadable', response.status, '');
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}
