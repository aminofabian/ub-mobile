import { cleanDisplayText } from '@kiosk/core';
import { MAX_UNITS, SERVICE_ID_PREFIX, type CartLine, type ServiceTag } from './cart';
import { formatMoney, fromCents, MAX_TYPED_CENTS, toCents } from './money';

/**
 * Selling a service at the till (ADR 0054): a haircut, a manicure, braids. The server lists what the shop sells, who
 * may do each service and what the customer can choose on it (a length, an extra). The till turns a choice into one
 * basket line that carries what the sale needs and nothing else. It works out the price itself, in whole cents, by the
 * server's own rule: a service sells at its price plus what was chosen on it, and the server turns a fixed-price sale
 * down for good when the price is anything else. A price the shop changed after the list was read is the one thing
 * this file cannot know, so the till looks at the shop again when the cashier goes to pay (service-check.ts).
 *
 * Everything here is plain functions on plain data. Nothing is sent from here.
 */

/** The most of one service one tap-through adds. A slipped finger, not a sale. */
export const MAX_SERVICE_QUANTITY = 99;

/** The most options that can be chosen on one service: the number the server says always fits on a line (it keeps the record of them in 2,000 characters). */
export const MAX_CHOSEN_OPTIONS = 10;

// What the server allows on one service (ServiceOptions): six groups, twelve options in each.
const MAX_GROUPS = 6;
const MAX_OPTIONS_PER_GROUP = 12;
const MAX_SERVICE_NAME = 120;
const MAX_SHORT_NAME = 60;
/** The most people one service names as able to do it: as many as the till reads of the staff list in all. */
const MAX_PERFORMER_IDS = 500;

/** One thing the customer can choose in a group: a length, an extra. */
export interface ServiceOption {
  id: string;
  name: string;
  /** What it adds to the price, in cents. Zero when it is free. */
  extraCents: number;
}

/** A question on a service. One answer ("Length"), or several (extras); a required one must be answered. */
export interface ServiceGroup {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  options: ServiceOption[];
}

/** A service the shop sells, as the till reads it. */
export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  /** The listed price in cents. For a variable-price service, a starting point that may be zero. */
  priceCents: number;
  /** The price is set by the person at the till (braids priced by length). */
  variablePrice: boolean;
  /** The staff who may do it. Empty means anyone who serves customers. */
  performerIds: string[];
  groups: ServiceGroup[];
}

/** A staff member who can be named as the one who did the service. */
export interface Performer {
  id: string;
  name: string;
}

/** What the shop last listed, as the till keeps it while the app runs. */
export interface ServiceBook {
  /** The shop it was read for: a list is never used for another one. */
  tenantId: string;
  services: Service[];
  performers: Performer[];
  /** When it was read, in milliseconds. */
  asOf: number;
}

// Ids are what the server made: a UUID, or at most twelve letters and digits. Anything else is not one of its rows. It
// also keeps `:` and `,` out of them, which the basket line's id is built from.
const PLAIN_ID = /^[A-Za-z0-9_-]{1,64}$/;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function plainId(value: unknown): string | null {
  return typeof value === 'string' && PLAIN_ID.test(value) ? value : null;
}

/** A name from the server, for the screen: cut to a sane length before it is cleaned, so that a huge one costs nothing. */
function shown(value: unknown, max: number): string {
  return cleanDisplayText(typeof value === 'string' ? value.slice(0, max * 4) : value, max);
}

/** An amount of shillings from the server, in cents. Null when it is not a usable amount (below zero, or too large). */
function centsOf(value: unknown): number | null {
  if (typeof value !== 'number') return null;
  const cents = toCents(value);
  return cents !== null && cents >= 0 && cents <= MAX_TYPED_CENTS ? cents : null;
}

function readOption(raw: unknown): ServiceOption | null {
  const row = record(raw);
  if (!row) return null;
  const id = plainId(row.id);
  const name = shown(row.name, MAX_SHORT_NAME);
  if (!id || !name) return null;
  // No extra charge is "nothing" or zero; a charge that is not an amount is not an option the till can price.
  const extraCents = row.priceDelta === undefined || row.priceDelta === null ? 0 : centsOf(row.priceDelta);
  if (extraCents === null) return null;
  return { id, name, extraCents };
}

/**
 * What a service lets the customer choose. Null when the service cannot be sold as it is listed: a question that must
 * be answered but has nothing the till can read to answer it with, or an id used twice (the server would count it twice).
 */
