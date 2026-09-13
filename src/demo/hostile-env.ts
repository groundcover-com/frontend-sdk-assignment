/**
 * Simulated browser conditions for the playground.
 *
 * Real pages are hostile to an SDK in ways a healthy localhost never is:
 * storage that throws, a network that goes away mid-batch, a tab the browser
 * demotes to one timer wake-up a minute, a beacon quota that refuses the
 * payload. This module patches the relevant browser APIs so those conditions
 * can be switched on and off while the page is running.
 *
 * It is imported as the very first line of `src/main.tsx`, before the SDK
 * module is evaluated, so an SDK that captures `fetch` or `sendBeacon` at
 * module scope still sees the patched versions.
 *
 * Nothing here is part of the assignment; it is scaffolding around it.
 */

import { useSyncExternalStore } from 'react';
import { INGEST_PATH } from './constants';

export type HostileEnv = {
  brokenStorage: boolean;
  offline: boolean;
  backgroundTab: boolean;
  tinyBeaconQuota: boolean;
};

const ALL_OFF: HostileEnv = {
  brokenStorage: false,
  offline: false,
  backgroundTab: false,
  tinyBeaconQuota: false,
};

/** Per-tab, so two tabs can simulate different conditions. */
const PERSIST_KEY = 'gc-demo:hostile-env';

/** Chrome's intensive throttling: a hidden tab gets one wake-up per minute. */
const THROTTLED_WAKE_MS = 60_000;

/**
 * The real beacon quota is 64 KB per origin. 1 KB is small enough that a
 * default 10-event batch trips it, which is the point of the demo.
 */
const BEACON_LIMIT_BYTES = 1024;

// ---------------------------------------------------------------------------
// Originals, captured before anything below patches them.
// ---------------------------------------------------------------------------

const nativeSetTimeout = window.setTimeout.bind(window);
const nativeClearTimeout = window.clearTimeout.bind(window);
const nativeSetInterval = window.setInterval.bind(window);
const nativeClearInterval = window.clearInterval.bind(window);
const nativeRequestFrame = window.requestAnimationFrame.bind(window);
const nativeCancelFrame = window.cancelAnimationFrame.bind(window);
const nativeFetch = window.fetch.bind(window);
const nativeSendBeacon =
  typeof navigator.sendBeacon === 'function'
    ? navigator.sendBeacon.bind(navigator)
    : null;
const nativeXhrOpen = XMLHttpRequest.prototype.open;
const nativeXhrSend = XMLHttpRequest.prototype.send;

const storageProto = Storage.prototype;
const nativeStorage = {
  getItem: storageProto.getItem,
  setItem: storageProto.setItem,
  removeItem: storageProto.removeItem,
  clear: storageProto.clear,
  key: storageProto.key,
  length: Object.getOwnPropertyDescriptor(storageProto, 'length'),
};
const windowStorageDescriptors = {
  localStorage: Object.getOwnPropertyDescriptor(window, 'localStorage'),
  sessionStorage: Object.getOwnPropertyDescriptor(window, 'sessionStorage'),
};

function captureStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // Cookies blocked, sandboxed iframe, Safari private mode.
  }
}
const rawSessionStorage = captureStorage('session');

/**
 * The timer functions as the browser shipped them. The playground's own
 * polling uses these so the demo keeps updating while the simulated tab is
 * throttled — the SDK under test gets the throttled ones.
 */
export const demoTimers = {
  setTimeout: nativeSetTimeout,
  setInterval: nativeSetInterval,
  clearTimeout: nativeClearTimeout,
  clearInterval: nativeClearInterval,
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function readPersisted(): HostileEnv {
  if (!rawSessionStorage) return { ...ALL_OFF };
  try {
    const raw = nativeStorage.getItem.call(rawSessionStorage, PERSIST_KEY);
    if (!raw) return { ...ALL_OFF };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...ALL_OFF };
    const record = parsed as Record<string, unknown>;
    return {
      brokenStorage: record.brokenStorage === true,
      offline: record.offline === true,
      backgroundTab: record.backgroundTab === true,
      tinyBeaconQuota: record.tinyBeaconQuota === true,
    };
  } catch {
    return { ...ALL_OFF };
  }
}

function persist(next: HostileEnv): void {
  if (!rawSessionStorage) return;
  try {
    // Native methods on the captured object: this has to keep working while
    // storage is "broken", or a reload would lose the toggles that broke it.
    nativeStorage.setItem.call(
      rawSessionStorage,
      PERSIST_KEY,
      JSON.stringify(next),
    );
  } catch {
    // Storage really is unavailable; the toggles just will not survive a reload.
  }
}

