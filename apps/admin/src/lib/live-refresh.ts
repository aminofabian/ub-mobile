/**
 * A tiny in-app bus so a live WebSocket event can nudge whichever screen is open to refresh the right
 * figures. The realtime client (wired in OwnerNavigator) fires a topic; a screen subscribes to it and
 * reloads. Keeping it to topics, not payloads, means a screen refreshes from the server (the figure the
 * owner trusts) rather than trying to patch its own state from a partial event.
 */

/** What a live event asks the open screen to refresh. */
export type LiveTopic = 'sales' | 'suppliers';

type Handler = (topic: LiveTopic) => void;

const handlers = new Set<Handler>();

/** Subscribe to live refresh nudges. Returns an unsubscribe. */
export function onLiveRefresh(handler: Handler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/** Fire a topic at every subscriber. Safe to call when nothing is listening. */
export function emitLiveRefresh(topic: LiveTopic): void {
  for (const handler of handlers) {
    try {
      handler(topic);
    } catch {
      // One screen's refresh throwing must not stop the others.
    }
  }
}
