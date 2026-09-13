import { Button } from '../components/button';
import type { HostFailure } from './host-health';

const SOURCE_LABEL: Record<HostFailure['source'], string> = {
  'sync-throw': 'threw synchronously',
  'rejected-promise': 'returned a rejected promise',
  'uncaught-error': 'uncaught error from SDK code',
  'unhandled-rejection': 'unhandled rejection from SDK code',
};

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour12: false });
}

/**
 * What the host app looks like once the SDK has broken it. A customer would
 * see their own white screen here; the store settles for an honest red one.
 */
export function StoreCrash({
  failures,
  crashCount,
  onReload,
}: {
  failures: HostFailure[];
  crashCount: number;
  onReload: () => void;
}) {
  return (
    <div className="rounded-lg bg-red-50 p-4 ring-1 ring-red-600/20 ring-inset dark:bg-red-500/10 dark:ring-red-500/20">
      <h3 className="text-sm/6 font-semibold text-red-800 dark:text-red-300">
        Acme Store crashed
      </h3>
      <p className="mt-1 text-sm/6 text-red-700 dark:text-red-300/80">
        A call into the SDK failed and took the host application with it. The
        store cannot render its content until it is reloaded.
      </p>

      <ul className="mt-4 space-y-3">
        {failures.map((failure) => (
          <li
            key={`${failure.at}-${failure.call}`}
            className="rounded-md bg-white/70 p-3 ring-1 ring-red-600/10 ring-inset dark:bg-gray-900/40 dark:ring-red-500/20"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <code className="font-mono text-xs font-semibold text-red-700 dark:text-red-300">
                {failure.call}
              </code>
              <span className="text-xs text-red-700/80 dark:text-red-300/70">
                {SOURCE_LABEL[failure.source]}
              </span>
              <span className="ml-auto font-mono text-xs text-gray-500 dark:text-gray-400">
                {formatTime(failure.at)}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs/5 text-gray-800 dark:text-gray-200">
              {failure.message}
            </p>
            {failure.stack ? (
              <details className="mt-2">
                <summary className="cursor-default text-xs text-gray-500 dark:text-gray-400">
                  stack
                </summary>
                <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-gray-50 p-2 font-mono text-xs/5 text-gray-700 ring-1 ring-gray-900/5 ring-inset dark:bg-gray-900/60 dark:text-gray-300 dark:ring-white/10">
                  {failure.stack}
                </pre>
              </details>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-red-700/80 dark:text-red-300/70">
          crashes this session: {crashCount}
        </span>
        <Button color="red" onClick={onReload}>
          Reload store
        </Button>
      </div>
    </div>
  );
}
