import { tenantHostSuffix } from './mobile-config';
import { cleanDisplayText } from './display-text';
import { SHOP_CODE_ALPHABET } from './shop-code';
import { DEFAULT_TIMEOUT_MS } from './tenant-resolve';

/**
 * Pairing a phone to a till with a code or QR from the manager (plan §5.5). The server owns the
 * code and what it carries (shop, branch, role, an optional till name); the app tidies what was
 * typed, refuses what can never be a code, shows a confirm card, and registers only after a tap.
 * Nothing here runs until the platform says `pairingEnabled`: the routes do not exist yet.
 *
 * A code is a secret for the few minutes it lives, so it travels in the body of a POST and never in
 * an address, where proxies and access logs would keep it.
 */

const PREVIEW_PATH = '/api/v1/public/till-pairing/preview';
const PAIR_PATH = '/api/v1/public/till-pairing/pair';

export const PAIRING_CODE_MIN_LENGTH = 6;
export const PAIRING_CODE_MAX_LENGTH = 12;

export type PairingCodeParse =
  | { kind: 'ok'; code: string }
  | { kind: 'incomplete' }
  | { kind: 'too_long' }
  | { kind: 'invalid_characters' };

/** What was typed, as a pairing code. Case, spaces, dots, dashes and underscores do not matter. */
export function parsePairingCode(input: string): PairingCodeParse {
  const code = input.toUpperCase().replace(/[\s._-]/g, '');
  if ([...code].some((character) => !SHOP_CODE_ALPHABET.includes(character))) {
    return { kind: 'invalid_characters' };
  }
  if (code.length < PAIRING_CODE_MIN_LENGTH) {
    return { kind: 'incomplete' };
  }
  return code.length > PAIRING_CODE_MAX_LENGTH ? { kind: 'too_long' } : { kind: 'ok', code };
}

