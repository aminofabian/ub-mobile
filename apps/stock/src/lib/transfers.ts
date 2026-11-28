import { cleanDisplayText, isApiError, qtyToUnits, unitsToQty } from '@kiosk/core';

/**
 * Moving stock between branches. A transfer is a small state machine on the server (draft, in transit, completed or
 * cancelled) and each step is refused with a 409 when it has already been taken. That is what makes a step safe to
 * ask for again after a lost answer: look at where the transfer is now, and only then decide.
 */

export type TransferStatus = 'draft' | 'in_transit' | 'completed' | 'cancelled';

export type TransferLine = { itemId: string; name: string; units: number };

export type Transfer = {
  id: string;
  status: TransferStatus | 'unknown';
  fromBranchId: string;
  toBranchId: string;
  notes: string | null;
  createdAt: number | null;
  lines: TransferLine[];
};

function idOf(value: unknown): string {
  if (typeof value !== 'string') return '';
  const id = value.trim();
  return id.length > 0 && id.length <= 64 ? id : '';
}

function statusOf(value: unknown): Transfer['status'] {
  return value === 'draft' || value === 'in_transit' || value === 'completed' || value === 'cancelled' ? value : 'unknown';
}

function readTransfer(raw: unknown): Transfer | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = idOf(row.id);
  const fromBranchId = idOf(row.fromBranchId);
  const toBranchId = idOf(row.toBranchId);
  if (!id || !fromBranchId || !toBranchId) return null;
  const lines: TransferLine[] = [];
  if (Array.isArray(row.lines)) {
    for (const entry of row.lines) {
      if (!entry || typeof entry !== 'object') continue;
      const line = entry as Record<string, unknown>;
      const units = qtyToUnits(line.quantity);
      const itemId = idOf(line.itemId);
      if (!itemId || units === null || units <= 0) continue;
      lines.push({ itemId, name: cleanDisplayText(line.itemName, 120) || 'Item', units });
    }
  }
  const made = typeof row.createdAt === 'string' ? Date.parse(row.createdAt) : NaN;
  return {
    id,
    status: statusOf(row.status),
    fromBranchId,
    toBranchId,
    notes: cleanDisplayText(row.notes, 200) || null,
    createdAt: Number.isFinite(made) ? made : null,
    lines,
  };
}

/** The transfers the server listed. Null when the answer is not a list, which is a failed read and not "no transfers". */
export function readTransfers(raw: unknown): Transfer[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Transfer[] = [];
  for (const row of raw) {
    const transfer = readTransfer(row);
    if (transfer) out.push(transfer);
  }
  return out;
}

export function readCreated(raw: unknown): { id: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = idOf((raw as Record<string, unknown>).id);
  return id ? { id } : null;
}

/** Which way a transfer goes for this branch: stock leaving it, stock coming to it, or neither (another pair of branches). */
export function directionFor(transfer: Transfer, branchId: string): 'out' | 'in' | 'other' {
  if (transfer.fromBranchId === branchId) return 'out';
  if (transfer.toBranchId === branchId) return 'in';
  return 'other';
}

export type TransferAction = 'send' | 'receive' | 'cancel';

/**
 * What this branch may do with a transfer. The server decides; this only leaves out the buttons it would refuse. The
 * source branch sends its own drafts. The destination receives what is on its way, and may refuse it (cancelling
 * brings the stock back). A draft can be cancelled by either end.
 */
export function actionsFor(transfer: Transfer, branchId: string, mayMove: boolean): TransferAction[] {
  if (!mayMove) return [];
  const direction = directionFor(transfer, branchId);
  if (transfer.status === 'draft') {
    if (direction === 'out') return ['send', 'cancel'];
    if (direction === 'in') return ['cancel'];
    return [];
  }
  if (transfer.status === 'in_transit' && direction === 'in') return ['receive', 'cancel'];
  return [];
}

