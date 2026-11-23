import { cleanDisplayText, MAX_DISPLAY_NAME_LENGTH } from './display-text';
import { DEFAULT_TIMEOUT_MS, getJson, transientFailure } from './tenant-resolve';

/**
 * Finding a shop by name (plan §5.3). Network only, like tenant-resolve.ts: nothing here reads or
 * writes storage, and nothing here opens a shop. Search is for shoppers; staff reach their shop by code,
 * address, pairing or a verified phone, so they never depend on what the directory lists.
 */

export const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 60;
const MAX_HITS = 20;

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HOST_RE = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/;

/** One row of the shop directory. Public information only. */
export interface StoreHit {
  slug: string;
  name: string;
  logoUrl?: string;
  /** The shop's own address, when it has one. */
  host?: string;
}

export type SearchResult =
  | { kind: 'results'; query: string; hits: StoreHit[] }
  | { kind: 'too_short' }
  | { kind: 'offline' }
  | { kind: 'rate_limited'; retryAfterSec?: number }
  /** The server has no directory to search, or refused the request in a way retrying will not fix. */
  | { kind: 'unavailable' };

/** What the search box holds, tidied: spaces collapsed, length capped. */
export function cleanSearchText(input: string): string {
  // Cut by characters, not UTF-16 units: half an emoji cannot be put into a web address.
  return Array.from(input.replace(/\s+/g, ' ').trim()).slice(0, MAX_SEARCH_LENGTH).join('').trim();
}

function parseHit(row: unknown): StoreHit | null {
  if (!row || typeof row !== 'object') {
    return null;
  }
  const { slug, name, logoUrl, primaryHost } = row as Record<string, unknown>;
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return null;
  }
  const label = cleanDisplayText(name, MAX_DISPLAY_NAME_LENGTH);
  if (!label) {
    return null;
  }
  const hit: StoreHit = { slug, name: label };
  // A logo is loaded from an address the shop's owner chose, so it must at least be a secure one.
  if (typeof logoUrl === 'string' && /^https:\/\//i.test(logoUrl.trim())) {
    hit.logoUrl = logoUrl.trim();
  }
  const host = typeof primaryHost === 'string' ? primaryHost.trim().toLowerCase() : '';
  if (host && HOST_RE.test(host)) {
    hit.host = host;
  }
  return hit;
}

function parseHits(body: unknown): StoreHit[] {
  if (!Array.isArray(body)) {
    return [];
  }
  const seen = new Set<string>();
  const hits: StoreHit[] = [];
  for (const row of body) {
    const hit = parseHit(row);
    if (hit && !seen.has(hit.slug)) {
      seen.add(hit.slug);
      hits.push(hit);
    }
    if (hits.length >= MAX_HITS) {
      break;
    }
  }
  return hits;
}

/**
 * Asks the directory for shops matching what was typed. Never throws. `query` in the answer is the
 * text that was actually sent, so a screen that has moved on to newer text can drop a late answer.
 */
export async function searchStores(input: string, baseURL: string, options: { timeoutMs?: number } = {}): Promise<SearchResult> {
  const query = cleanSearchText(input);
  if (query.length < MIN_SEARCH_LENGTH) {
    return { kind: 'too_short' };
  }
  const base = baseURL.replace(/\/+$/, '');
  const fetched = await getJson(
    `${base}/api/v1/public/shops/search?q=${encodeURIComponent(query)}`,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const failure = transientFailure(fetched);
  if (failure) {
    return failure.kind === 'rate_limited' ? { kind: 'rate_limited', retryAfterSec: failure.retryAfterSec } : { kind: 'offline' };
  }
  if (fetched.kind !== 'response') {
    return { kind: 'offline' };
  }
  if (fetched.status === 200) {
    return { kind: 'results', query, hits: parseHits(fetched.body) };
  }
  // The server looked at the text and had nothing to say about it.
  return fetched.status === 400 ? { kind: 'results', query, hits: [] } : { kind: 'unavailable' };
}
