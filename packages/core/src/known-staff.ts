import { cleanDisplayText } from './display-text';
import { readTenantValue, removeTenantValue, writeTenantValue } from './tenant-data';

/**
 * The people who have signed in on this phone at this shop, so the next sign-in is a tap on a name and
 * the PIN (plan §5.12.3 J5). First name and email only: the email is not a secret, and no PIN or
 * password is ever kept. Kept per shop, and gone when the shop is forgotten or the phone is removed
 * from it (plan §9).
 */

export interface KnownStaff {
  email: string;
  /** First name, as the server has it. */
  name: string;
}

export const MAX_KNOWN_STAFF = 6;
const MAX_EMAIL_LENGTH = 191;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_SHAPE.test(email) ? email : null;
}

/** The first word of a name: what a chip shows. */
export function firstName(name: string): string {
  return cleanDisplayText(name, 60).split(' ')[0] ?? '';
}

/** What is stored, as a list. Anything that is not a person with an email is dropped. */
export function parseKnownStaff(raw: string | null): KnownStaff[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const people: KnownStaff[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const email = normalizeEmail((entry as Record<string, unknown>).email);
    if (!email || seen.has(email)) continue;
    seen.add(email);
    people.push({ email, name: firstName(String((entry as Record<string, unknown>).name ?? '')) });
    if (people.length >= MAX_KNOWN_STAFF) break;
  }
  return people;
}

export function serializeKnownStaff(people: KnownStaff[]): string {
  return JSON.stringify(people.slice(0, MAX_KNOWN_STAFF));
}

/** Puts this person first. Someone already there is moved, not repeated; the oldest fall off the end. */
export function addKnownStaff(people: KnownStaff[], person: { email: string; name: string }): KnownStaff[] {
  const email = normalizeEmail(person.email);
  if (!email) return people;
  const entry = { email, name: firstName(person.name) };
  return [entry, ...people.filter((other) => other.email !== email)].slice(0, MAX_KNOWN_STAFF);
}

export function removeKnownStaff(people: KnownStaff[], email: string): KnownStaff[] {
  const target = normalizeEmail(email);
  return target ? people.filter((person) => person.email !== target) : people;
}

export async function loadKnownStaff(tenantId?: string): Promise<KnownStaff[]> {
  return parseKnownStaff(await readTenantValue('knownStaff', tenantId));
}

export async function rememberStaff(person: { email: string; name: string }, tenantId?: string): Promise<void> {
  const next = addKnownStaff(await loadKnownStaff(tenantId), person);
  await writeTenantValue('knownStaff', serializeKnownStaff(next), tenantId);
}

/** "Not you?": takes one person off the list. */
export async function forgetKnownStaff(email: string, tenantId?: string): Promise<void> {
  const next = removeKnownStaff(await loadKnownStaff(tenantId), email);
  if (next.length === 0) {
    await removeTenantValue('knownStaff', tenantId);
    return;
  }
  await writeTenantValue('knownStaff', serializeKnownStaff(next), tenantId);
}

export async function clearKnownStaff(tenantId?: string): Promise<void> {
  await removeTenantValue('knownStaff', tenantId);
}
