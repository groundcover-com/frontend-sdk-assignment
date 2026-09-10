import { useEffect, useState } from 'react';
import { getDiagnostics } from '../sdk';
import type { TelemetryDiagnostics } from '../sdk/types';

/** Polls `getDiagnostics()` so the status bar reflects SDK state as you build it. */
export function useDiagnostics(intervalMs = 400): TelemetryDiagnostics {
  const [diagnostics, setDiagnostics] = useState<TelemetryDiagnostics>(() =>
    getDiagnostics(),
  );

  useEffect(() => {
    const id = setInterval(() => setDiagnostics(getDiagnostics()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return diagnostics;
}
