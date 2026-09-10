import type {
  EventAttributes,
  TelemetryConfig,
  TelemetryDiagnostics,
  TelemetryUser,
} from './types';

export type {
  AttributeValue,
  BatchContext,
  EventAttributes,
  EventBatch,
  TelemetryConfig,
  TelemetryDiagnostics,
  TelemetryEvent,
  TelemetryEventType,
  TelemetryUser,
} from './types';

/** Identifies the SDK on every batch. */
export const SDK_NAME = 'gc-browser';
export const SDK_VERSION = '0.1.0';

const warned = new Set<string>();

/** Placeholder so the demo app runs against an unimplemented SDK. Delete as you go. */
function notImplemented(fn: string, args?: Record<string, unknown>): void {
  if (!warned.has(fn)) {
    warned.add(fn);
    console.warn(`[sdk] ${fn}() is not implemented yet`, args ?? {});
  }
}

/**
 * Start the SDK. Called once, as early as possible in the page's life.
 *
 * Contract:
 * - Applies the documented defaults for every optional config field.
 * - Rejects an unusable config (missing `apiKey` or `endpoint`) without throwing
 *   into the host application.
 * - Is idempotent: a second call with the same config must not double-start
 *   timers or listeners.
 * - Establishes the session and decides sampling for it.
 */
export function init(config: TelemetryConfig): void {
  notImplemented('init', { config });
}

/**
 * Record a custom event. Must be safe to call before `init` and after
 * `shutdown`, and must never throw.
 */
export function track(name: string, attributes?: EventAttributes): void {
  notImplemented('track', { name, attributes });
}

/** Record a page view. `path` defaults to the current location. */
export function trackPageView(
  path?: string,
  attributes?: EventAttributes,
): void {
  notImplemented('trackPageView', { path, attributes });
}

/**
 * Record an error as an event. Accepts anything a `catch` block can produce;
 * pull a message and stack out of it when it is an `Error`.
 */
export function captureError(
  error: unknown,
  attributes?: EventAttributes,
): void {
  notImplemented('captureError', { error, attributes });
}

/**
 * Attach a user to subsequent batches, or detach with `null`. Events already
 * queued belong to whoever was set when they were sent.
 */
export function setUser(user: TelemetryUser | null): void {
  notImplemented('setUser', { user });
}

/**
 * Send everything queued now. Resolves once the queue has drained or been
 * given up on — never rejects.
 */
export function flush(): Promise<void> {
  notImplemented('flush');
  return Promise.resolve();
}

/**
 * Stop the SDK: flush what is queued, then release timers and listeners so the
 * page can be torn down cleanly. A later `init` must be able to start again.
 */
export function shutdown(): Promise<void> {
  notImplemented('shutdown');
  return Promise.resolve();
}

/** Snapshot of SDK state. The demo page polls this to render the status bar. */
export function getDiagnostics(): TelemetryDiagnostics {
  return {
    initialized: false,
    sessionId: null,
    sampled: false,
    queued: 0,
    inFlight: 0,
    sent: 0,
    dropped: 0,
    retries: 0,
    lastError: null,
  };
}
