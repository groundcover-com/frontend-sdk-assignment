import clsx from 'clsx';

import type { TelemetryDiagnostics } from '../sdk/types';

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs/5 font-medium text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd
        className={clsx(
          'mt-0.5 font-mono text-sm/6 font-semibold tabular-nums',
          tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'warn' && 'text-amber-600 dark:text-amber-400',
          tone === 'bad' && 'text-red-600 dark:text-red-400',
          tone === 'default' && 'text-gray-900 dark:text-white',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Renders `getDiagnostics()`. Everything here stays at zero until the SDK reports it. */
export function StatusBar({
  diagnostics,
}: {
  diagnostics: TelemetryDiagnostics;
}) {
  const { initialized, sessionId, sampled } = diagnostics;

  return (
    <div className="bg-white shadow-xs outline outline-gray-900/5 sm:rounded-xl dark:bg-gray-800/50 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-900/5 px-4 py-3 sm:px-6 dark:border-white/10">
        <span
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset',
            initialized
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20'
              : 'bg-gray-50 text-gray-600 ring-gray-500/20 dark:bg-white/5 dark:text-gray-400 dark:ring-white/10',
          )}
        >
          <span
            className={clsx(
              'size-1.5 rounded-full',
              initialized ? 'bg-emerald-500' : 'bg-gray-400',
            )}
          />
          {initialized ? 'SDK initialized' : 'SDK not initialized'}
        </span>
        {initialized && !sampled ? (
          <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-600/20 ring-inset dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20">
            session not sampled
          </span>
        ) : null}
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          session: {sessionId ?? '—'}
        </span>
        {diagnostics.lastError ? (
          <span className="ml-auto truncate font-mono text-xs text-red-600 dark:text-red-400">
            last error: {diagnostics.lastError}
          </span>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 divide-x divide-y divide-gray-900/5 sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0 dark:divide-white/10">
        <Stat label="Queued" value={diagnostics.queued} />
        <Stat label="In flight" value={diagnostics.inFlight} />
        <Stat
          label="Sent"
          value={diagnostics.sent}
          tone={diagnostics.sent > 0 ? 'good' : 'default'}
        />
        <Stat
          label="Dropped"
          value={diagnostics.dropped}
          tone={diagnostics.dropped > 0 ? 'bad' : 'default'}
        />
        <Stat
          label="Retries"
          value={diagnostics.retries}
          tone={diagnostics.retries > 0 ? 'warn' : 'default'}
        />
      </dl>
    </div>
  );
}
