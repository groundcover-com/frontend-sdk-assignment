import { useEffect, useState } from 'react';
import { getDiagnostics } from '../sdk';
import type { TelemetryDiagnostics } from '../sdk/types';
import { demoTimers } from './hostile-env';

/** Polls `getDiagnostics()` so the status bar reflects SDK state as you build it. */
export function useDiagnostics(intervalMs = 400): TelemetryDiagnostics {
  const [diagnostics, setDiagnostics] = useState<TelemetryDiagnostics>(() =>
    getDiagnostics(),
  );

  useEffect(() => {
    // Unthrottled timer, so the status bar still updates while the simulated
    // tab is in the background.
    const id = demoTimers.setInterval(
      () => setDiagnostics(getDiagnostics()),
      intervalMs,
    );
    return () => demoTimers.clearInterval(id);
  }, [intervalMs]);

  return diagnostics;
}
