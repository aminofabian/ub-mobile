import { useEffect, useState } from 'react';
import { subscribeOutbox, summarizeOutbox } from '@kiosk/offline';

export interface UnsentSales {
  /** Sales queued on this phone for the open store that have not reached the server. */
  total: number;
  /** Of those, the ones that failed or conflicted and need a person. */
  needsAttention: number;
}

const NONE: UnsentSales = { total: 0, needsAttention: 0 };

/** What is waiting to be sent for the open store, kept current as sales are queued, sent, fail or are discarded. */
export function useUnsentSales(): UnsentSales {
  const [summary, setSummary] = useState<UnsentSales>(NONE);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      summarizeOutbox()
        .then((next) => {
          if (!alive) return;
          setSummary((previous) =>
            previous.total === next.total && previous.needsAttention === next.needsAttention ? previous : next,
          );
        })
        .catch(() => {
          // A queue that cannot be read right now is shown as it was: the badge must never hide a sale.
        });
    };
    refresh();
    const stop = subscribeOutbox(refresh);
    return () => {
      alive = false;
      stop();
    };
  }, []);

  return summary;
}
