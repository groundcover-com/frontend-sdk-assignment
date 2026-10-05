import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Plugin, ViteDevServer } from 'vite';

/**
 * A fake telemetry ingest API, served by the Vite dev server on the same origin
 * as the app. It exists so the SDK you build has somewhere real to POST to, and
 * so the demo page can show you exactly what left the browser.
 *
 * Routes
 *   POST /api/ingest    the ingest endpoint the SDK sends batches to
 *   GET  /api/inbox     everything the server has received (used by the inspector)
 *   POST /api/controls  failure injection: { failureRate, failStatus, latencyMs }
 *   POST /api/reset     clear the inbox
 *
 * Nothing in here needs to change to complete the assignment.
 */

export const INGEST_PATH = '/api/ingest';
export const API_KEY = 'gc_demo_key';

const MAX_INBOX_ENTRIES = 200;

export type FailStatus = 429 | 500 | 503;

export interface IngestControls {
  /** Fraction of otherwise-valid batches to reject, 0..1. */
  failureRate: number;
  /** Status used when a batch is rejected by failure injection. */
  failStatus: FailStatus;
  /** Artificial delay before responding, in milliseconds. */
  latencyMs: number;
}

export interface InboxEntry {
  seq: number;
  receivedAt: number;
  status: number;
  ok: boolean;
  /** Why the batch was rejected, when it was. */
  error?: string;
  /** True when the failure was injected rather than caused by the payload. */
  injected?: boolean;
  contentType: string;
  /** Raw request body size in bytes, as the server received it. */
  bytes: number;
  attempt?: number;
  sessionId?: string;
  eventCount: number;
  acceptedCount: number;
  /** Event ids in this batch the server had already accepted before. */
  duplicateIds: string[];
  /** The parsed batch, or the raw text when it could not be parsed. */
  body: unknown;
}

interface IngestState {
  controls: IngestControls;
  entries: InboxEntry[];
  seenEventIds: Set<string>;
  seq: number;
  acceptedEvents: number;
  duplicateEvents: number;
  failedBatches: number;
}

const state: IngestState = {
  controls: { failureRate: 0, failStatus: 500, latencyMs: 0 },
  entries: [],
  seenEventIds: new Set(),
  seq: 0,
  acceptedEvents: 0,
  duplicateEvents: 0,
  failedBatches: 0,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      raw += chunk;
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  if (status === 429) res.setHeader('Retry-After', '1');
  res.end(body);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const EVENT_TYPES = new Set(['custom', 'page_view', 'error']);

/**
 * The wire contract. Keep the SDK's payload inside these rules and the server
 * accepts it; step outside and it answers 400 with the reason, which the
 * inspector shows you verbatim.
 */
function validateBatch(
  body: unknown,
): { error: string } | { events: Record<string, unknown>[] } {
  if (!isRecord(body)) return { error: 'batch must be a JSON object' };
  if (typeof body.apiKey !== 'string' || body.apiKey.length === 0) {
    return { error: 'batch.apiKey must be a non-empty string' };
  }
  if (
    !isRecord(body.session) ||
    typeof body.session.id !== 'string' ||
    !body.session.id
  ) {
    return { error: 'batch.session.id must be a non-empty string' };
  }
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return { error: 'batch.events must be a non-empty array' };
  }
  const events: Record<string, unknown>[] = [];
  for (const [index, event] of body.events.entries()) {
    if (!isRecord(event))
      return { error: `batch.events[${index}] must be an object` };
    if (typeof event.id !== 'string' || !event.id) {
      return { error: `batch.events[${index}].id must be a non-empty string` };
    }
    if (typeof event.name !== 'string' || !event.name) {
      return {
        error: `batch.events[${index}].name must be a non-empty string`,
      };
    }
    if (
      typeof event.timestamp !== 'number' ||
      !Number.isFinite(event.timestamp)
    ) {
      return {
        error: `batch.events[${index}].timestamp must be a number (epoch ms)`,
      };
    }
    if (typeof event.type !== 'string' || !EVENT_TYPES.has(event.type)) {
      return {
        error: `batch.events[${index}].type must be one of custom, page_view, error`,
      };
    }
    if (event.attributes !== undefined && !isRecord(event.attributes)) {
      return {
        error: `batch.events[${index}].attributes must be an object when present`,
      };
    }
    events.push(event);
  }
  return { events };
}

function record(entry: Omit<InboxEntry, 'seq' | 'receivedAt'>): InboxEntry {
  state.seq += 1;
  const full: InboxEntry = { ...entry, seq: state.seq, receivedAt: Date.now() };
  state.entries.push(full);
  if (state.entries.length > MAX_INBOX_ENTRIES) {
    state.entries.splice(0, state.entries.length - MAX_INBOX_ENTRIES);
  }
  if (!full.ok) state.failedBatches += 1;
  return full;
}

