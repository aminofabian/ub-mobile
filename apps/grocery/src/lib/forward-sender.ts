import {
  afterDraft,
  afterIssued,
  afterRefused,
  beginStep,
  classifyForwardError,
  classifyOpenDraftError,
  DRAFT_CLOSED,
  draftName,
  isAnotherDraft,
  isPhoneDraftName,
  MAX_OPEN_CHECKED,
  MIXED_IN,
  nextToSend,
  OPEN_ELSEWHERE,
  readDraftName,
  readDraftReply,
  readIssueReply,
  readOpenDrafts,
  UNREADABLE,
  type ForwardEntry,
  type ForwardProblem,
  type ForwardResult,
  type ForwardState,
} from './forward';

/**
 * Sends the sales waiting on this phone to the server, oldest first, one at a time. Every step is written down before it
 * is sent and every answer after it is read, so closing the app in the middle costs nothing: the next pass asks again
 * under the same keys and the server hands back what it already made. A sale the server refuses is marked and left for
 * a person, not sent over and over. Only the person who made a sale ever sends it.
 */

export type ForwardDeps = {
  /** Whose sales this sender may send. */
  ownerId: string;
  read: () => ForwardState | null;
  change: (change: (state: ForwardState) => ForwardState) => void;
  /** Makes the draft (or gets the one the server already has). Throws what the request throws. */
  makeDraft: (entry: ForwardEntry) => Promise<unknown>;
  /** Issues the draft under the entry's key. `entry.draftId` is set. */
  issue: (entry: ForwardEntry) => Promise<unknown>;
  /**
   * The drafts this person has open at the server. The server puts the lines of a new draft into the draft a person
   * already has open at a branch, whatever the new one is called, so before a sale's draft is made for the first time
   * the open ones are looked at: one this phone left behind is cancelled, one anyone else is using is left alone and
   * the sale is held back. Absent: nothing is looked at, and the answer to the draft is the only protection.
   */
  openDrafts?: {
    list: (entry: ForwardEntry) => Promise<unknown>;
    read: (draftId: string) => Promise<unknown>;
    cancel: (draftId: string) => Promise<unknown>;
  };
  /**
   * Settles when what `change` has asked to be kept has been written down, and answers whether it landed. A request
   * goes out only once the note that it is going has been written: with no way to keep the note, nothing is sent.
   */
  saved?: () => Promise<boolean>;
  /**
   * Whether this sender is still the one for the person who is signed in. Once it says no (the person signed out, or
   * another shop or person has the phone) nothing more is asked of the server: the pass stops where it is, and what was
   * already asked for is recorded as usual. Absent: always yes.
   */
  live?: () => boolean;
  now?: () => number;
  /** Called after a sale is issued successfully — used to print the department invoice quietly. Must not throw. */
  onIssued?: (entry: ForwardEntry, result: ForwardResult) => void | Promise<void>;
};

export type ForwardReport = { sent: number; refused: number; stopped: boolean };

export type ForwardSender = { flush: () => Promise<ForwardReport> };

