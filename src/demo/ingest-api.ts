/** Client for the mock ingest server's inspection endpoints. */

export type FailStatus = 429 | 500 | 503;

export interface IngestControls {
  failureRate: number;
  failStatus: FailStatus;
  latencyMs: number;
}

export interface InboxEntry {
  seq: number;
  receivedAt: number;
  status: number;
  ok: boolean;
  error?: string;
  injected?: boolean;
  contentType: string;
  attempt?: number;
  sessionId?: string;
  eventCount: number;
  acceptedCount: number;
  duplicateIds: string[];
  body: unknown;
}

export interface InboxStats {
  batches: number;
  acceptedEvents: number;
  duplicateEvents: number;
  failedBatches: number;
}

export interface InboxResponse {
  ok: true;
  controls: IngestControls;
  entries: InboxEntry[];
  stats: InboxStats;
}

export async function fetchInbox(): Promise<InboxResponse> {
  const response = await fetch('/api/inbox');
  if (!response.ok) throw new Error(`inbox request failed: ${response.status}`);
  return (await response.json()) as InboxResponse;
}

export async function updateControls(
  patch: Partial<IngestControls>,
): Promise<void> {
  await fetch('/api/controls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function resetInbox(): Promise<void> {
  await fetch('/api/reset', { method: 'POST' });
}
