import { CatalogControlsPanel } from './demo/catalog-controls';
import { EnvironmentPanel } from './demo/environment-panel';
import { InboxPanel } from './demo/inbox-panel';
import { SdkConfigPanel } from './demo/sdk-config-panel';
import { ServerControls } from './demo/server-controls';
import { StatusBar } from './demo/status-bar';
import { StorePanel } from './demo/store-panel';
import { useDiagnostics } from './demo/use-diagnostics';
import { useInbox } from './demo/use-inbox';

function App() {
  const diagnostics = useDiagnostics();
  const { inbox, refresh } = useInbox();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-2xl/8 font-semibold text-gray-900 dark:text-white">
            Browser telemetry SDK
          </h1>
          <p className="mt-1 max-w-3xl text-sm/6 text-gray-500 dark:text-gray-400">
            The page on the left is the host application; it only ever calls the
            SDK's public API. The panels on the right show what actually reached
            the ingest server. Your job is everything in between.
          </p>
        </div>
        <a
          href="/plain.html"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-sm/6 font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Plain-JS consumer ↗
        </a>
      </header>

      <StatusBar diagnostics={diagnostics} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-8">
          <SdkConfigPanel initialized={diagnostics.initialized} />
          <StorePanel />
        </div>
        <div className="flex flex-col gap-8">
          <ServerControls
            controls={inbox?.controls ?? null}
            onChanged={() => void refresh()}
          />
          <CatalogControlsPanel />
          <EnvironmentPanel />
          <InboxPanel
            entries={inbox?.entries ?? []}
            stats={inbox?.stats ?? null}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