let state: HostileEnv = readPersisted();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

// ---------------------------------------------------------------------------
// 1. Storage that throws
// ---------------------------------------------------------------------------

function storageDenied(property: string): DOMException {
  return new DOMException(
    `Failed to read the '${property}' property from 'Window': Access is denied for this document.`,
    'SecurityError',
  );
}

let storageBroken = false;

function installBrokenStorage(): void {
  if (storageBroken) return;
  storageBroken = true;

  storageProto.getItem = () => {
    throw storageDenied('localStorage');
  };
  storageProto.setItem = () => {
    throw storageDenied('localStorage');
  };
  storageProto.removeItem = () => {
    throw storageDenied('localStorage');
  };
  storageProto.clear = () => {
    throw storageDenied('localStorage');
  };
  storageProto.key = () => {
    throw storageDenied('localStorage');
  };

  try {
    Object.defineProperty(storageProto, 'length', {
      configurable: true,
      get() {
        throw storageDenied('localStorage');
      },
    });
  } catch {
    // Length stays readable; every method still throws.
  }

  // A page with cookies blocked throws on the property access itself, before
  // any method is reached. Only possible where the descriptor is configurable.
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    const descriptor = windowStorageDescriptors[name];
    if (!descriptor?.configurable) continue;
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: descriptor.enumerable ?? true,
        get() {
          throw storageDenied(name);
        },
      });
    } catch {
      // Fall back to the prototype patch above.
    }
  }
}

function restoreStorage(): void {
  if (!storageBroken) return;
  storageBroken = false;

  storageProto.getItem = nativeStorage.getItem;
  storageProto.setItem = nativeStorage.setItem;
  storageProto.removeItem = nativeStorage.removeItem;
  storageProto.clear = nativeStorage.clear;
  storageProto.key = nativeStorage.key;

  if (nativeStorage.length) {
    try {
      Object.defineProperty(storageProto, 'length', nativeStorage.length);
    } catch {
      // Nothing else to try.
    }
  }

  for (const name of ['localStorage', 'sessionStorage'] as const) {
    const descriptor = windowStorageDescriptors[name];
    if (!descriptor?.configurable) continue;
    try {
      Object.defineProperty(window, name, descriptor);
    } catch {
      // Nothing else to try.
    }
  }
}

/** Whether a storage read currently succeeds. The panel renders this. */
export function storageWorks(): boolean {
  try {
    window.localStorage.getItem(PERSIST_KEY);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 2. Offline
// ---------------------------------------------------------------------------

const nativeOnLine = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  'onLine',
)?.get;

function currentOnLine(): boolean {
  if (state.offline) return false;
  try {
    return nativeOnLine ? Boolean(nativeOnLine.call(navigator)) : true;
  } catch {
    return true;
  }
}

try {
  Object.defineProperty(Navigator.prototype, 'onLine', {
    configurable: true,
    get: currentOnLine,
  });
} catch {
  try {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: currentOnLine,
    });
  } catch {
    // navigator.onLine stays honest; the transports are still cut off below.
  }
}

function pathnameOf(input: RequestInfo | URL): string | null {
  try {
    if (typeof input === 'string')
      return new URL(input, location.href).pathname;
    if (input instanceof URL) return input.pathname;
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return new URL(input.url, location.href).pathname;
    }
  } catch {
    // Not a URL we can resolve; treat it as someone else's request.
  }
  return null;
}

/** A network error, settled on a later task the way a real one is. */
function networkFailure(): Promise<never> {
  return new Promise((_resolve, reject) => {
    nativeSetTimeout(() => reject(new TypeError('Failed to fetch')), 0);
  });
}

// ---------------------------------------------------------------------------
// 4. Beacon quota
// ---------------------------------------------------------------------------

/** Byte length of a body, or null when it cannot be measured cheaply. */
function byteLengthOf(body: unknown): number | null {
  try {
    if (body === null || body === undefined) return 0;
    if (typeof body === 'string') return new Blob([body]).size;
    if (body instanceof Blob) return body.size;
    if (body instanceof ArrayBuffer) return body.byteLength;
    if (ArrayBuffer.isView(body)) return body.byteLength;
    if (body instanceof URLSearchParams)
      return new Blob([body.toString()]).size;
  } catch {
    // Fall through: unmeasurable.
  }
  return null; // FormData, ReadableStream — do not guess.
}

