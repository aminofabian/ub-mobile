/**
 * The places a shopper has had orders sent to, kept on the phone, and who they are.
 *
 * The website keeps one "default address" in the browser and, when asked, a copy at the server
 * (`saveForNextTime`). The app keeps a short list on the phone, so a second order is two taps and works
 * whatever the signal, and one of them is the default. At most five: an address book is not a shop's
 * customer list, and every one is something the phone knows about where the person lives.
 *
 * Imports only the area matching, so node can run this file's test directly.
 */
import { matchArea } from './delivery-areas';

export const MAX_ADDRESSES = 5;

export interface SavedAddress {
  id: string;
  /** The area as the shop spells it. */
  area: string;
  street: string;
  county: string;
  deliveryNotes: string;
  whatsApp: string;
  isDefault: boolean;
  lastUsedAt: string;
}

export interface SavedContact {
  name: string;
  phone: string;
  email: string;
  whatsApp: string;
}

export interface AddressBook {
  addresses: SavedAddress[];
  contact: SavedContact | null;
}

export function emptyBook(): AddressBook {
  return { addresses: [], contact: null };
}

function text(value: unknown, max = 1000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function sameSpot(a: { area: string; street: string }, b: { area: string; street: string }): boolean {
  const norm = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  return norm(a.area) === norm(b.area) && norm(a.street) === norm(b.street);
}

/** The book as it was stored. Anything damaged is left out, never thrown at the screen. */
export function parseAddressBook(raw: string | null | undefined): AddressBook {
  if (!raw) return emptyBook();
  let parsed: { addresses?: unknown; contact?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyBook();
  }
  const addresses: SavedAddress[] = [];
  if (Array.isArray(parsed?.addresses)) {
    for (const entry of parsed.addresses as Array<Record<string, unknown>>) {
      const id = text(entry?.id, 64);
      const area = text(entry?.area, 120);
      const street = text(entry?.street, 500);
      if (!id || !area || !street) continue;
      if (addresses.some((seen) => seen.id === id || sameSpot(seen, { area, street }))) continue;
      addresses.push({
        id,
        area,
        street,
        county: text(entry.county, 120),
        deliveryNotes: text(entry.deliveryNotes, 1000),
        whatsApp: text(entry.whatsApp, 64),
        isDefault: entry.isDefault === true,
        lastUsedAt: text(entry.lastUsedAt, 40),
      });
    }
  }
  let contact: SavedContact | null = null;
  const stored = parsed?.contact as Record<string, unknown> | null | undefined;
  if (stored && typeof stored === 'object') {
    contact = {
      name: text(stored.name, 255),
      phone: text(stored.phone, 64),
      email: text(stored.email, 255),
      whatsApp: text(stored.whatsApp, 64),
    };
    if (!contact.name && !contact.phone && !contact.email) contact = null;
  }
  return tidy({ addresses, contact });
}

export function serializeAddressBook(book: AddressBook): string {
  return JSON.stringify(book);
}

/** At most one default, never more than the limit, the most recently used kept. */
function tidy(book: AddressBook): AddressBook {
  const byRecent = [...book.addresses].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  let seenDefault = false;
  const kept = byRecent.slice(0, MAX_ADDRESSES).map((address) => {
    if (address.isDefault && !seenDefault) {
      seenDefault = true;
      return address;
    }
    return address.isDefault ? { ...address, isDefault: false } : address;
  });
  // The default is never the one dropped for being old.
  const dropped = byRecent.slice(MAX_ADDRESSES).find((address) => address.isDefault);
  if (dropped && !seenDefault) {
    kept[kept.length - 1] = dropped;
  }
  return { addresses: kept, contact: book.contact };
}

export interface AddressInput {
  area: string;
  street: string;
  county?: string;
  deliveryNotes?: string;
  whatsApp?: string;
  makeDefault: boolean;
}

/**
 * Keeps an address after an order went there: the same area and street updates the one already kept, a new
 * one is added, and the default moves when the person asked for that. The first address kept is the default.
 */
export function rememberAddress(book: AddressBook, input: AddressInput, now: Date, newId: () => string): AddressBook {
  const area = text(input.area, 120);
  const street = text(input.street, 500);
  if (!area || !street) return book;
  const fields = {
    area,
    street,
    county: text(input.county, 120),
    deliveryNotes: text(input.deliveryNotes, 1000),
    whatsApp: text(input.whatsApp, 64),
    lastUsedAt: now.toISOString(),
  };
  const existing = book.addresses.find((address) => sameSpot(address, fields));
  const becomesDefault = input.makeDefault || book.addresses.length === 0;
  const others = book.addresses.filter((address) => address !== existing);
  const next: SavedAddress = existing
    ? { ...existing, ...fields, isDefault: becomesDefault || existing.isDefault }
    : { id: newId(), ...fields, isDefault: becomesDefault };
  const rest = becomesDefault ? others.map((address) => ({ ...address, isDefault: false })) : others;
  return tidy({ addresses: [next, ...rest], contact: book.contact });
}

/** Takes an address off the phone. If it was the default, the one used most recently becomes the default. */
export function forgetAddress(book: AddressBook, id: string): AddressBook {
  const removed = book.addresses.find((address) => address.id === id);
  if (!removed) return book;
  const rest = book.addresses.filter((address) => address.id !== id);
  if (removed.isDefault && rest.length > 0) {
    const recent = [...rest].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))[0];
    return tidy({
      addresses: rest.map((address) => (address.id === recent.id ? { ...address, isDefault: true } : address)),
      contact: book.contact,
    });
  }
  return { addresses: rest, contact: book.contact };
}

export function makeDefault(book: AddressBook, id: string): AddressBook {
  if (!book.addresses.some((address) => address.id === id)) return book;
  return {
    addresses: book.addresses.map((address) => ({ ...address, isDefault: address.id === id })),
    contact: book.contact,
  };
}

/** Remembers who the order was for, so the next one starts filled in. */
export function rememberContact(book: AddressBook, contact: SavedContact): AddressBook {
  const clean: SavedContact = {
    name: text(contact.name, 255),
    phone: text(contact.phone, 64),
    email: text(contact.email, 255),
    whatsApp: text(contact.whatsApp, 64),
  };
  if (!clean.name && !clean.phone) return book;
  return { addresses: book.addresses, contact: clean };
}

/**
 * The address to start a delivery form on: the default, else the one used last. When the shop's areas are
 * known, only one the shop still serves; when they are not (null), the choice is made without them.
 */
export function pickPrefill(book: AddressBook, areaNames: readonly string[] | null): SavedAddress | null {
  const ordered = [...book.addresses].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return b.lastUsedAt.localeCompare(a.lastUsedAt);
  });
  if (areaNames === null) return ordered[0] ?? null;
  return ordered.find((address) => matchArea(areaNames, address.area) !== null) ?? null;
}

/** The addresses the shop still serves come first, so the list offers what can be used. */
export function usableFirst(book: AddressBook, areaNames: readonly string[] | null): SavedAddress[] {
  const rank = (address: SavedAddress) => (areaNames === null || matchArea(areaNames, address.area) ? 0 : 1);
  return [...book.addresses].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return b.lastUsedAt.localeCompare(a.lastUsedAt);
  });
}
