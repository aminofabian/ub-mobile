import { isApiError } from '@kiosk/core';
import { afterRefused, afterSent, type CountProblem, type TakeCopy } from './stock-take';

/**
 * Sends the counts typed on this phone, one line at a time, newest value per line. A count is "set this line to N",
 * which is the same whether it is sent once or twice, so sending is safe to repeat and no key is needed. What matters
 * is the order of things: a count typed again while an older one is on its way is never lost, and a count the server
 * refuses is marked and left for a person rather than sent over and over.
 */

export type SendFailure = { kind: 'wait' } | { kind: 'problem'; problem: CountProblem };

/**
 * What a failed send means. No answer, a session that ended, a busy server, a web page where the server's answer should
 * be (a hotel's sign-in page, whatever status it came with, a 409 included): try again later and say nothing is wrong.
 * A 409 from the server is "not accepted" and a re-read says why (the stock take was closed, or a manager has confirmed
 * the line). Any other refusal the app wrote is a person's to read. The status is read, never the words.
 */
export function classifySend(error: unknown): SendFailure {
  if (!isApiError(error)) return { kind: 'wait' };
  if (error.foreign) return { kind: 'wait' };
  const { status } = error;
  if (status === 409) return { kind: 'problem', problem: 'conflict' };
  if (status === 401 || status === 408 || status === 423 || status === 429 || status >= 500) return { kind: 'wait' };
  if (status >= 400) return { kind: 'problem', problem: 'refused' };
  return { kind: 'wait' };
}

export type SenderDeps = {
  read: () => TakeCopy | null;
  change: (change: (copy: TakeCopy) => TakeCopy) => void;
  send: (sessionId: string, lineId: string, units: number) => Promise<void>;
  /** Reads the session again after a 409 so the person is told why. Failing to is not an error. */
  explain?: () => Promise<void>;
  /**
   * Whether this sender still belongs to the screen that made it. Once it says no, nothing new is sent and nothing is
   * asked of the server; what was already on its way is still written down, so a count that went is never sent twice.
   */
  live?: () => boolean;
};

export type SendReport = { sent: number; refused: number; stopped: boolean };

export type CountSender = { flush: () => Promise<SendReport> };

export function createCountSender(deps: SenderDeps): CountSender {
  let running: Promise<SendReport> | null = null;
  let again = false;
  const gone = (): boolean => deps.live !== undefined && !deps.live();

  async function pass(): Promise<SendReport> {
    const report: SendReport = { sent: 0, refused: 0, stopped: false };
    const copy = deps.read();
    if (!copy || !copy.take.open) return report;
    const sessionId = copy.take.id;
    const queue = Object.entries(copy.pending)
      .filter(([, entry]) => entry.problem === null)
      .sort((a, b) => a[1].typedAt - b[1].typedAt);
    let conflicted = false;
    for (const [lineId] of queue) {
      // What is waiting is read again for every line: a newer count may have been typed, the stock take may have changed.
      const current = deps.read();
      if (!current || current.take.id !== sessionId) break;
      const live = current.pending[lineId];
      if (!live || live.problem !== null) continue;
      const units = live.units;
      if (gone()) {
        report.stopped = true;
        break;
      }
      try {
        await deps.send(sessionId, lineId, units);
      } catch (error) {
        const failure = classifySend(error);
        if (failure.kind === 'wait') {
          report.stopped = true;
          break;
        }
        deps.change((now) => (now.take.id === sessionId ? afterRefused(now, lineId, units, failure.problem) : now));
        report.refused += 1;
        conflicted = conflicted || failure.problem === 'conflict';
        continue;
      }
      deps.change((now) => (now.take.id === sessionId ? afterSent(now, lineId, units) : now));
      report.sent += 1;
    }
    if (conflicted && deps.explain && !gone()) {
      try {
        await deps.explain();
      } catch {
        // The counts stay marked; the person can read the stock take again by hand.
      }
    }
    return report;
  }

  return {
    flush() {
      if (running) {
        // A pass is on its way: whatever was typed since it began is picked up by one more pass, not by a second sender.
        again = true;
        return running;
      }
      running = (async () => {
        // Let `running` be set before anything is called: a send that asks for a flush at once must find this one.
        await Promise.resolve();
        const total: SendReport = { sent: 0, refused: 0, stopped: false };
        try {
          do {
            again = false;
            const report = await pass();
            total.sent += report.sent;
            total.refused += report.refused;
            total.stopped = report.stopped;
            if (report.stopped) break;
          } while (again);
        } finally {
          running = null;
        }
        return total;
      })();
      return running;
    },
  };
}