async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const path = pathnameOf(input);

  if (state.offline && path === INGEST_PATH) return networkFailure();

  if (state.tinyBeaconQuota) {
    const isRequest =
      typeof Request !== 'undefined' && input instanceof Request;
    const keepalive = init?.keepalive ?? (isRequest ? input.keepalive : false);
    if (keepalive) {
      let size = init?.body == null ? null : byteLengthOf(init.body);
      if (size === null && isRequest) {
        try {
          size = (await input.clone().arrayBuffer()).byteLength;
        } catch {
          size = null;
        }
      }
      // Chrome rejects an oversized keepalive request with a plain TypeError.
      if (size !== null && size > BEACON_LIMIT_BYTES) return networkFailure();
    }
  }

  return nativeFetch(input, init);
}

window.fetch = patchedFetch;

function patchedSendBeacon(url: string | URL, data?: BodyInit | null): boolean {
  if (pathnameOf(url) === INGEST_PATH) {
    if (state.tinyBeaconQuota) {
      const size = byteLengthOf(data);
      if (size !== null && size > BEACON_LIMIT_BYTES) return false;
    }
    // Real browser behavior, and the reason beacons are hard to trust:
    // `true` only means the request was queued, never that it was delivered.
    if (state.offline) return true;
  }
  if (!nativeSendBeacon) return false;
  return nativeSendBeacon(url, data);
}

if (nativeSendBeacon) {
  try {
    navigator.sendBeacon = patchedSendBeacon;
  } catch {
    try {
      Object.defineProperty(Navigator.prototype, 'sendBeacon', {
        configurable: true,
        writable: true,
        value: patchedSendBeacon,
      });
    } catch {
      // sendBeacon stays real; fetch is still cut off.
    }
  }
}

const xhrPaths = new WeakMap<XMLHttpRequest, string>();

function patchedXhrOpen(
  this: XMLHttpRequest,
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string | null,
  password?: string | null,
): void {
  const path = pathnameOf(url);
  if (path) xhrPaths.set(this, path);
  // `async` defaults to true, exactly as the two-argument form does.
  nativeXhrOpen.call(
    this,
    method,
    url,
    async ?? true,
    username ?? null,
    password ?? null,
  );
}

function patchedXhrSend(
  this: XMLHttpRequest,
  body?: Document | XMLHttpRequestBodyInit | null,
): void {
  if (state.offline && xhrPaths.get(this) === INGEST_PATH) {
    nativeSetTimeout(() => {
      try {
        this.dispatchEvent(new ProgressEvent('error'));
        this.dispatchEvent(new ProgressEvent('loadend'));
      } catch {
        // Nothing useful to do from here.
      }
    }, 0);
    return;
  }
  nativeXhrSend.call(this, body);
}

XMLHttpRequest.prototype.open = patchedXhrOpen;
XMLHttpRequest.prototype.send = patchedXhrSend;

// ---------------------------------------------------------------------------
// 3. Background tab: hidden document, throttled timers, held frames
// ---------------------------------------------------------------------------

const nativeVisibilityState = Object.getOwnPropertyDescriptor(
  Document.prototype,
  'visibilityState',
)?.get;
const nativeHidden = Object.getOwnPropertyDescriptor(
  Document.prototype,
  'hidden',
)?.get;

try {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get(): DocumentVisibilityState {
      if (state.backgroundTab) return 'hidden';
      if (!nativeVisibilityState) return 'visible';
      return nativeVisibilityState.call(document) as DocumentVisibilityState;
    },
  });
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get(): boolean {
      if (state.backgroundTab) return true;
      if (!nativeHidden) return false;
      return Boolean(nativeHidden.call(document));
    },
  });
} catch {
  // The document keeps reporting the real visibility; timers still throttle.
}

type TimerKind = 'timeout' | 'interval';

interface TimerRecord {
  id: number;
  kind: TimerKind;
  handler: (...args: unknown[]) => void;
  args: unknown[];
  delay: number;
  /** When the callback should run if the tab were visible. */
  dueAt: number;
  nativeId: number;
}

const wrappedTimers = new Map<number, TimerRecord>();
/** Our own id space, kept clear of the ids the browser hands out. */
let nextTimerId = 1_000_000_001;

function effectiveDelay(record: TimerRecord, now: number): number {
  const remaining = Math.max(0, record.dueAt - now);
  return state.backgroundTab
    ? Math.max(remaining, THROTTLED_WAKE_MS)
    : remaining;
}

function scheduleTimer(record: TimerRecord): void {
  record.nativeId = nativeSetTimeout(
    () => fireTimer(record),
    effectiveDelay(record, Date.now()),
  );
}

function fireTimer(record: TimerRecord): void {
  if (record.kind === 'interval') {
    record.dueAt = Date.now() + record.delay;
    scheduleTimer(record);
  } else {
    wrappedTimers.delete(record.id);
  }
  // Deliberately not wrapped in try/catch: a callback that throws must reach
  // window.onerror exactly as it would on a native timer.
  record.handler(...record.args);
}

