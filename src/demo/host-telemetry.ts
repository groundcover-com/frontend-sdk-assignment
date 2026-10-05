/**
 * Acme Store's telemetry setup: the code a customer writes when they embed
 * the SDK. The configuration panel hands it the values from the form; this
 * file decides how the SDK gets started and stopped.
 *
 * It belongs to the host app, not to the SDK. If a change to the SDK means a
 * customer has to write something new, this is where they write it.
 */

import { init, shutdown } from '../sdk';
import type { TelemetryConfig } from '../sdk/types';
import { callSdk } from './host-health';

export function startTelemetry(config: TelemetryConfig): void {
  callSdk('init()', () => init(config));
}

export function stopTelemetry(): void {
  void callSdk('shutdown()', () => shutdown());
}
