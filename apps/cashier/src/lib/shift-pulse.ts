import { readTenantValue, writeTenantValue } from '@kiosk/core';

/**
 * What this till remembers about the person's own work, kept on the phone for this shop and nobody else.
 *
 * It is recognition, not a ledger: every number here is a real count of something that happened (a sale
 * that was recorded, a shift that was counted and closed), it never leaves the phone, and losing it costs
 * nothing but the record. Nothing on a screen is inferred from it that the till could not see for itself.
 */
export type ShiftPulse = {
  shiftId: string | null;
  /** Sales finished in the open shift (reset when a new one opens). */
  salesInShift: number;
  /** Sales finished at this shop on this till, all time — the number the milestones count. */
  salesRung: number;
  /** Shifts counted and closed at this shop on this till, all time. */
  closesFinished: number;
  /** Whether the last close left nothing unsent. The till's own "all sent", not a score. */
  lastCloseAllSent: boolean;
  cleanCloseStreak: number;
  bestCleanStreak: number;
  lastClosedAt: string | null;
  /** Milestones already earned here, in the order they were reached. Never removed. */
  earned: MilestoneKey[];
};

export type MilestoneKey = 'first_sale' | 'sales_100' | 'sales_1000' | 'first_close' | 'closes_30';

export const EMPTY_PULSE: ShiftPulse = {
  shiftId: null,
  salesInShift: 0,
  salesRung: 0,
  closesFinished: 0,
  lastCloseAllSent: true,
  cleanCloseStreak: 0,
  bestCleanStreak: 0,
  lastClosedAt: null,
  earned: [],
};

type Milestone = {
  key: MilestoneKey;
  /** The words on the pill, in the till's own voice. */
  label: string;
  /** What it took, in one line — so a milestone is never a mystery. */
  rule: string;
  have: (pulse: ShiftPulse) => number;
  need: number;
};

/**
 * A small, honest set: the first of a thing, and the round numbers after it. They are counts of work the
 * person actually did at this shop, they are earned once, and nothing ever takes one back.
 */
export const RECOGNITIONS: readonly Milestone[] = [
  { key: 'first_sale', label: 'First sale rung', rule: 'Ring your first sale', have: (p) => p.salesRung, need: 1 },
  { key: 'first_close', label: 'First close counted', rule: 'Count and close your first shift', have: (p) => p.closesFinished, need: 1 },
  { key: 'sales_100', label: '100 sales rung', rule: 'Ring 100 sales at this shop', have: (p) => p.salesRung, need: 100 },
  { key: 'closes_30', label: '30 closes finished', rule: 'Finish 30 closes at this shop', have: (p) => p.closesFinished, need: 30 },
  { key: 'sales_1000', label: '1,000 sales rung', rule: 'Ring 1,000 sales at this shop', have: (p) => p.salesRung, need: 1000 },
];

/** The next thing worth reaching for, with where the person is against it. Null when all are earned. */
export function nextMilestone(pulse: ShiftPulse): { milestone: Milestone; have: number; need: number } | null {
  for (const milestone of RECOGNITIONS) {
    if (pulse.earned.includes(milestone.key)) continue;
    return { milestone, have: Math.min(milestone.have(pulse), milestone.need), need: milestone.need };
  }
  return null;
}

/** The milestones a pulse has just reached, in catalogue order. */
export function milestonesReached(pulse: ShiftPulse): MilestoneKey[] {
  return RECOGNITIONS.filter((m) => !pulse.earned.includes(m.key) && m.have(pulse) >= m.need).map((m) => m.key);
}

function withEarned(pulse: ShiftPulse): ShiftPulse {
  const reached = milestonesReached(pulse);
  return reached.length === 0 ? pulse : { ...pulse, earned: [...pulse.earned, ...reached] };
}

/** The words for an earned milestone, for a pill or a line of copy. Empty when it is not one we know. */
export function milestoneWords(key: MilestoneKey): string {
  return RECOGNITIONS.find((m) => m.key === key)?.label ?? '';
}