function readGroups(raw: unknown): ServiceGroup[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  const groups: ServiceGroup[] = [];
  const used = new Set<string>();
  for (const entry of raw.slice(0, MAX_GROUPS)) {
    const row = record(entry);
    if (!row) continue;
    const id = plainId(row.id);
    const name = shown(row.name, MAX_SHORT_NAME);
    const required = row.required === true;
    const options: ServiceOption[] = [];
    if (Array.isArray(row.options)) {
      for (const rawOption of row.options.slice(0, MAX_OPTIONS_PER_GROUP)) {
        const option = readOption(rawOption);
        if (option) options.push(option);
      }
    }
    if (!id || !name || options.length === 0) {
      // A question nobody can answer is left out, unless it had to be answered: then the service cannot be sold here.
      if (required) return null;
      continue;
    }
    for (const taken of [id, ...options.map((option) => option.id)]) {
      if (used.has(taken)) return null;
      used.add(taken);
    }
    groups.push({ id, name, required, multiple: row.multiple === true, options });
  }
  return groups;
}

function readService(raw: unknown): Service | null {
  const row = record(raw);
  if (!row) return null;
  const id = plainId(row.id);
  const name = shown(row.name, MAX_SERVICE_NAME);
  // The list is asked for with `active=true`; a row that does not say it is active is not trusted to be.
  if (!id || !name || row.active !== true) return null;
  const variablePrice = row.priceIsVariable === true;
  const listed = centsOf(row.price);
  // A fixed price must be above zero (the server refuses a service sold for nothing). A variable one is typed at the till.
  const priceCents = listed ?? (variablePrice ? 0 : null);
  if (priceCents === null || (!variablePrice && priceCents <= 0)) return null;
  const groups = readGroups(row.options);
  if (!groups) return null;
  // An empty list means "anyone". A list with names in it that cannot be read must never read as "anyone", and neither
  // must something that is not a list (the server always sends one).
  if (!Array.isArray(row.staffProfileIds)) return null;
  // A list longer than the staff the till reads is cut. People past the cut are not offered for this service, so the
  // cut can only offer fewer people, never more.
  const named: unknown[] = row.staffProfileIds.slice(0, MAX_PERFORMER_IDS);
  const performerIds = named.map(plainId).filter((value): value is string => value !== null);
  if (named.length > 0 && performerIds.length === 0) return null;
  const minutes = typeof row.durationMinutes === 'number' && Number.isFinite(row.durationMinutes) ? Math.max(0, Math.round(row.durationMinutes)) : 0;
  return { id, name, durationMinutes: minutes, priceCents, variablePrice, performerIds, groups };
}

/**
 * The services the shop sells, from the rows of `GET /api/v1/services`. A row the till cannot sell as listed is left
 * out, never repaired by guessing; a service listed twice is read once. The server's order is kept.
 */
export function parseServices(rows: readonly unknown[]): Service[] {
  const seen = new Set<string>();
  const services: Service[] = [];
  for (const raw of rows) {
    const service = readService(raw);
    if (!service || seen.has(service.id)) continue;
    seen.add(service.id);
    services.push(service);
  }
  return services;
}

/** The staff who can be named on a service, from the rows of `GET /api/v1/services/performers`. */
export function parsePerformers(rows: readonly unknown[]): Performer[] {
  const seen = new Set<string>();
  const performers: Performer[] = [];
  for (const raw of rows) {
    const row = record(raw);
    const id = row ? plainId(row.staffProfileId) : null;
    const name = row ? shown(row.displayName, MAX_SHORT_NAME) : '';
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    performers.push({ id, name });
  }
  return performers;
}

/** The services whose name has the typed words in it, in the order the shop lists them. Nothing typed is every service. */
export function searchServices(services: readonly Service[], typed: string): Service[] {
  const words = typed.trim().toLowerCase();
  return words === '' ? [...services] : services.filter((service) => service.name.toLowerCase().includes(words));
}

/** Who may do the service: the staff on its own list, or every one of them when it names no one. */
export function performersFor(service: Service, performers: readonly Performer[]): Performer[] {
  return service.performerIds.length === 0 ? [...performers] : performers.filter((performer) => service.performerIds.includes(performer.id));
}

/** What the cashier has picked so far for one service. */
export interface Choice {
  performerId: string | null;
  /** What was chosen on it, in the order the service lists them. */
  optionIds: string[];
  quantity: number;
  /** A variable-price service: the price typed for one, in cents. Null until one is typed. */
  typedCents: number | null;
}

/**
 * Where a choice starts. The only person who can do the service is put forward, since the server would take no one
 * else; otherwise nobody is, and the cashier has to say who did it: it is who the work is credited to, and a guess
 * (the person who did the last one) would credit the wrong person whenever a different one did this.
 */
