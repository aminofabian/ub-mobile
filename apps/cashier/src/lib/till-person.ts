import type { Holder } from './holds';

/** Who is at the till: what the till needs to know about the signed-in person. */
export interface TillPerson {
  userId: string;
  name: string;
  /** Permission keys, lower case, as the server gave them. */
  permissions: readonly string[];
}

/** The owner of what this person holds at this branch. */
export function holderOf(person: TillPerson, branchId: string): Holder {
  return { branchId, userId: person.userId };
}
