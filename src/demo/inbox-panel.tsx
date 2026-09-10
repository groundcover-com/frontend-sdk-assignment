import clsx from 'clsx';
import type React from 'react';
import type { InboxEntry, InboxStats } from './ingest-api';
import { Panel } from './panel';

function statusTone(entry: InboxEntry) {
  if (entry.ok) {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20';
  }
  if (entry.status === 429) {
    return 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-400 dark:ring-orange-500/20';
  }
  if (entry.status >= 500) {
    return 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20';
  }
  return 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20';
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.toLocaleTimeString([], { hour12: false })}.${String(
    date.getMilliseconds(),
  ).padStart(3, '0')}`;
}

function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'warn';
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs ring-1 ring-inset',
        tone === 'warn'
          ? 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20'
          : 'bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-white/5 dark:text-gray-400 dark:ring-white/10',
      )}
    >
      {children}
    </span>
  );
}

/** Everything the ingest server has received, newest first. */
export function InboxPanel({
  entries,
  stats,
}: {
  entries: InboxEntry[];
  stats: InboxStats | null;
}) {
  const newestFirst = [...entries].reverse();

  return (
    <Panel
      title="Ingest inspector"
      description="Batches as the server saw them — status, attempt number and the exact payload."
      actions={
        stats ? (
          <div className="flex gap-2">
            <Badge>{stats.batches} batches</Badge>
            <Badge>{stats.acceptedEvents} events</Badge>
            {stats.duplicateEvents > 0 ? (
              <Badge tone="warn">{stats.duplicateEvents} duplicates</Badge>
            ) : null}
          </div>
        ) : null
      }
    >
      {newestFirst.length === 0 ? (
        <p className="py-6 text-center text-sm/6 text-gray-500 dark:text-gray-400">
          Nothing received yet. Initialize the SDK, then interact with the
          store.
        </p>
      ) : (
        <ul className="divide-y divide-gray-900/5 dark:divide-white/10">
          {newestFirst.map((entry) => (
            <li key={entry.seq}>
              <details className="group py-3">
                <summary className="flex cursor-default flex-wrap items-center gap-2 text-sm/6">
                  <span
                    className={clsx(
                      'inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold ring-1 ring-inset',
                      statusTone(entry),
                    )}
                  >
                    {entry.status}
                  </span>
                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(entry.receivedAt)}
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {entry.eventCount} event{entry.eventCount === 1 ? '' : 's'}
                  </span>
                  {entry.attempt && entry.attempt > 1 ? (
                    <Badge tone="warn">attempt {entry.attempt}</Badge>
                  ) : null}
                  {entry.duplicateIds.length > 0 ? (
                    <Badge tone="warn">
                      {entry.duplicateIds.length} duplicate id
                      {entry.duplicateIds.length === 1 ? '' : 's'}
                    </Badge>
                  ) : null}
                  {entry.error ? (
                    <span className="truncate text-xs text-red-600 dark:text-red-400">
                      {entry.error}
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs text-gray-400 group-open:hidden dark:text-gray-500">
                    show payload
                  </span>
                </summary>
                <div className="mt-2 space-y-2">
                  <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
                    content-type: {entry.contentType}
                    {entry.injected ? ' · failure injected by the server' : ''}
                  </p>
                  <pre className="max-h-80 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-xs/5 text-gray-800 ring-1 ring-gray-900/5 ring-inset dark:bg-gray-900/60 dark:text-gray-200 dark:ring-white/10">
                    {JSON.stringify(entry.body, null, 2)}
                  </pre>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
