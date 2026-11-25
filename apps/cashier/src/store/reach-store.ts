import { create } from 'zustand';
import { FIRST_REACH, heard, lost, type Reach, type ReachSink } from '../lib/reach';

interface ReachStore extends Reach {
  heard: () => void;
  lost: () => void;
}

/**
 * Whether the till believes it can reach the server (see `lib/reach.ts`). Read it with a selector, `useReach((s) =>
 * s.offline)`, so that a screen only draws again when the answer changes, not at every call the till makes.
 */
export const useReach = create<ReachStore>((set, get) => ({
  ...FIRST_REACH,
  heard: () => {
    const now = Date.now();
    const state = get();
    // Nothing to tell when the line is up and was heard from a moment ago: calls come in bursts.
    if (!state.offline && state.heardAt !== null && now - state.heardAt < 1_000) return;
    set(heard(state, now));
  },
  lost: () => set(lost(get(), Date.now())),
}));

/** What `watchApi` reports to. */
export const reachSink: ReachSink = {
  heard: () => useReach.getState().heard(),
  lost: () => useReach.getState().lost(),
};
