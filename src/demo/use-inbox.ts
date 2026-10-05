import { useCallback, useEffect, useState } from 'react';

import { demoTimers } from './hostile-env';
import { fetchInbox, type InboxResponse } from './ingest-api';

/** Polls the mock ingest server so the inspector shows what the SDK sent. */
export function useInbox(intervalMs = 1000) {
  const [inbox, setInbox] = useState<InboxResponse | null>(null);

  const refresh = useCallback(async () => {
    try {
      setInbox(await fetchInbox());
    } catch {
      // The dev server restarts during HMR; the next tick picks it back up.
    }
  }, []);

  useEffect(() => {
    // First poll on the next tick rather than inside the effect itself, then
    // on an unthrottled timer: the inspector keeps updating even while the
    // browser environment panel is simulating a background tab.
    const first = demoTimers.setTimeout(() => void refresh(), 0);
    const id = demoTimers.setInterval(() => void refresh(), intervalMs);
    return () => {
      demoTimers.clearTimeout(first);
      demoTimers.clearInterval(id);
    };
  }, [refresh, intervalMs]);

  return { inbox, refresh };
}