/** Words for where a transfer is, from this branch's side. */
export function statusWords(transfer: Transfer, branchId: string): string {
  const direction = directionFor(transfer, branchId);
  switch (transfer.status) {
    case 'draft':
      return direction === 'in' ? 'Being prepared by the other branch' : 'Draft: not sent yet';
    case 'in_transit':
      return direction === 'in' ? 'On its way to you: receive it when it arrives' : 'On its way: the other branch will receive it';
    case 'completed':
      return 'Received';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

// ---------------------------------------------------------------------------------------------
// Making one
// ---------------------------------------------------------------------------------------------

export type TransferWish = {
  fromBranchId: string;
  toBranchId: string;
  lines: Array<{ itemId: string; units: number }>;
  note?: string;
};

export type PlanProblem = 'same_branch' | 'no_branch' | 'no_lines' | 'bad_quantity' | 'too_many_lines';

export const MAX_TRANSFER_LINES = 100;

/** The body of `POST /api/v1/inventory/transfers`, or what is wrong. The same item twice is one line with both amounts. */
export function planTransfer(wish: TransferWish): { ok: true; body: { fromBranchId: string; toBranchId: string; notes?: string; lines: Array<{ itemId: string; quantity: number }> } } | { ok: false; problem: PlanProblem } {
  if (!wish.fromBranchId || !wish.toBranchId) return { ok: false, problem: 'no_branch' };
  if (wish.fromBranchId === wish.toBranchId) return { ok: false, problem: 'same_branch' };
  if (wish.lines.length === 0) return { ok: false, problem: 'no_lines' };
  const merged = new Map<string, number>();
  for (const line of wish.lines) {
    if (!line.itemId || !Number.isInteger(line.units) || line.units <= 0) return { ok: false, problem: 'bad_quantity' };
    merged.set(line.itemId, (merged.get(line.itemId) ?? 0) + line.units);
  }
  if (merged.size > MAX_TRANSFER_LINES) return { ok: false, problem: 'too_many_lines' };
  const note = cleanDisplayText(wish.note, 200);
  return {
    ok: true,
    body: {
      fromBranchId: wish.fromBranchId,
      toBranchId: wish.toBranchId,
      ...(note ? { notes: note } : {}),
      lines: [...merged].map(([itemId, units]) => ({ itemId, quantity: unitsToQty(units) })),
    },
  };
}

export function planProblemWords(problem: PlanProblem): string {
  switch (problem) {
    case 'same_branch':
      return 'Choose a different branch to send to.';
    case 'no_branch':
      return 'Choose the branch to send to.';
    case 'no_lines':
      return 'Add at least one item.';
    case 'bad_quantity':
      return 'Every item needs a quantity above zero.';
    case 'too_many_lines':
      return `A transfer can carry ${MAX_TRANSFER_LINES} items at most.`;
  }
}

/** Items on a wish that ask for more than the source branch is known to have. A warning for the person, never a block: the server decides. */
export function overdrawn(lines: Array<{ name: string; units: number; onHandUnits: number | null }>): string[] {
  return lines.filter((line) => line.onHandUnits !== null && line.units > line.onHandUnits).map((line) => line.name);
}

export type BranchChoice = { id: string; name: string };

/** The branches a transfer can go to: every branch but this one, by name. */
export function destinations(branches: ReadonlyArray<{ id?: unknown; name?: unknown }>, myBranchId: string): BranchChoice[] {
  const out: BranchChoice[] = [];
  for (const branch of branches) {
    const id = idOf(branch.id);
    const name = cleanDisplayText(branch.name, 80);
    if (id && name && id !== myBranchId && !out.some((known) => known.id === id)) out.push({ id, name });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** A branch by its id, or words for one the phone has no name for. */
export function branchName(branches: ReadonlyArray<{ id?: unknown; name?: unknown }>, id: string): string {
  const found = branches.find((branch) => branch.id === id);
  return (found ? cleanDisplayText(found.name, 80) : '') || 'Another branch';
}

// ---------------------------------------------------------------------------------------------
// After a step
// ---------------------------------------------------------------------------------------------

/**
 * What a failed step means for the person. A step the server turned down says why by its status. No answer at all (or
 * a server error) leaves it unknown whether the step happened, and the screen reads the transfer again to find out.
 */
export type StepFailure = 'doubt' | 'moved_on' | 'not_yours' | 'gone' | 'refused';

export function classifyStep(error: unknown): StepFailure {
  if (!isApiError(error) || error.foreign) return 'doubt';
  const { status } = error;
  if (status === 409) return 'moved_on';
  if (status === 403) return 'not_yours';
  if (status === 404) return 'gone';
  if (status >= 500 || status === 401 || status === 408 || status === 423 || status === 429) return 'doubt';
  return 'refused';
}

export function stepFailureWords(action: TransferAction, failure: StepFailure): string {
  switch (failure) {
    case 'doubt':
      return 'There was no clear answer. Checking where the transfer is now.';
    case 'moved_on':
      return 'Someone has already moved this transfer on. Showing where it is now.';
    case 'not_yours':
      return action === 'receive' ? 'Only the branch it is going to can receive it.' : 'Your branch cannot do that with this transfer.';
    case 'gone':
      return 'This transfer is no longer there.';
    case 'refused':
      return 'The server did not accept that.';
  }
}

/**
 * After a step with no clear answer, whether it happened, read from where the transfer is now. "Done" is not a guess:
 * only the state the step leads to says so. A transfer that is gone from the list says nothing either way.
 */
export function didStepHappen(action: TransferAction, now: Transfer | undefined): 'done' | 'not_done' | 'unclear' {
  if (!now) return 'unclear';
  switch (action) {
    case 'send':
      return now.status === 'in_transit' || now.status === 'completed' ? 'done' : now.status === 'draft' ? 'not_done' : 'unclear';
    case 'receive':
      return now.status === 'completed' ? 'done' : now.status === 'in_transit' ? 'not_done' : 'unclear';
    case 'cancel':
      return now.status === 'cancelled' ? 'done' : now.status === 'draft' || now.status === 'in_transit' ? 'not_done' : 'unclear';
  }
}

/** The path of a step. */
export function stepPath(action: TransferAction, transferId: string): string {
  return `/api/v1/inventory/transfers/${encodeURIComponent(transferId)}/${action}`;
}

/** Newest first, and the ones that need this branch to act before the rest. */
export function sortForBranch(transfers: readonly Transfer[], branchId: string): Transfer[] {
  const needsMe = (t: Transfer): number => (actionsFor(t, branchId, true).length > 0 && (t.status === 'in_transit' || directionFor(t, branchId) === 'out') ? 0 : 1);
  return [...transfers].sort((a, b) => needsMe(a) - needsMe(b) || (b.createdAt ?? 0) - (a.createdAt ?? 0));
}
