/**
 * The "full count" (count cycle) the Stock app runs: a shop counts its whole catalogue a batch at a time over
 * several days, instead of the single daily stock take. The server holds the cycle; this reads its answers into
 * shapes the screens can trust. A read that cannot be understood returns null, never a half-filled object, so a
 * bad answer is never shown as real data. Mirrors the web `/inventory/stock-take/batches` flow and the
 * `count-cycles` endpoints (OpenAPI `CountCycleResponse`, `BatchResponse`).
 */

export type CycleStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | string;
export type BatchStatus = 'OPEN' | 'COUNTING' | 'CLOSED' | 'APPLIED' | string;

/** The batch a counter is on now: how many of its lines are counted. */
export type ActiveBatch = {
  sessionId: string;
  batchNumber: number;
  totalCount: number;
  countedCount: number;
};

/** One batch in the cycle's history: when it was, its state, how far it got. */
export type BatchSummary = {
  sessionId: string;
  batchNumber: number;
  status: BatchStatus;
  sessionDate: string | null;
  totalCount: number;
  countedCount: number;
  awaitingApplyCount: number;
  closedAt: string | null;
};

/** The whole cycle at a glance: the figures the overview and progress bar read. */
export type CountCycle = {
  cycleId: string;
  branchId: string;
  status: CycleStatus;
  batchSize: number;
  totalItems: number;
  countedItems: number;
  remainingItems: number;
  batchesDone: number;
  daysRemaining: number | null;
  projectedFinishDate: string | null;
  countedToday: boolean;
  startedAt: string | null;
  completedAt: string | null;
  activeBatch: ActiveBatch | null;
  awaitingApplyCount: number;
  batches: BatchSummary[];
};

/** The Full Count home: the running cycle (if any), how big the catalogue is, and the batch size to suggest. */
export type CycleHome = {
  cycle: CountCycle | null;
  catalogSize: number;
  defaultBatchSize: number;
};

/** One line of a batch: an item to count, what the system thinks is on the shelf, and what was counted. */
export type BatchLine = {
  lineId: string;
  itemId: string;
  itemName: string;
  itemSku: string | null;
  barcode: string | null;
  categoryName: string | null;
  unitType: string | null;
  imageUrl: string | null;
  aisle: string | null;
  countedQty: number | null;
  systemQty: number | null;
  status: string | null;
};

/** A batch opened for counting: its lines, and whether the system figure may be shown beside each. */
export type Batch = {
  sessionId: string;
  cycleId: string;
  batchNumber: number;
  status: BatchStatus;
  sessionDate: string | null;
  totalCount: number;
  countedCount: number;
  showsSystemStock: boolean;
  lines: BatchLine[];
};

// ---- parsers -------------------------------------------------------------------------------------

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}
function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function int(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
}
function bool(value: unknown): boolean {
  return value === true;
}

function readActiveBatch(raw: unknown): ActiveBatch | null {
  const o = obj(raw);
  if (!o) return null;
  const sessionId = str(o.sessionId);
  if (!sessionId) return null;
  return {
    sessionId,
    batchNumber: int(o.batchNumber),
    totalCount: int(o.totalCount),
    countedCount: int(o.countedCount),
  };
}

function readBatchSummary(raw: unknown): BatchSummary | null {
  const o = obj(raw);
  if (!o) return null;
  const sessionId = str(o.sessionId);
  if (!sessionId) return null;
  return {
    sessionId,
    batchNumber: int(o.batchNumber),
    status: str(o.status) ?? 'OPEN',
    sessionDate: str(o.sessionDate),
    totalCount: int(o.totalCount),
    countedCount: int(o.countedCount),
    awaitingApplyCount: int(o.awaitingApplyCount),
    closedAt: str(o.closedAt),
  };
}

/** The cycle, or null when the answer is not a cycle (no id). */
export function readCycle(raw: unknown): CountCycle | null {
  const o = obj(raw);
  if (!o) return null;
  const cycleId = str(o.cycleId);
  const branchId = str(o.branchId);
  if (!cycleId || !branchId) return null;
  const batches = Array.isArray(o.batches)
    ? o.batches.map(readBatchSummary).filter((b): b is BatchSummary => b !== null)
    : [];
  return {
    cycleId,
    branchId,
    status: str(o.status) ?? 'ACTIVE',
    batchSize: int(o.batchSize),
    totalItems: int(o.totalItems),
    countedItems: int(o.countedItems),
    remainingItems: int(o.remainingItems),
    batchesDone: int(o.batchesDone),
    daysRemaining: num(o.daysRemaining),
    projectedFinishDate: str(o.projectedFinishDate),
    countedToday: bool(o.countedToday),
    startedAt: str(o.startedAt),
    completedAt: str(o.completedAt),
    activeBatch: readActiveBatch(o.activeBatch),
    awaitingApplyCount: int(o.awaitingApplyCount),
    batches,
  };
}

/** The Full Count home, or null when the answer cannot be read. A missing cycle is a valid "none running". */
export function readHome(raw: unknown): CycleHome | null {
  const o = obj(raw);
  if (!o) return null;
  // The response always carries the catalogue size and a default; the cycle may be absent (none running).
  return {
    cycle: o.cycle === undefined || o.cycle === null ? null : readCycle(o.cycle),
    catalogSize: int(o.catalogSize),
    defaultBatchSize: int(o.defaultBatchSize, 50),
  };
}