export function createForwardSender(deps: ForwardDeps): ForwardSender {
  let running: Promise<ForwardReport> | null = null;
  let again = false;
  const now = deps.now ?? Date.now;
  const gone = (): boolean => deps.live !== undefined && !deps.live();

  function entryNow(id: string): ForwardEntry | null {
    return deps.read()?.entries.find((entry) => entry.id === id) ?? null;
  }

  /**
   * Whether anything is open at the server that this sale's draft would be mixed into. `clear`: go ahead. `wait`: no
   * answer came, try again later. Anything else is why this sale cannot go now, and nothing has been changed for it.
   */
  async function makeRoom(entry: ForwardEntry): Promise<'clear' | 'wait' | ForwardProblem> {
    const open = deps.openDrafts;
    if (!open) return 'clear';
    let ids: string[] | null;
    try {
      ids = readOpenDrafts(await open.list(entry));
    } catch (error) {
      // A no that cannot be used is not a reason to hold the sale: the answer to the draft itself is checked as well.
      return classifyOpenDraftError(error) === 'wait' ? 'wait' : 'clear';
    }
    if (!ids || ids.length === 0) return 'clear';
    if (ids.length > MAX_OPEN_CHECKED) return OPEN_ELSEWHERE;
    for (const id of ids) {
      if (gone()) return 'wait';
      let named: ReturnType<typeof readDraftName>;
      try {
        named = readDraftName(await open.read(id));
      } catch (error) {
        const how = classifyOpenDraftError(error);
        if (how === 'wait') return 'wait';
        if (how === 'gone') continue;
        return OPEN_ELSEWHERE;
      }
      if (!named) return OPEN_ELSEWHERE;
      // Closed since the list was made: nothing is open there any more.
      if (named.status !== 'building') continue;
      // GS2: a new phone draft is its own row — a web counter draft open for the
      // same person must not hold this sale back. Only clear phone leftovers.
      if (!isPhoneDraftName(named.clientDraftId)) continue;
      // The list was asked for this person's drafts only, but a draft is cancelled only once the server says it is theirs.
      if (named.createdBy !== deps.ownerId) return OPEN_ELSEWHERE;
      if (gone()) return 'wait';
      try {
        await open.cancel(id);
      } catch (error) {
        const how = classifyOpenDraftError(error);
        if (how === 'wait') return 'wait';
        if (how === 'no') return OPEN_ELSEWHERE;
      }
    }
    return 'clear';
  }

  /** A refused sale's draft is cancelled so that it does not take the next sale's lines into it. A failure here is left for the next pass to clear. */
  async function clearDraft(draftId: string): Promise<void> {
    if (!deps.openDrafts || gone()) return;
    try {
      await deps.openDrafts.cancel(draftId);
    } catch {
      // Cleared before the next sale is sent, by makeRoom.
    }
  }

  async function pass(): Promise<ForwardReport> {
    const report: ForwardReport = { sent: 0, refused: 0, stopped: false };
    const refuse = (id: string, problem: ForwardProblem, stillInDoubt = false) => {
      deps.change((state) => afterRefused(state, id, problem, stillInDoubt));
      report.refused += 1;
    };
    const recorded = async (): Promise<boolean> => (deps.saved ? await deps.saved() : true);
    // A sale that was sent or refused is no longer next, and one the server cannot answer stops the pass; this bound is
    // only a seatbelt against a state that never settles.
    for (let guard = 0; guard < 200; guard += 1) {
      if (gone()) {
        report.stopped = true;
        break;
      }
      const state = deps.read();
      if (!state) break;
      const entry = nextToSend(state, deps.ownerId);
      if (!entry) break;

      if (!entry.draftId) {
        // The first time a sale goes, what is open at the server is looked at. A sale asked for again has been through this,
        // and the server finds its draft by name before it looks for one to add to.
        if (entry.sentAt === null) {
          const room = await makeRoom(entry);
          if (room === 'wait') {
            report.stopped = true;
            break;
          }
          if (room !== 'clear') {
            refuse(entry.id, room);
            continue;
          }
          // The sale may have been taken off the list, or marked, while the server was being asked.
          const still = entryNow(entry.id);
          if (!still || still.problem || still.result) continue;
        }
        if (gone()) {
          report.stopped = true;
          break;
        }
        deps.change((s) => beginStep(s, entry.id, now()));
        if (!(await recorded()) || gone()) {
          report.stopped = true;
          break;
        }
        const name = draftName(entry.id);
        let raw: unknown;
        try {
          raw = await deps.makeDraft(entry);
        } catch (error) {
          const failure = classifyForwardError(error, 'draft');
          if (failure.kind === 'wait') {
            report.stopped = true;
            break;
          }
          refuse(entry.id, failure.problem);
          continue;
        }
        const reply = readDraftReply(raw, name);
        if (!reply) {
          // A draft with another name is the server having put this sale into one that was open: it was not sent.
          refuse(entry.id, isAnotherDraft(raw, name) ? MIXED_IN : UNREADABLE, true);
          continue;
        }
        if (reply.status === 'cancelled') {
          refuse(entry.id, DRAFT_CLOSED);
          continue;
        }
        deps.change((s) => afterDraft(s, entry.id, reply.draftId));
      }

      // The sale may have been taken off the list while the draft was on its way; then there is nothing more to send.
      const ready = entryNow(entry.id);
      if (!ready || !ready.draftId || ready.result || ready.problem) continue;

      if (gone()) {
        report.stopped = true;
        break;
      }
      deps.change((s) => beginStep(s, entry.id, now()));
      if (!(await recorded()) || gone()) {
        report.stopped = true;
        break;
      }
      let raw: unknown;
      try {
        raw = await deps.issue(ready);
      } catch (error) {
        const failure = classifyForwardError(error, 'issue');
        if (failure.kind === 'wait') {
          report.stopped = true;
          break;
        }
        refuse(entry.id, failure.problem);
        await clearDraft(ready.draftId);
        continue;
      }
      const result = readIssueReply(raw, ready.draftId);
      if (!result) {
        refuse(entry.id, UNREADABLE, true);
        continue;
      }
      deps.change((s) => afterIssued(s, entry.id, result, now()));
      report.sent += 1;
      const issued = entryNow(entry.id) ?? ready;
      try {
        await deps.onIssued?.(issued, result);
      } catch {
        // Printing must never stop the next sale from going out.
      }
    }
    return report;
  }

  return {
    flush() {
      if (running) {
        // A pass is on its way: a sale queued since it began is picked up by one more pass, not by a second sender.
        again = true;
        return running;
      }
      running = (async () => {
        // Let `running` be set before anything is called: a send that asks for a flush at once must find this one.
        await Promise.resolve();
        const total: ForwardReport = { sent: 0, refused: 0, stopped: false };
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