export function applySaleToPulse(pulse: ShiftPulse, shiftId: string | null): ShiftPulse {
  const sameShift = shiftId !== null && pulse.shiftId === shiftId;
  const baseSales = shiftId === null || sameShift ? pulse.salesInShift : 0;
  return withEarned({
    ...pulse,
    shiftId: shiftId ?? pulse.shiftId,
    salesInShift: baseSales + 1,
    salesRung: pulse.salesRung + 1,
  });
}

export function applyShiftCloseToPulse(
  pulse: ShiftPulse,
  input: { varianceCents: number | null; unsentCount: number; closedAt: string }
): { next: ShiftPulse; clean: boolean; allSent: boolean } {
  const clean = input.varianceCents === 0 && input.unsentCount === 0;
  const allSent = input.unsentCount === 0;
  const cleanCloseStreak = clean ? pulse.cleanCloseStreak + 1 : 0;
  const next = withEarned({
    ...pulse,
    shiftId: null,
    salesInShift: 0,
    closesFinished: pulse.closesFinished + 1,
    lastCloseAllSent: allSent,
    cleanCloseStreak,
    bestCleanStreak: Math.max(pulse.bestCleanStreak, cleanCloseStreak),
    lastClosedAt: input.closedAt,
  });
  return { clean, allSent, next };
}

/** A till is one user at one branch, so the pulse is scoped by tenant; branch/user are kept in the signature for the callers. */
export async function loadShiftPulse(
  tenantId: string,
  _branchId: string,
  _userId: string
): Promise<ShiftPulse> {
  try {
    const raw = await readTenantValue('shiftPulse', tenantId);
    if (!raw) return EMPTY_PULSE;
    let saved: Partial<ShiftPulse> | null;
    try {
      saved = JSON.parse(raw) as Partial<ShiftPulse>;
    } catch {
      return EMPTY_PULSE;
    }
    if (!saved || typeof saved !== 'object') return EMPTY_PULSE;
    const count = (value: unknown): number => (typeof value === 'number' && value >= 0 ? Math.trunc(value) : 0);
    return {
      shiftId: typeof saved.shiftId === 'string' ? saved.shiftId : null,
      salesInShift: count(saved.salesInShift),
      salesRung: count(saved.salesRung),
      closesFinished: count(saved.closesFinished),
      lastCloseAllSent: saved.lastCloseAllSent !== false,
      cleanCloseStreak: count(saved.cleanCloseStreak),
      bestCleanStreak: count(saved.bestCleanStreak),
      lastClosedAt: typeof saved.lastClosedAt === 'string' ? saved.lastClosedAt : null,
      // A milestone is only read back if it is one this build knows: a stale or hand-edited record
      // cannot invent a badge, and one still defined is never lost.
      earned: Array.isArray(saved.earned)
        ? saved.earned.filter((key): key is MilestoneKey => RECOGNITIONS.some((m) => m.key === key))
        : [],
    };
  } catch {
    return EMPTY_PULSE;
  }
}

async function keep(tenantId: string, pulse: ShiftPulse): Promise<void> {
  try {
    await writeTenantValue('shiftPulse', JSON.stringify(pulse), tenantId);
  } catch {
    // Non-blocking: till speed never fails on local stats persistence.
  }
}

export async function recordCompletedSalePulse(
  tenantId: string,
  branchId: string,
  userId: string,
  shiftId: string | null
): Promise<{ pulse: ShiftPulse; earned: MilestoneKey[] }> {
  const current = await loadShiftPulse(tenantId, branchId, userId);
  const next = applySaleToPulse(current, shiftId);
  await keep(tenantId, next);
  return { pulse: next, earned: next.earned.filter((key) => !current.earned.includes(key)) };
}

export async function recordShiftClosePulse(
  tenantId: string,
  branchId: string,
  userId: string,
  input: { varianceCents: number | null; unsentCount: number; closedAt: string }
): Promise<{ next: ShiftPulse; clean: boolean; allSent: boolean; earned: MilestoneKey[] }> {
  const current = await loadShiftPulse(tenantId, branchId, userId);
  const result = applyShiftCloseToPulse(current, input);
  await keep(tenantId, result.next);
  return { ...result, earned: result.next.earned.filter((key) => !current.earned.includes(key)) };
}