function readBatchLine(raw: unknown): BatchLine | null {
  const o = obj(raw);
  if (!o) return null;
  const lineId = str(o.lineId);
  const itemId = str(o.itemId);
  if (!lineId || !itemId) return null;
  return {
    lineId,
    itemId,
    itemName: str(o.itemName) ?? 'Item',
    itemSku: str(o.itemSku),
    barcode: str(o.barcode),
    categoryName: str(o.categoryName),
    unitType: str(o.unitType),
    imageUrl: str(o.imageUrl),
    aisle: str(o.aisle),
    countedQty: num(o.countedQty),
    systemQty: num(o.systemQty),
    status: str(o.status),
  };
}

/** A batch with its lines, or null when the answer is not a batch (no session id). */
export function readBatch(raw: unknown): Batch | null {
  const o = obj(raw);
  if (!o) return null;
  const sessionId = str(o.sessionId);
  const cycleId = str(o.cycleId);
  if (!sessionId || !cycleId) return null;
  const lines = Array.isArray(o.lines)
    ? o.lines.map(readBatchLine).filter((l): l is BatchLine => l !== null)
    : [];
  return {
    sessionId,
    cycleId,
    batchNumber: int(o.batchNumber),
    status: str(o.status) ?? 'OPEN',
    sessionDate: str(o.sessionDate),
    totalCount: int(o.totalCount),
    countedCount: int(o.countedCount),
    showsSystemStock: bool(o.showsSystemStock),
    lines,
  };
}

// ---- derived views -------------------------------------------------------------------------------

/** How far the whole cycle has got, 0..1, for the progress bar. */
export function cycleProgress(cycle: CountCycle): number {
  if (cycle.totalItems <= 0) return 0;
  return Math.max(0, Math.min(1, cycle.countedItems / cycle.totalItems));
}

/** How far the current batch has got, 0..1. */
export function batchProgress(batch: Pick<Batch, 'totalCount' | 'countedCount'>): number {
  if (batch.totalCount <= 0) return 0;
  return Math.max(0, Math.min(1, batch.countedCount / batch.totalCount));
}

/** The difference between what was counted and what the system holds, or null when either is unknown. */
export function lineDifference(line: BatchLine): number | null {
  if (line.countedQty === null || line.systemQty === null) return null;
  return line.countedQty - line.systemQty;
}

/** Whether a line has been counted (a number was entered, zero included). */
export function isCounted(line: BatchLine): boolean {
  return line.countedQty !== null;
}

function sameStatus(status: string, expected: string): boolean {
  return status.trim().toLowerCase() === expected;
}

/** The server says `active`, `completed`, `cancelled` — not the uppercase words. */
export function cycleIsActive(status: string): boolean {
  return sameStatus(status, 'active');
}

export function cycleIsCompleted(status: string): boolean {
  return sameStatus(status, 'completed');
}

/** A finished batch session. The server says `closed`, whether or not the counts are posted yet. */
export function batchIsClosed(status: string): boolean {
  return sameStatus(status, 'closed');
}

/** A counted line still waiting for a manager to post it. */
export function lineAwaitsPost(line: BatchLine): boolean {
  return sameStatus(line.status ?? '', 'submitted');
}

/** Open, "3 to post", or Posted — the same words as the web batch list. */
export function batchPostingWords(batch: Pick<BatchSummary, 'status' | 'awaitingApplyCount'>): string {
  if (!batchIsClosed(batch.status)) return 'Open';
  if (batch.awaitingApplyCount > 0) return batch.awaitingApplyCount === 1 ? '1 to post' : `${batch.awaitingApplyCount} to post`;
  return 'Posted';
}

export type TodayPrompt = { title: string; body: string; action: string };

/** What the counter should do with today's batch. Null when the cycle is not running, or nothing is left. */
export function todayPrompt(cycle: CountCycle): TodayPrompt | null {
  if (!cycleIsActive(cycle.status)) return null;
  if (cycle.remainingItems <= 0 && !cycle.activeBatch) return null;
  const active = cycle.activeBatch;
  if (active) {
    return {
      title: `Batch ${active.batchNumber} is open`,
      body: `${active.countedCount} of ${active.totalCount} counted so far.`,
      action: 'Continue counting',
    };
  }
  const nextSize = Math.min(cycle.batchSize, cycle.remainingItems);
  if (!cycle.countedToday) {
    return {
      title: "Today's batch",
      body: `Next ${nextSize} ${nextSize === 1 ? 'product' : 'products'}, shelf by shelf.`,
      action: "Start today's batch",
    };
  }
  return {
    title: "Today's count is in",
    body: 'Next batch is due tomorrow. Still on the floor? Keep going.',
    action: `Count ${nextSize} more now`,
  };
}

export type DayMark = { key: string; state: 'done' | 'current' | 'upcoming' };

/** One mark per counting day: finished batches, then the days still ahead. */
export function dayMarks(cycle: CountCycle): DayMark[] {
  const done = cycle.batches.filter((batch) => batchIsClosed(batch.status)).map((batch) => ({ key: `done-${batch.sessionId}`, state: 'done' as const }));
  if (!cycleIsActive(cycle.status)) return done;
  const todaySpent = cycle.countedToday && !cycle.activeBatch;
  const remaining = Math.max(0, Math.round(cycle.daysRemaining ?? 0));
  const ahead = Array.from({ length: remaining }, (_, index) => ({
    key: `day-${index}`,
    state: (index === 0 && !todaySpent ? 'current' : 'upcoming') as DayMark['state'],
  }));
  return [...done, ...ahead];
}
