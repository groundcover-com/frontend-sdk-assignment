/**
 * Values the demo page and the mock ingest server agree on.
 * The server half lives in `mock-ingest/plugin.ts`.
 */
export const INGEST_PATH = '/api/ingest';

/** The only key the mock server accepts. Anything else comes back as 401. */
export const DEMO_API_KEY = 'gc_demo_key';
