/**
 * Who a phone number belongs to, when it is used to decide whose account a sale goes on. A number that more than one
 * customer has is never guessed at: putting a debt on the wrong person is worse than asking for it to be sorted out.
 */
export type CustomerMatch<C> = { kind: 'none' } | { kind: 'one'; customer: C } | { kind: 'several' };

export function matchCustomers<C extends { id: string }>(rows: readonly C[]): CustomerMatch<C> {
  const byId = new Map<string, C>();
  for (const row of rows) if (!byId.has(row.id)) byId.set(row.id, row);
  if (byId.size === 0) return { kind: 'none' };
  if (byId.size === 1) return { kind: 'one', customer: [...byId.values()][0] };
  return { kind: 'several' };
}
