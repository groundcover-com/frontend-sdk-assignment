/**
 * Public and wire types for the browser telemetry SDK.
 *
 * The `TelemetryEvent` / `EventBatch` shapes are the contract with the ingest
 * server: it validates them and answers `400` with the exact reason when a
 * batch does not fit. Treat them as fixed. Everything else in `src/sdk` is
 * yours to shape.
 */

/** Attribute values that survive JSON transport. Anything else is not allowed. */
export type AttributeValue = string | number | boolean | null;

export type EventAttributes = Record<string, AttributeValue>;

export type TelemetryEventType = 'custom' | 'page_view' | 'error';

/** A single event, as it appears on the wire. */
export interface TelemetryEvent {
  /** Unique per event. The server flags an id it has already accepted as a duplicate. */
  id: string;
  type: TelemetryEventType;
  name: string;
  /** Epoch milliseconds, captured when the event happened — not when it was sent. */
  timestamp: number;
  /** Monotonic position within the session, starting at 1. */
  seq: number;
  attributes?: EventAttributes;
}

export interface TelemetryUser {
  id: string;
  email?: string;
  attributes?: EventAttributes;
}

/** Ambient information the SDK adds to every batch. */
export interface BatchContext {
  url: string;
  referrer?: string;
  userAgent: string;
  language?: string;
  screen?: { width: number; height: number };
  appVersion?: string;
  environment?: string;
}

/** One HTTP request's worth of events. */
export interface EventBatch {
  /**
   * Sent in the body rather than a header: `navigator.sendBeacon` cannot set
   * request headers, and the same payload has to work for both transports.
   */
  apiKey: string;
  sdk: { name: string; version: string };
  session: { id: string; startedAt: number };
  user?: TelemetryUser;
  context: BatchContext;
  events: TelemetryEvent[];
  /** Epoch milliseconds at which this request was made. */
  sentAt: number;
  /** 1 on the first try, 2 on the first retry, and so on. */
  attempt: number;
}

export interface TelemetryConfig {
  /** Required. The ingest server rejects anything else with `401`. */
  apiKey: string;
  /** Required. Absolute or same-origin path, e.g. `/api/ingest`. */
  endpoint: string;
  /** Flush once the queue holds this many events. Default 10. */
  batchSize?: number;
  /** Flush at least this often while events are queued, in ms. Default 5000. */
  flushIntervalMs?: number;
  /** Hard cap on queued events. Beyond it, events are dropped. Default 100. */
  maxQueueSize?: number;
  /** Maximum attempts per batch, including the first. Default 3. */
  maxRetries?: number;
  /** Base delay for retry backoff, in ms. Default 500. */
  retryBaseDelayMs?: number;
  /** Session sampling rate, 0..1. Default 1. */
  sampleRate?: number;
  /** Capture `error` / `unhandledrejection` automatically. Default false. */
  captureErrors?: boolean;
  /** Free-form context echoed on every batch. */
  appVersion?: string;
  environment?: string;
}

/**
 * Counters the demo's status bar renders. Optional: fill in whatever helps
 * you see what the SDK is doing, and leave the rest at zero.
 */
export interface TelemetryDiagnostics {
  initialized: boolean;
  sessionId: string | null;
  /** Whether this session was kept by sampling. */
  sampled: boolean;
  /** Events waiting to be sent. */
  queued: number;
  /** Events in the request currently in flight. */
  inFlight: number;
  /** Events the server accepted. */
  sent: number;
  /** Events given up on: queue overflow, sampling, or an unrecoverable response. */
  dropped: number;
  /** Retry attempts made across all batches. */
  retries: number;
  lastError: string | null;
}
