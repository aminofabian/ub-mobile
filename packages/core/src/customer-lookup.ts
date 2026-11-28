import type { ApiClient } from './create-api-client';
import { matchCustomers, type CustomerMatch } from './customer-match';
import { normalizeKenyanPhone } from './phone';

/** What the server says about a customer, as far as a sale needs it. */
export type CustomerHit = { id: string; name?: string; phone?: string; [key: string]: unknown };

/** One page of customers with this number. The server keeps numbers as digits, and shops store them two ways. */
export async function customersWithPhone(api: ApiClient, phone: string): Promise<CustomerHit[]> {
  const q = phone.trim();
  if (!q) return [];
  const params = new URLSearchParams({ page: '0', size: '5', phone: q });
  const answer = await api.get<{ content?: CustomerHit[] } | CustomerHit[]>(`/api/v1/customers?${params}`);
  return Array.isArray(answer) ? answer : (answer.content ?? []);
}

/**
 * Who a number belongs to, when the number decides whose account a sale goes on.
 *
 * Both ways of writing a Kenyan mobile are asked, because a shop's records may hold either. A number more than one
 * customer has is never guessed at: putting a debt on the wrong person is worse than asking for it to be sorted out.
 */
export async function findCustomerByPhone<C extends { id: string } = CustomerHit>(
  api: ApiClient,
  raw: string
): Promise<CustomerMatch<C> | null> {
  const phone = normalizeKenyanPhone(raw);
  if (!phone) return null;
  const rows: CustomerHit[] = [];
  for (const variant of [phone, `0${phone.slice(3)}`]) {
    rows.push(...(await customersWithPhone(api, variant)));
  }
  return matchCustomers(rows as unknown as readonly C[]);
}

/**
 * Adds a customer from the counter or the back office, with the number the sale was for.
 *
 * The phone is normalised here the way the rest of the app normalises it, so the record the shop keeps matches the
 * number the lookup will search for next time. Needs `credits.customers.write`; the server says so in words.
 */
export async function createCustomer(
  api: ApiClient,
  input: { name: string; phone: string }
): Promise<{ id: string; name: string }> {
  const name = input.name.trim().slice(0, 500);
  const phone = normalizeKenyanPhone(input.phone) ?? input.phone.trim().slice(0, 50);
  const created = await api.post<unknown>('/api/v1/customers', {
    name,
    phones: [{ phone: phone.startsWith('254') ? `0${phone.slice(3)}` : phone, primary: true }],
  });
  const row = created && typeof created === 'object' ? (created as Record<string, unknown>) : null;
  const id = typeof row?.id === 'string' ? row.id : '';
  if (!id) throw new Error('The server did not say which customer it made.');
  const saved = typeof row?.name === 'string' && row.name.trim() ? row.name.trim() : name;
  return { id, name: saved };
}

/** One of a customer's numbers, as the server lists it: the badge reads `verifiedAt`. */
export type CustomerPhone = { id: string; phone: string | null; primary: boolean; verifiedAt: number | null };

function readPhones(raw: unknown): CustomerPhone[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomerPhone[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id.trim() : '';
    if (!id) continue;
    const verifiedAt = typeof row.verifiedAt === 'string' ? Date.parse(row.verifiedAt) : NaN;
    out.push({
      id,
      phone: typeof row.phone === 'string' && row.phone.trim() ? row.phone.trim() : null,
      primary: row.primary === true,
      verifiedAt: Number.isNaN(verifiedAt) ? null : verifiedAt,
    });
  }
  return out;
}

export type CustomerCard = { id: string; name: string; phones: CustomerPhone[]; verified: boolean };

export function readCustomerCard(raw: unknown): CustomerCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id.trim() : '';
  if (!id) return null;
  const phones = readPhones(row.phones);
  return {
    id,
    name: typeof row.name === 'string' ? row.name.trim() : 'Customer',
    phones,
    // Verified when any number on the customer is: the badge is about the person, not one line of their record.
    verified: phones.some((phone) => phone.verifiedAt !== null),
  };
}

/**
 * Marks one of a customer's numbers as verified by a person, or takes the mark away (Option A).
 *
 * The same status the customer earns by entering their own code, given by someone trusted instead. The server records
 * when it happened and who did it in the customer's audit trail; the answer is the customer as it now stands.
 */
export async function setCustomerPhoneVerified(
  api: ApiClient,
  input: { customerId: string; phoneId: string; verified: boolean }
): Promise<CustomerCard | null> {
  const path = `/api/v1/customers/${encodeURIComponent(input.customerId)}/phones/${encodeURIComponent(input.phoneId)}/verify`;
  const answer = input.verified ? await api.post<unknown>(path) : await api.delete<unknown>(path);
  return readCustomerCard(answer);
}
