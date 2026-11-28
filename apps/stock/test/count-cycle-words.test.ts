import assert from 'node:assert/strict';
import test from 'node:test';
import {
  batchIsClosed,
  batchPostingWords,
  cycleIsActive,
  dayMarks,
  todayPrompt,
  type CountCycle,
} from '../src/lib/count-cycle';

function cycle(over: Partial<CountCycle> = {}): CountCycle {
  return {
    cycleId: 'c1',
    branchId: 'b1',
    status: 'active',
    batchSize: 25,
    totalItems: 40,
    countedItems: 10,
    remainingItems: 30,
    batchesDone: 1,
    daysRemaining: 2,
    projectedFinishDate: null,
    countedToday: false,
    startedAt: null,
    completedAt: null,
    activeBatch: null,
    awaitingApplyCount: 0,
    batches: [],
    ...over,
  };
}

test('a running cycle is the server word active, not ACTIVE', () => {
  assert.equal(cycleIsActive('active'), true);
  assert.equal(cycleIsActive('ACTIVE'), true);
  assert.equal(cycleIsActive('completed'), false);
  assert.equal(batchIsClosed('closed'), true);
  assert.equal(batchIsClosed('in_progress'), false);
});

test('a closed batch is posted only when nothing is still waiting', () => {
  assert.equal(batchPostingWords({ status: 'in_progress', awaitingApplyCount: 0 }), 'Open');
  assert.equal(batchPostingWords({ status: 'closed', awaitingApplyCount: 3 }), '3 to post');
  assert.equal(batchPostingWords({ status: 'closed', awaitingApplyCount: 0 }), 'Posted');
});

test("today's prompt follows an open batch, then a fresh day, then a day already counted", () => {
  assert.equal(todayPrompt(cycle({ activeBatch: { sessionId: 's', batchNumber: 2, totalCount: 25, countedCount: 4 } }))?.action, 'Continue counting');
  assert.equal(todayPrompt(cycle())?.action, "Start today's batch");
  assert.match(todayPrompt(cycle({ countedToday: true }))?.action ?? '', /Count 25 more/);
  assert.equal(todayPrompt(cycle({ status: 'completed', remainingItems: 0 })), null);
});

test('day marks are the finished batches, then the days still ahead', () => {
  const marks = dayMarks(
    cycle({
      batches: [
        {
          sessionId: 's1',
          batchNumber: 1,
          status: 'closed',
          sessionDate: '2026-11-26',
          totalCount: 25,
          countedCount: 25,
          awaitingApplyCount: 0,
          closedAt: null,
        },
      ],
    })
  );
  assert.deepEqual(
    marks.map((mark) => mark.state),
    ['done', 'current', 'upcoming']
  );
  assert.deepEqual(
    dayMarks(cycle({ status: 'completed', daysRemaining: 0, batches: [] })).map((mark) => mark.state),
    []
  );
});
