/**
 * Who works at the shop, for the Staff screen: the people in a page of `GET /api/v1/users`.
 *
 * The server answers with a Spring page, so the people are in `content` (a bare list is read too), and a person's role
 * is a small object (`role: { id, key, name, system }`) and not a `roleName`. An answer that is neither a page nor a
 * list is a failed read and gives null, so a list that could not be read is never shown as "No one yet".
 *
 * The same list holds the shop's storefront shoppers, whose role is `buyer`. They are customers and not people who work
 * here, so they are left out.
 */

export type StaffPerson = {
  id: string;
  name: string | null;
  email: string | null;
  /** The role as the server names it ("Cashier"); null when the person has no role the server could name. */
  roleName: string | null;
};

/**
 * How many people the Staff screen asks the server for, which is the most it shows. The server cannot leave the
 * shoppers out and sends people in no set order, so in a shop with more than this many active accounts the first answer
 * holds only some of the team (AD15 in docs/mobile/ADMIN_SERVER_CONTRACT.md asks for a way to ask for the team alone).
 */
export const STAFF_LIST_SIZE = 200;

const BUYER_ROLE_KEY = 'buyer';

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function readPerson(row: unknown): StaffPerson | null {
  if (!row || typeof row !== 'object') return null;
  const { id, name, email, role } = row as { id?: unknown; name?: unknown; email?: unknown; role?: unknown };
  if (typeof id !== 'string' || id === '') return null;
  const kind = role && typeof role === 'object' ? (role as { key?: unknown; name?: unknown }) : null;
  if (textOf(kind?.key)?.toLowerCase() === BUYER_ROLE_KEY) return null;
  return { id, name: textOf(name), email: textOf(email), roleName: textOf(kind?.name) };
}

function sortKey(person: StaffPerson): string {
  return (person.name ?? person.email ?? '').toLowerCase();
}

/** Alphabetical by name (by email where there is no name), so the list does not reorder itself each time it is read. */
function byName(a: StaffPerson, b: StaffPerson): number {
  const x = sortKey(a);
  const y = sortKey(b);
  if (x !== y) return x < y ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The people in the server's answer, shoppers left out, each once, in alphabetical order. Null when the answer is
 * neither a page nor a list, which is a failed read and not "no one".
 */
export function readStaff(raw: unknown): StaffPerson[] | null {
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { content?: unknown }).content)
      ? (raw as { content: unknown[] }).content
      : null;
  if (!rows) return null;
  const seen = new Set<string>();
  const people: StaffPerson[] = [];
  for (const row of rows.slice(0, STAFF_LIST_SIZE)) {
    const person = readPerson(row);
    if (person && !seen.has(person.id)) {
      seen.add(person.id);
      people.push(person);
    }
  }
  return people.sort(byName);
}
