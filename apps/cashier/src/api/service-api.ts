import { ApiError, type ApiClient } from '@kiosk/core';
import { parsePerformers, parseServices, type Performer, type Service, type ServiceBook } from '../lib/service-sale';

/** The largest page the server gives. A shop's services are usually all in the first. */
const PAGE_SIZE = 200;
/** A shop with more services than this is read only as far as this: more than a thousand is not a list anyone scrolls. */
const MAX_PAGES = 5;
/** The most staff read: a shop has a few dozen, and an answer that is far longer than that is not the shop's list. */
const MAX_PERFORMERS = 500;

/**
 * The rows of a list the shop sent: a Spring page (`content`), an older `items` wrapper, or a bare array. An answer that
 * is none of those is not an empty list, it is something the till cannot read, and it must not be taken for "the shop
 * has no services": the basket would then be found full of services that are "not sold any more", and payment blocked.
 * The shop did answer, so this is an error with a status, not a failure to reach it.
 */
function listIn(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    const page = body as { content?: unknown; items?: unknown };
    if (Array.isArray(page.content)) return page.content;
    if (Array.isArray(page.items)) return page.items;
  }
  throw new ApiError('The shop answered with something the till cannot read as a list.', { status: 200 });
}

/**
 * The services the shop has switched on. The server lists them for anyone who may sell (and hides what a service pays
 * the person who does it from everyone but the people who set that up).
 */
export async function fetchServices(api: ApiClient): Promise<Service[]> {
  const rows: unknown[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    // The server never gives more than the page asked for. An answer that does is cut, not read in full.
    const got = listIn(await api.get<unknown>(`/api/v1/services?active=true&size=${PAGE_SIZE}&page=${page}`)).slice(0, PAGE_SIZE);
    rows.push(...got);
    if (got.length < PAGE_SIZE) break;
  }
  return parseServices(rows);
}

/** The staff who can be named as the one who did a service: current, and marked as serving customers. */
export async function fetchPerformers(api: ApiClient): Promise<Performer[]> {
  return parsePerformers(listIn(await api.get<unknown>('/api/v1/services/performers')).slice(0, MAX_PERFORMERS));
}

/** Both lists, read together, for this shop: a service cannot be sold without someone to name on it. */
export async function fetchServiceBook(api: ApiClient, tenantId: string, now: number): Promise<ServiceBook> {
  const [services, performers] = await Promise.all([fetchServices(api), fetchPerformers(api)]);
  return { tenantId, services, performers, asOf: now };
}