async function handleIngest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const contentType = req.headers['content-type'] ?? '(none)';
  const raw = await readBody(req);
  const bytes = Buffer.byteLength(raw, 'utf8');

  if (state.controls.latencyMs > 0) await sleep(state.controls.latencyMs);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    record({
      status: 400,
      ok: false,
      error: 'body is not valid JSON',
      contentType,
      bytes,
      eventCount: 0,
      acceptedCount: 0,
      duplicateIds: [],
      body: raw.slice(0, 2000),
    });
    sendJson(res, 400, { ok: false, error: 'body is not valid JSON' });
    return;
  }

  const validated = validateBatch(parsed);
  const attempt =
    isRecord(parsed) && typeof parsed.attempt === 'number'
      ? parsed.attempt
      : undefined;
  const sessionId =
    isRecord(parsed) &&
    isRecord(parsed.session) &&
    typeof parsed.session.id === 'string'
      ? parsed.session.id
      : undefined;

  if ('error' in validated) {
    record({
      status: 400,
      ok: false,
      error: validated.error,
      contentType,
      bytes,
      attempt,
      sessionId,
      eventCount: Array.isArray((parsed as Record<string, unknown>)?.events)
        ? ((parsed as Record<string, unknown>).events as unknown[]).length
        : 0,
      acceptedCount: 0,
      duplicateIds: [],
      body: parsed,
    });
    sendJson(res, 400, { ok: false, error: validated.error });
    return;
  }

  const { events } = validated;
  const apiKey = (parsed as Record<string, unknown>).apiKey;

  if (apiKey !== API_KEY) {
    const error = `unknown api key (expected ${API_KEY})`;
    record({
      status: 401,
      ok: false,
      error,
      contentType,
      bytes,
      attempt,
      sessionId,
      eventCount: events.length,
      acceptedCount: 0,
      duplicateIds: [],
      body: parsed,
    });
    sendJson(res, 401, { ok: false, error });
    return;
  }

  if (
    state.controls.failureRate > 0 &&
    Math.random() < state.controls.failureRate
  ) {
    const status = state.controls.failStatus;
    record({
      status,
      ok: false,
      error: `injected failure (${status})`,
      injected: true,
      contentType,
      bytes,
      attempt,
      sessionId,
      eventCount: events.length,
      acceptedCount: 0,
      duplicateIds: [],
      body: parsed,
    });
    sendJson(res, status, {
      ok: false,
      error: 'the ingest pipeline is having a bad day',
    });
    return;
  }

  const duplicateIds: string[] = [];
  for (const event of events) {
    const id = event.id as string;
    if (state.seenEventIds.has(id)) duplicateIds.push(id);
    else state.seenEventIds.add(id);
  }
  const acceptedCount = events.length - duplicateIds.length;
  state.acceptedEvents += acceptedCount;
  state.duplicateEvents += duplicateIds.length;

  record({
    status: 202,
    ok: true,
    contentType,
    bytes,
    attempt,
    sessionId,
    eventCount: events.length,
    acceptedCount,
    duplicateIds,
    body: parsed,
  });
  sendJson(res, 202, {
    ok: true,
    accepted: acceptedCount,
    duplicates: duplicateIds.length,
  });
}

async function handleControls(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const raw = await readBody(req);
  let patch: unknown;
  try {
    patch = raw ? JSON.parse(raw) : {};
  } catch {
    sendJson(res, 400, { ok: false, error: 'body is not valid JSON' });
    return;
  }
  if (isRecord(patch)) {
    if (typeof patch.failureRate === 'number') {
      state.controls.failureRate = Math.min(1, Math.max(0, patch.failureRate));
    }
    if (
      patch.failStatus === 429 ||
      patch.failStatus === 500 ||
      patch.failStatus === 503
    ) {
      state.controls.failStatus = patch.failStatus;
    }
    if (typeof patch.latencyMs === 'number') {
      state.controls.latencyMs = Math.min(10_000, Math.max(0, patch.latencyMs));
    }
  }
  sendJson(res, 200, { ok: true, controls: state.controls });
}

function handleInbox(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const after = Number(url.searchParams.get('after') ?? '0');
  const entries = state.entries.filter(
    (entry) => entry.seq > (Number.isFinite(after) ? after : 0),
  );
  sendJson(res, 200, {
    ok: true,
    controls: state.controls,
    entries,
    stats: {
      batches: state.seq,
      acceptedEvents: state.acceptedEvents,
      duplicateEvents: state.duplicateEvents,
      failedBatches: state.failedBatches,
    },
  });
}

function handleReset(_req: IncomingMessage, res: ServerResponse): void {
  state.entries = [];
  state.seenEventIds = new Set();
  state.seq = 0;
  state.acceptedEvents = 0;
  state.duplicateEvents = 0;
  state.failedBatches = 0;
  sendJson(res, 200, { ok: true });
}

function attach(
  server: ViteDevServer | { middlewares: ViteDevServer['middlewares'] },
): void {
  server.middlewares.use(async (req, res, next) => {
    const path = (req.url ?? '').split('?')[0];
    try {
      if (path === INGEST_PATH && req.method === 'POST')
        return await handleIngest(req, res);
      if (path === '/api/inbox' && req.method === 'GET')
        return handleInbox(req, res);
      if (path === '/api/controls' && req.method === 'POST')
        return await handleControls(req, res);
      if (path === '/api/reset' && req.method === 'POST')
        return handleReset(req, res);
    } catch (error) {
      sendJson(res, 500, { ok: false, error: String(error) });
      return;
    }
    next();
  });
}

export function mockIngest(): Plugin {
  return {
    name: 'mock-ingest',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
