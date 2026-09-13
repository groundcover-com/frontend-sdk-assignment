import { useSyncExternalStore } from 'react';

/**
 * The host application's own safety net.
 *
 * Every call the demo makes into the SDK goes through `callSdk()`. If the SDK
 * throws, or hands back a promise it never settles cleanly, the store records
 * the failure and renders a crash screen instead of its content — which is
 * exactly what a customer's app would do if a telemetry SDK misbehaved inside
 * it. An SDK that needs this net is already broken.
 */

export type HostFailureSource =
  | 'sync-throw'
  | 'rejected-promise'
  | 'uncaught-error'
  | 'unhandled-rejection';

export interface HostFailure {
  at: number;
  source: HostFailureSource;
  /** Reads like the call that broke, e.g. `track('add_to_cart')`. */
  call: string;
  message: string;
  stack?: string;
}

/**
 * Dev-server paths for the SDK's own modules. A global error is blamed on the
 * SDK only when its stack points in here, so the store's deliberate "Uncaught
 * error" / "Unhandled rejection" buttons — which throw from `src/demo` — stay
 * the host's own problem and remain available as auto-capture test material.
 */
const SDK_SOURCE_MARKER = '/src/sdk/';

let failures: HostFailure[] = [];
let crashCount = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function record(failure: HostFailure) {
  failures = [...failures, failure];
  crashCount += 1;
  emit();
}

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message || String(error), stack: error.stack };
  }
  return { message: String(error) };
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | null)?.then === 'function';
}

/**
 * Run one SDK call on the host's behalf. A synchronous throw is recorded and
 * swallowed — the store has already been broken once, no reason to let the
 * exception tear down React as well. A returned promise gets a rejection
 * handler attached, so a rejected one is recorded rather than surfacing as an
 * unhandled rejection somewhere else entirely.
 */
export function callSdk<T>(label: string, fn: () => T): T | undefined {
  try {
    const value = fn();
    if (isThenable(value)) {
      void Promise.resolve(value).catch((error: unknown) => {
        record({
          at: Date.now(),
          source: 'rejected-promise',
          call: label,
          ...describe(error),
        });
      });
    }
    return value;
  } catch (error) {
    record({
      at: Date.now(),
      source: 'sync-throw',
      call: label,
      ...describe(error),
    });
    return undefined;
  }
}

function blamesSdk(...candidates: (string | undefined)[]): boolean {
  return candidates.some(
    (candidate) => candidate?.includes(SDK_SOURCE_MARKER) ?? false,
  );
}

function onWindowError(event: ErrorEvent) {
  const { message, stack } = describe(event.error ?? event.message);
  if (!blamesSdk(stack, event.filename)) return;
  record({
    at: Date.now(),
    source: 'uncaught-error',
    call: "window 'error' event",
    message,
    stack,
  });
}

function onWindowRejection(event: PromiseRejectionEvent) {
  const { message, stack } = describe(event.reason);
  if (!blamesSdk(stack)) return;
  record({
    at: Date.now(),
    source: 'unhandled-rejection',
    call: "window 'unhandledrejection' event",
    message,
    stack,
  });
}

interface HostHealthWindow extends Window {
  __acmeHostHealthInstalled?: boolean;
}

/** Installed once per page, and re-installed cleanly across an HMR update. */
function installGlobalListeners() {
  if (typeof window === 'undefined') return;
  const host = window as HostHealthWindow;
  if (host.__acmeHostHealthInstalled) return;
  host.__acmeHostHealthInstalled = true;
  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onWindowRejection);
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onWindowRejection);
      host.__acmeHostHealthInstalled = false;
    });
  }
}

installGlobalListeners();

/** Failures still on screen. Non-empty means the store is showing a crash. */
export function useHostFailures(): HostFailure[] {
  return useSyncExternalStore(subscribe, () => failures);
}

/** Every failure since the page loaded, including the ones already cleared. */
export function useHostCrashCount(): number {
  return useSyncExternalStore(subscribe, () => crashCount);
}

/** Dismiss the crash screen. The session counter deliberately keeps counting. */
export function clearHostFailures(): void {
  if (failures.length === 0) return;
  failures = [];
  emit();
}
