import { readTenantValue, writeTenantValue } from '@kiosk/core';

export type ShiftPulse = {
  shiftId: string | null;
  salesInShift: number;
  cleanCloseStreak: number;
  bestCleanStreak: number;
  lastClosedAt: string | null;
};

export const EMPTY_PULSE: ShiftPulse = {
  shiftId: null,
  salesInShift: 0,
  cleanCloseStreak: 0,
  bestCleanStreak: 0,
  lastClosedAt: null,
};

export function applySaleToPulse(pulse: ShiftPulse, shiftId: string | null): ShiftPulse {
  const sameShift = shiftId !== null && pulse.shiftId === shiftId;
  const baseSales = shiftId === null || sameShift ? pulse.salesInShift : 0;
  return {
    ...pulse,
    shiftId: shiftId ?? pulse.shiftId,
    salesInShift: baseSales + 1,
  };
}

export function applyShiftCloseToPulse(
  pulse: ShiftPulse,
  input: { varianceCents: number | null; unsentCount: number; closedAt: string }
): { next: ShiftPulse; clean: boolean } {
  const clean = input.varianceCents === 0 && input.unsentCount === 0;
  const cleanCloseStreak = clean ? pulse.cleanCloseStreak + 1 : 0;
  return {
    clean,
    next: {
      shiftId: null,
      salesInShift: 0,
      cleanCloseStreak,
      bestCleanStreak: Math.max(pulse.bestCleanStreak, cleanCloseStreak),
      lastClosedAt: input.closedAt,
    },
  };
}

const MILESTONES = new Set([10, 25, 50, 100, 150, 200, 300, 500]);

/** Returns a quiet milestone caption only at meaningful round counts; null otherwise. */
export function shiftMilestoneLabel(salesInShift: number): string | null {
  if (!MILESTONES.has(salesInShift)) return null;
  const mod100 = salesInShift % 100;
  const mod10 = salesInShift % 10;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? 'th'
      : mod10 === 1
        ? 'st'
        : mod10 === 2
          ? 'nd'
          : mod10 === 3
            ? 'rd'
            : 'th';
  return `${salesInShift}${suffix} sale this shift`;
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
    return {
      shiftId: typeof saved.shiftId === 'string' ? saved.shiftId : null,
      salesInShift: typeof saved.salesInShift === 'number' && saved.salesInShift >= 0 ? Math.trunc(saved.salesInShift) : 0,
      cleanCloseStreak:
        typeof saved.cleanCloseStreak === 'number' && saved.cleanCloseStreak >= 0
          ? Math.trunc(saved.cleanCloseStreak)
          : 0,
      bestCleanStreak:
        typeof saved.bestCleanStreak === 'number' && saved.bestCleanStreak >= 0
          ? Math.trunc(saved.bestCleanStreak)
          : 0,
      lastClosedAt: typeof saved.lastClosedAt === 'string' ? saved.lastClosedAt : null,
    };
  } catch {
    return EMPTY_PULSE;
  }
}

export async function recordCompletedSalePulse(
  tenantId: string,
  branchId: string,
  userId: string,
  shiftId: string | null
): Promise<ShiftPulse> {
  const current = await loadShiftPulse(tenantId, branchId, userId);
  const next = applySaleToPulse(current, shiftId);
  try {
    await writeTenantValue('shiftPulse', JSON.stringify(next), tenantId);
  } catch {
    // Non-blocking: till speed never fails on local stats persistence.
  }
  return next;
}

export async function recordShiftClosePulse(
  tenantId: string,
  branchId: string,
  userId: string,
  input: { varianceCents: number | null; unsentCount: number; closedAt: string }
): Promise<{ next: ShiftPulse; clean: boolean }> {
  const current = await loadShiftPulse(tenantId, branchId, userId);
  const result = applyShiftCloseToPulse(current, input);
  try {
    await writeTenantValue('shiftPulse', JSON.stringify(result.next), tenantId);
  } catch {
    // Non-blocking.
  }
  return result;
}