export function startChoice(service: Service, performers: readonly Performer[]): Choice {
  const able = performersFor(service, performers);
  return { performerId: able.length === 1 ? (able[0]?.id ?? null) : null, optionIds: [], quantity: 1, typedCents: null };
}

/**
 * The names that more than one of these people have, in the order they first appear. The work is credited to the
 * person named, and two people with one name cannot be told apart on the screen.
 */
export function sharedNames(people: readonly Performer[]): string[] {
  const seen = new Map<string, { name: string; count: number }>();
  for (const person of people) {
    const key = person.name.trim().toLowerCase();
    const entry = seen.get(key);
    if (entry) entry.count += 1;
    else seen.set(key, { name: person.name, count: 1 });
  }
  return [...seen.values()].filter((entry) => entry.count > 1).map((entry) => entry.name);
}

function groupOf(service: Service, optionId: string): ServiceGroup | undefined {
  return service.groups.find((group) => group.options.some((option) => option.id === optionId));
}

/** The ids in the order the service lists them, so the same choice is always the same list. */
function inServiceOrder(service: Service, ids: ReadonlySet<string>): string[] {
  const ordered: string[] = [];
  for (const group of service.groups) {
    for (const option of group.options) {
      if (ids.has(option.id)) ordered.push(option.id);
    }
  }
  return ordered;
}

/**
 * Taps an option. In a group that takes one answer, tapping another replaces the answer, and tapping the answer again
 * takes it back (unless the group must be answered). In a group that takes several, it is switched on or off. An id
 * that is not one of the service's is ignored, and so is a tap that would pass the most the server takes.
 */
export function toggleOption(service: Service, choice: Choice, optionId: string): Choice {
  const group = groupOf(service, optionId);
  if (!group) return choice;
  const chosen = new Set(choice.optionIds);
  if (chosen.has(optionId)) {
    if (!group.multiple && group.required) return choice;
    chosen.delete(optionId);
  } else {
    if (!group.multiple) for (const option of group.options) chosen.delete(option.id);
    if (chosen.size >= MAX_CHOSEN_OPTIONS) return choice;
    chosen.add(optionId);
  }
  return { ...choice, optionIds: inServiceOrder(service, chosen) };
}

/** What the choices add to the price, in cents. Null when something chosen is not an option of this service, or the sum cannot be counted. */
export function extrasCents(service: Service, optionIds: readonly string[]): number | null {
  let total = 0;
  for (const id of new Set(optionIds)) {
    const option = service.groups.flatMap((group) => group.options).find((candidate) => candidate.id === id);
    if (!option) return null;
    total += option.extraCents;
  }
  return Number.isSafeInteger(total) ? total : null;
}

/** The listed price with what was chosen on it, in cents. Null when something chosen is not an option of this service. */
export function listedCents(service: Service, optionIds: readonly string[]): number | null {
  const extras = extrasCents(service, optionIds);
  if (extras === null) return null;
  const total = service.priceCents + extras;
  return Number.isSafeInteger(total) ? total : null;
}

/**
 * The price of one before what was chosen is added to it. A fixed-price service has its listed price. A variable-price
 * one has the price that was typed, or its listed price while nothing is typed; with neither there is none yet. It is
 * the price that was agreed, and what is chosen on top of it adds to it, as on the web and in the server's tickets.
 */
export function baseCents(service: Service, typedCents: number | null): number | null {
  if (!service.variablePrice) return service.priceCents;
  if (typedCents !== null) return typedCents;
  return service.priceCents > 0 ? service.priceCents : null;
}

/** What one comes to, in parts: the price before what was chosen, what the choices add, and the sum. Null until there is a price. */
export function breakdownFor(service: Service, choice: Choice): { baseCents: number; extrasCents: number; unitCents: number } | null {
  const extras = extrasCents(service, choice.optionIds);
  const base = baseCents(service, choice.typedCents);
  if (extras === null || base === null) return null;
  const unitCents = base + extras;
  return Number.isSafeInteger(unitCents) ? { baseCents: base, extrasCents: extras, unitCents } : null;
}

/** What one costs, in cents: the price before the choices plus what they add. Null when there is no price yet, or it cannot be counted. */
export function priceFor(service: Service, choice: Choice): number | null {
  return breakdownFor(service, choice)?.unitCents ?? null;
}

/** The words the server puts on a receipt: "Braids (Long, Extra packs)", or the plain name when nothing was chosen. */
function labelled(service: Service, optionIds: readonly string[]): string {
  const names = service.groups.flatMap((group) => group.options).filter((option) => optionIds.includes(option.id)).map((option) => option.name);
  return names.length === 0 ? service.name : `${service.name} (${names.join(', ')})`;
}

export type Plan = { ok: true; line: CartLine } | { ok: false; why: string };

