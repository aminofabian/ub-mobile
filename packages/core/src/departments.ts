import type { DepartmentOption } from './stock-items';

/** Who may see which departments — enough of the signed-in person for the rail. */
export type DepartmentScopeUser = {
  roleKey: string | null | undefined;
  itemTypeIds: readonly string[];
};

/**
 * Departments this person may browse, matching the web dashboard rail:
 * assignments restrict; grocery clerks with none see nothing; other roles with
 * none see every active department.
 */
export function visibleDepartments(
  all: readonly DepartmentOption[],
  user: DepartmentScopeUser,
): DepartmentOption[] {
  const assigned = assignedItemTypeIds(user);
  if (assigned.length > 0) {
    const allowed = new Set(assigned);
    return all.filter((d) => allowed.has(d.id));
  }
  const role = (user.roleKey ?? '').trim().toLowerCase();
  if (role === 'grocery_clerk') return [];
  return [...all];
}

/**
 * Department IDs for GET /suppliers. `undefined` = no filter; `[]` = no
 * suppliers (grocery clerk with no assignments).
 */
export function supplierItemTypeScope(
  user: DepartmentScopeUser,
): readonly string[] | undefined {
  const assigned = assignedItemTypeIds(user);
  if (assigned.length > 0) return assigned;
  const role = (user.roleKey ?? '').trim().toLowerCase();
  if (role === 'grocery_clerk') return [];
  return undefined;
}

function assignedItemTypeIds(user: DepartmentScopeUser): string[] {
  return [
    ...new Set(
      user.itemTypeIds
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  ];
}