function createTimer(
  kind: TimerKind,
  handler: TimerHandler,
  timeout: number | undefined,
  args: unknown[],
): number {
  if (typeof handler !== 'function') {
    // String handlers are eval'd by the browser; leave them entirely alone.
    return kind === 'timeout'
      ? nativeSetTimeout(handler, timeout)
      : nativeSetInterval(handler, timeout);
  }
  const delay =
    typeof timeout === 'number' && Number.isFinite(timeout)
      ? Math.max(0, timeout)
      : 0;
  const id = nextTimerId++;
  const record: TimerRecord = {
    id,
    kind,
    handler: handler as (...args: unknown[]) => void,
    args,
    delay,
    dueAt: Date.now() + delay,
    nativeId: 0,
  };
  wrappedTimers.set(id, record);
  scheduleTimer(record);
  return id;
}

function clearWrappedTimer(
  id: number | undefined,
  fallback: (id?: number) => void,
): void {
  if (typeof id !== 'number') return;
  const record = wrappedTimers.get(id);
  if (record) {
    wrappedTimers.delete(id);
    nativeClearTimeout(record.nativeId);
    return;
  }
  fallback(id);
}

function patchedSetTimeout(
  handler: TimerHandler,
  timeout?: number,
  ...args: unknown[]
): number {
  return createTimer('timeout', handler, timeout, args);
}

function patchedSetInterval(
  handler: TimerHandler,
  timeout?: number,
  ...args: unknown[]
): number {
  // Intervals are chained timeouts so each wake-up can be re-clamped.
  return createTimer('interval', handler, timeout, args);
}

function patchedClearTimeout(id?: number): void {
  clearWrappedTimer(id, nativeClearTimeout);
}

function patchedClearInterval(id?: number): void {
  clearWrappedTimer(id, nativeClearInterval);
}

// Installed permanently, at boot: throttling does not care whether a timer was
// created before or after the tab was hidden.
window.setTimeout = patchedSetTimeout as typeof window.setTimeout;
window.setInterval = patchedSetInterval as typeof window.setInterval;
window.clearTimeout = patchedClearTimeout;
window.clearInterval = patchedClearInterval;

function rescheduleTimers(): void {
  const now = Date.now();
  for (const record of wrappedTimers.values()) {
    nativeClearTimeout(record.nativeId);
    record.nativeId = nativeSetTimeout(
      () => fireTimer(record),
      effectiveDelay(record, now),
    );
  }
}

const heldFrames = new Map<number, FrameRequestCallback>();
let nextFrameId = 2_000_000_001;

function patchedRequestFrame(callback: FrameRequestCallback): number {
  if (!state.backgroundTab) return nativeRequestFrame(callback);
  // A hidden tab paints nothing, so the callback waits for the tab to return.
  const id = nextFrameId++;
  heldFrames.set(id, callback);
  return id;
}

function patchedCancelFrame(id: number): void {
  if (heldFrames.delete(id)) return;
  nativeCancelFrame(id);
}

function releaseHeldFrames(): void {
  const pending = [...heldFrames.values()];
  heldFrames.clear();
  for (const callback of pending) nativeRequestFrame(callback);
}

window.requestAnimationFrame = patchedRequestFrame;
window.cancelAnimationFrame = patchedCancelFrame;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function setHostileEnv(patch: Partial<HostileEnv>): void {
  const previous = state;
  const next: HostileEnv = { ...previous, ...patch };
  if (
    next.brokenStorage === previous.brokenStorage &&
    next.offline === previous.offline &&
    next.backgroundTab === previous.backgroundTab &&
    next.tinyBeaconQuota === previous.tinyBeaconQuota
  ) {
    return;
  }

  state = next;
  persist(next);

  if (next.brokenStorage !== previous.brokenStorage) {
    if (next.brokenStorage) installBrokenStorage();
    else restoreStorage();
  }

  if (next.offline !== previous.offline) {
    window.dispatchEvent(new Event(next.offline ? 'offline' : 'online'));
  }

  if (next.backgroundTab !== previous.backgroundTab) {
    rescheduleTimers();
    if (!next.backgroundTab) releaseHeldFrames();
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  }

  emit();
}

export function resetHostileEnv(): void {
  setHostileEnv(ALL_OFF);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): HostileEnv {
  return state;
}

export function useHostileEnv(): HostileEnv {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// Re-apply what survived the reload. Only storage needs installing; the other
// patches are permanent and read `state` as they run.
if (state.brokenStorage) installBrokenStorage();