/**
 * The basket line for what has been picked, or why it cannot be added yet. Every rule the server turns a service line
 * down for, and the one it does not enforce on a sale (a question that must be answered), is checked here.
 */
export function planService(service: Service, performers: readonly Performer[], choice: Choice): Plan {
  const performer = performersFor(service, performers).find((candidate) => candidate.id === choice.performerId);
  if (!performer) {
    return { ok: false, why: choice.performerId === null ? 'Choose who did it.' : `That person does not do ${service.name}.` };
  }

  // What was chosen: each must be the service's own, one only where one is asked, and not more than the server takes.
  const ids = new Set(choice.optionIds);
  if (ids.size !== choice.optionIds.length) return { ok: false, why: 'Something is chosen twice.' };
  if (ids.size > MAX_CHOSEN_OPTIONS) return { ok: false, why: `Choose at most ${MAX_CHOSEN_OPTIONS} options.` };
  for (const id of ids) {
    if (!groupOf(service, id)) return { ok: false, why: 'One of those choices is not offered on this service.' };
  }
  for (const group of service.groups) {
    const picked = group.options.filter((option) => ids.has(option.id)).length;
    if (!group.multiple && picked > 1) return { ok: false, why: `Choose only one for ${group.name}.` };
    if (group.required && picked === 0) return { ok: false, why: `Choose ${group.name}.` };
  }
  const optionIds = inServiceOrder(service, ids);

  if (!Number.isInteger(choice.quantity) || choice.quantity < 1 || choice.quantity > MAX_SERVICE_QUANTITY) {
    return { ok: false, why: `How many? From 1 to ${MAX_SERVICE_QUANTITY}.` };
  }

  // Every choice is the service's own by now, so the extras cannot be counted only when their sum is too big for a
  // number, and the price is missing only where it is typed. What is chosen adds to the price that was agreed but never
  // makes one: a price of nothing is not made a price by an extra, as in the server's own tickets.
  const extras = extrasCents(service, optionIds);
  if (extras === null) return { ok: false, why: 'That price is too large.' };
  const base = baseCents(service, choice.typedCents);
  if (base === null || !Number.isSafeInteger(base)) return { ok: false, why: 'Enter the price.' };
  if (base <= 0) return { ok: false, why: 'The price must be above zero.' };
  const unitCents = base + extras;
  if (!Number.isSafeInteger(unitCents) || unitCents > MAX_TYPED_CENTS) return { ok: false, why: 'That price is too large.' };
  const unitPrice = fromCents(unitCents);

  const tag: ServiceTag = { serviceId: service.id, performerId: performer.id, performerName: performer.name, optionIds };
  return {
    ok: true,
    line: {
      // One line for the same service, person, choices and price; a different price is a different line.
      itemId: `${SERVICE_ID_PREFIX}${service.id}:${performer.id}:${optionIds.join(',')}:${unitCents}`,
      name: labelled(service, optionIds),
      quantity: choice.quantity,
      unitPrice,
      service: tag,
    },
  };
}

/**
 * The basket with the service line in it. The same service, by the same person, with the same choices at the same
 * price is the same line, and the count goes up. Null when the line is not a service line, or the count would pass the
 * most one line may have.
 */
export function addService(cart: readonly CartLine[], line: CartLine): CartLine[] | null {
  if (!line.service || !line.itemId.startsWith(SERVICE_ID_PREFIX)) return null;
  // Not on trust: a count that is not a whole number, or a price that is not an amount above zero, is not a line.
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_UNITS) return null;
  const cents = toCents(line.unitPrice);
  if (cents === null || cents <= 0) return null;
  const at = cart.findIndex((candidate) => candidate.itemId === line.itemId);
  const there = cart[at];
  if (!there) return [...cart, line];
  const quantity = there.quantity + line.quantity;
  if (quantity > MAX_UNITS) return null;
  return cart.map((candidate, index) => (index === at ? { ...candidate, quantity } : candidate));
}

/** What a service line says under its name in the basket: who did it. Null for a line that is not a service. */
export function describeServiceLine(line: CartLine): string | null {
  return line.service ? `Done by ${line.service.performerName}` : null;
}

/** What a listed service says about its price on the list: "500.00", or "from 500.00" / "price set at the till". */
export function priceWords(service: Service): string {
  if (!service.variablePrice) return `KES ${formatMoney(service.priceCents)}`;
  return service.priceCents > 0 ? `from KES ${formatMoney(service.priceCents)}` : 'price set at the till';
}

/** How long a service takes, for the list: "45 min", "1 h 30 min", "" when it does not say. */
export function durationWords(minutes: number): string {
  if (!(minutes > 0)) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