const MAX_SCAN_LENGTH = 512;
const PAIRING_LINK = /^(?:kiosk:\/\/pair|https:\/\/([^/?#]+)\/pair)\/([^/?#]+)\/?(?:[?#].*)?$/i;

function onPlatformApex(host: string): boolean {
  const suffix = tenantHostSuffix().trim().toLowerCase().replace(/^\./, '');
  const bare = host.toLowerCase().replace(/:\d+$/, '');
  return bare === suffix || bare === `www.${suffix}`;
}

/**
 * The code in a scanned QR such as `kiosk://pair/K7M4Q9XD` or `https://kiosk.ke/pair/K7M4Q9XD`, or null for
 * anything else. Only the platform's own address counts, and bare text is never taken for a code.
 */
export function parsePairingScan(text: string): string | null {
  if (text.length > MAX_SCAN_LENGTH) return null;
  const match = PAIRING_LINK.exec(text.trim());
  if (!match) return null;
  const host = match[1];
  if (host !== undefined && !onPlatformApex(host)) return null;
  let candidate = match[2] ?? '';
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  const parse = parsePairingCode(candidate);
  return parse.kind === 'ok' ? parse.code : null;
}

/** What the confirm card shows. */
export interface PairingPreview {
  /** The shop's slug or address, to open it with. */
  shop: string;
  /** The server's own id for the shop, when it sends one: it settles whether this is the open shop. */
  shopId?: string;
  shopName: string;
  branchId: string;
  branchName: string;
  /** The role the person will have, in the server's words. */
  roleName: string;
  tillName?: string;
}

const MAX_ID = 64;

function id(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= MAX_ID ? value.trim() : null;
}

/** The server's preview, or null when it is not one. */
export function parsePairingPreview(body: unknown): PairingPreview | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const shopRecord = record.shop && typeof record.shop === 'object' ? (record.shop as Record<string, unknown>) : null;
  const branchRecord = record.branch && typeof record.branch === 'object' ? (record.branch as Record<string, unknown>) : null;
  const roleRecord = record.role && typeof record.role === 'object' ? (record.role as Record<string, unknown>) : null;
  const shop = id(shopRecord?.host) ?? id(shopRecord?.slug);
  const shopId = id(shopRecord?.id ?? shopRecord?.businessId);
  const branchId = id(branchRecord?.id);
  if (!shop || !branchId) return null;
  const shopName = cleanDisplayText(shopRecord?.displayName ?? shopRecord?.name) || shop;
  const tillName = cleanDisplayText(record.tillName, 60);
  return {
    shop,
    ...(shopId ? { shopId } : {}),
    shopName,
    branchId,
    branchName: cleanDisplayText(branchRecord?.name) || 'this branch',
    roleName: cleanDisplayText(roleRecord?.name) || 'staff',
    ...(tillName ? { tillName } : {}),
  };
}

/** Why a code did not work, or could not be tried. */
export type PairingProblem =
  | { kind: 'not_found' }
  /** Past its 15 minutes. The person asks the manager for a new one. */
  | { kind: 'expired' }
  /** Already used by a phone. The person asks the manager for a new one. */
  | { kind: 'used' }
  /** The server would not take what was sent. Sending it again will not change that. */
  | { kind: 'refused' }
  | { kind: 'rate_limited'; retryAfterSec?: number }
  /** No answer: no connection, a server that is down, or an answer that is not the server's. */
  | { kind: 'offline' };

export type PairingLookup = { kind: 'found'; preview: PairingPreview } | PairingProblem;

function retryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(Math.ceil(seconds), 3600) : undefined;
}

/** What the server's answer to a code says went wrong. Each answer has its own meaning and its own next step. */
function problemFor(status: number, retryAfterHeader: string | null): PairingProblem {
  if (status === 429) return { kind: 'rate_limited', retryAfterSec: retryAfter(retryAfterHeader) };
  if (status === 404) return { kind: 'not_found' };
  if (status === 410) return { kind: 'expired' };
  if (status === 409) return { kind: 'used' };
  // Not an answer to the question (a redirect, a gateway, a server that is down).
  if (status < 400 || status >= 500 || status === 408) return { kind: 'offline' };
  return { kind: 'refused' };
}

type Posted =
  | { kind: 'response'; status: number; body: unknown; retryAfter: string | null }
  | { kind: 'offline' };

async function postJson(url: string, payload: unknown, timeoutMs: number): Promise<Posted> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    let body: unknown = null;
    if (response.ok) {
      try {
        body = await response.json();
      } catch {
        // No body, or not JSON: only the preview needs one, and it checks.
      }
    }
    return { kind: 'response', status: response.status, body, retryAfter: response.headers?.get?.('retry-after') ?? null };
  } catch {
    return { kind: 'offline' };
  } finally {
    clearTimeout(timer);
  }
}

/** Looks a code up without changing anything on the phone. Never throws. */
export async function previewPairing(code: string, baseURL: string, options: { timeoutMs?: number } = {}): Promise<PairingLookup> {
  const base = baseURL.replace(/\/+$/, '');
  const posted = await postJson(`${base}${PREVIEW_PATH}`, { code }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (posted.kind === 'offline') return { kind: 'offline' };
  if (posted.status !== 200) return problemFor(posted.status, posted.retryAfter);
  const preview = parsePairingPreview(posted.body);
  // A 200 that is not a preview: the server is misbehaving, not the code.
  return preview ? { kind: 'found', preview } : { kind: 'offline' };
}

export type PairingResult = { kind: 'paired' } | PairingProblem;

/**
 * Registers this phone as a till with the code. `deviceKey` is the phone's own till id for that shop
 * (what it already sends as `X-Till-Device-Id`). Call it only after the person has tapped Pair on the
 * confirm card. Never throws.
 */
export async function redeemPairing(
  code: string,
  deviceKey: string,
  baseURL: string,
  options: { timeoutMs?: number } = {}
): Promise<PairingResult> {
  // A phone with no key of its own cannot be told apart from any other. Nothing is sent for it.
  if (!deviceKey.trim()) return { kind: 'refused' };
  const base = baseURL.replace(/\/+$/, '');
  const posted = await postJson(`${base}${PAIR_PATH}`, { code, deviceKey }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (posted.kind === 'offline') return { kind: 'offline' };
  if (posted.status >= 200 && posted.status < 300) return { kind: 'paired' };
  return problemFor(posted.status, posted.retryAfter);
}
