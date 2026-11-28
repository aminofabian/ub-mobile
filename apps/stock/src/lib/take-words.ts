import type { CountProblem, HeldBy, RowFilter } from './stock-take';

/** What a count that was not taken means, in a sentence for the person. */
export function problemWords(problem: CountProblem): string {
  switch (problem) {
    case 'conflict':
      return 'The server did not take this count. Finding out why…';
    case 'closed':
      return 'This stock take was closed, so the count was not taken.';
    case 'locked':
      return 'A manager has confirmed this line, so it can no longer change.';
    case 'refused':
      return 'The server did not accept this count.';
  }
}

/** Why a count could not even be written down on the phone. */
export function typeFailureWords(why: 'no_line' | 'locked' | 'closed' | 'held'): string {
  switch (why) {
    case 'held':
      return 'Counts typed by someone else are still waiting on this phone.';
    case 'no_line':
      return 'That item is not in this stock take.';
    case 'locked':
      return 'A manager has confirmed this line, so it can no longer change.';
    case 'closed':
      return 'This stock take is closed.';
  }
}

/** Why the Close button is not offered. */
export function closeBlockedWords(why: 'not_allowed' | 'not_open' | 'unsent'): string {
  switch (why) {
    case 'not_allowed':
      return 'Only a manager can close a stock take.';
    case 'not_open':
      return 'This stock take is already closed.';
    case 'unsent':
      return 'Some counts are still waiting to be sent. Send them before closing.';
  }
}

export const FILTERS: ReadonlyArray<{ key: RowFilter; label: string }> = [
  { key: 'todo', label: 'To do' },
  { key: 'counted', label: 'Counted' },
  { key: 'different', label: 'Different' },
  { key: 'unsent', label: 'Not sent' },
  { key: 'all', label: 'All' },
];

/** "+3", "-2", "0": how far a count is from what the system holds, with the sign always shown. */
export function differenceWords(units: number, format: (units: number) => string): string {
  if (units === 0) return '0';
  return units > 0 ? `+${format(units)}` : format(units);
}

/** Counts waiting on this phone that this person cannot send from here: whose they are, and what can be done. */
export function heldWords(by: HeldBy, count: number): { title: string; short: string; long: string } {
  const counts = `${count} ${count === 1 ? 'count' : 'counts'}`;
  const are = count === 1 ? 'is' : 'are';
  if (by === 'branch') {
    return {
      title: 'Counts for another branch',
      short: `${counts} typed for another branch ${are} waiting on this phone.`,
      long: `This phone still holds ${counts} typed for another branch's stock take. They are sent when someone signs in at that branch. Or throw them away here.`,
    };
  }
  return {
    title: 'Counts typed by someone else',
    short: `${counts} typed by someone else ${are} waiting on this phone.`,
    long: `This phone still holds ${counts} typed by someone else. They are sent when that person signs in here again. Or throw them away here.`,
  };
}

/** What signing out does to the signed-in person's counts that have not been sent. */
export function signOutWords(unsent: number): string {
  return `${unsent} ${unsent === 1 ? 'count is' : 'counts are'} waiting on this phone. They stay here, and are sent when you sign in again with a signal. Nobody else can send them. Sign out now?`;
}
