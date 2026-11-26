import { cleanDisplayText } from './display-text';

/**
 * Who has signed in to a staff app, as the server describes them (`GET /api/v1/me`, and the `user`
 * in a sign-in answer). Read defensively: a field that is missing or of the wrong type leaves the
 * app at "unknown", never at a guess.
 */

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  /** The branch the server assigned this person. Branch-locked roles always have one. */
  branchId: string | null;
  /** The role's key, for showing where the role works. Never decide anything from it: custom roles exist. Empty when the account has no role. */
  roleKey: string;
  roleName: string;
  /** Permission keys, lower case. This is what a gate reads (plan §5.11.4 rule 2). */
  permissions: string[];
  /**
   * Department (item-type) IDs this person is restricted to. Grocery clerks with none
   * see no departments until an admin assigns at least one.
   */
  itemTypeIds: string[];
  hasPin: boolean;
}

/** What a sign-in answer carries about the person: enough to know the assigned branch. */
export interface SignedInUser {
  id: string;
  email: string;
  name: string;
  branchId: string | null;
}

const MAX_PERMISSIONS = 500;
const PERMISSION_RE = /^[a-z0-9][a-z0-9_.:-]{0,79}$/;
const MAX_ID_LENGTH = 64;

function id(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_ID_LENGTH ? trimmed : null;
}

function email(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 191) : '';
}

/** `GET /api/v1/me`. Null when the answer is not a person with a role. */
export function parseMe(payload: unknown): StaffUser | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const userId = id(record.id);
  if (!userId) return null;
  // The server sends `role: null` for an account that has no role: that is a person with nothing to open.
  const roleless = record.role === null || record.role === undefined;
  const role = record.role && typeof record.role === 'object' ? (record.role as Record<string, unknown>) : null;
  const roleKey = typeof role?.key === 'string' ? role.key.trim().toLowerCase().slice(0, 80) : '';
  if (!roleless && !roleKey) return null;

  const permissions = !roleless && Array.isArray(record.permissions)
    ? [
        ...new Set(
          record.permissions
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim().toLowerCase())
            .filter((value) => PERMISSION_RE.test(value))
        ),
      ].slice(0, MAX_PERMISSIONS)
    : [];

  const itemTypeIds = Array.isArray(record.itemTypeIds)
    ? [
        ...new Set(
          record.itemTypeIds
            .filter((value): value is string => typeof value === 'string')
            .map((value) => value.trim())
            .filter((value) => value.length > 0 && value.length <= MAX_ID_LENGTH),
        ),
      ]
    : [];

  return {
    id: userId,
    email: email(record.email),
    name: cleanDisplayText(record.name, 60),
    branchId: id(record.branchId),
    roleKey,
    roleName: roleless ? '' : cleanDisplayText(role?.name, 60) || roleKey,
    permissions,
    itemTypeIds,
    hasPin: record.hasPin === true,
  };
}

/** The `user` in a sign-in answer. Null when the server did not send one; sign-in still worked. */
export function parseSignedInUser(payload: unknown): SignedInUser | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  const userId = id(record.id);
  if (!userId) return null;
  return {
    id: userId,
    email: email(record.email),
    name: cleanDisplayText(record.name, 60),
    branchId: id(record.branchId),
  };
}
