/**
 * The same SDK, in a page with no framework.
 *
 * Nothing here imports React or anything from `src/demo` beyond the two
 * constants the mock server and the page agree on. Plain timers on purpose:
 * `src/demo/hostile-env` is never loaded here, so this page sees the browser
 * exactly as it is.
 */

import { DEMO_API_KEY, INGEST_PATH } from '../demo/constants';

import '../index.css';

/** Snapshotted before the SDK module is imported, for the leak check below. */
const globalsBeforeSdk = new Set(Object.getOwnPropertyNames(window));

const card =
  'bg-white shadow-xs outline outline-gray-900/5 sm:rounded-xl dark:bg-gray-800/50 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10 p-4 sm:p-6';
const button =
  'rounded-lg border border-zinc-950/10 px-3 py-1.5 text-sm/6 font-semibold text-zinc-950 hover:bg-zinc-950/2.5 dark:border-white/15 dark:text-white dark:hover:bg-white/5';
const pre =
  'mt-2 max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 font-mono text-xs/5 text-gray-800 ring-1 ring-gray-900/5 ring-inset dark:bg-gray-900/60 dark:text-gray-200 dark:ring-white/10';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app container');

root.innerHTML = `
  <div class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
    <header>
      <h1 class="text-2xl/8 font-semibold text-gray-900 dark:text-white">Plain-JS consumer</h1>
      <p class="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">
        The same SDK, mounted in a page with no framework — no React, no bundled
        UI library, no demo helpers. It is here to prove two things: the SDK
        works outside React, and it adds nothing to <code>window</code>.
      </p>
      <a class="mt-2 inline-block text-sm/6 font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400" href="/">&larr; Back to the playground</a>
    </header>

    <section class="${card}">
      <h2 class="text-sm/6 font-semibold text-gray-900 dark:text-white">Call the SDK</h2>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" data-action="init" class="${button}">Initialize</button>
        <button type="button" data-action="track" class="${button}">track('plain_click')</button>
        <button type="button" data-action="pageView" class="${button}">trackPageView()</button>
        <button type="button" data-action="flush" class="${button}">flush()</button>
        <button type="button" data-action="shutdown" class="${button}">shutdown()</button>
      </div>
      <pre id="log" class="${pre}">ready</pre>
    </section>

    <section class="${card}">
      <h2 class="text-sm/6 font-semibold text-gray-900 dark:text-white">getDiagnostics()</h2>
      <pre id="diagnostics" class="${pre}">loading…</pre>
    </section>

    <section class="${card}">
      <h2 class="text-sm/6 font-semibold text-gray-900 dark:text-white">Global leak check</h2>
      <p class="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">
        Own properties of <code>window</code> that were not there before the SDK
        module loaded.
      </p>
      <pre id="globals" class="${pre}">checking…</pre>
    </section>
  </div>
`;

function element(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node;
}

const logEl = element('log');
const diagnosticsEl = element('diagnostics');
const globalsEl = element('globals');

function log(line: string): void {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  logEl.textContent = `${time}  ${line}\n${logEl.textContent ?? ''}`.slice(
    0,
    4000,
  );
}

function renderGlobals(): void {
  const added = Object.getOwnPropertyNames(window).filter(
    (name) => !globalsBeforeSdk.has(name),
  );
  const react = 'React' in window ? 'present' : 'undefined';
  globalsEl.textContent = `Globals added to window: ${
    added.length === 0 ? 'none' : added.join(', ')
  }\nwindow.React: ${react}`;
}

async function main(): Promise<void> {
  const sdk = await import('../sdk');

  const actions: Record<string, () => unknown> = {
    init: () =>
      sdk.init({
        apiKey: DEMO_API_KEY,
        endpoint: INGEST_PATH,
        batchSize: 3,
      }),
    track: () => sdk.track('plain_click', { framework: 'none' }),
    pageView: () => sdk.trackPageView(),
    flush: () => sdk.flush(),
    shutdown: () => sdk.shutdown(),
  };

  for (const node of document.querySelectorAll<HTMLButtonElement>(
    'button[data-action]',
  )) {
    node.addEventListener('click', () => {
      const name = node.dataset.action ?? '';
      const run = actions[name];
      if (!run) return;
      try {
        const result = run();
        if (result instanceof Promise) {
          result.then(
            () => log(`${name}() resolved`),
            (error: unknown) => log(`${name}() rejected: ${String(error)}`),
          );
        } else {
          log(`${name}() returned`);
        }
      } catch (error) {
        log(`${name}() threw: ${String(error)}`);
      }
      renderGlobals();
    });
  }

  renderGlobals();
  setInterval(() => {
    try {
      diagnosticsEl.textContent = JSON.stringify(sdk.getDiagnostics(), null, 2);
    } catch (error) {
      diagnosticsEl.textContent = `getDiagnostics() threw: ${String(error)}`;
    }
  }, 500);
}

void main().catch((error: unknown) =>
  log(`loading the SDK failed: ${String(error)}`),
);
