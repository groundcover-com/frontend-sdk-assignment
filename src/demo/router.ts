import { useSyncExternalStore } from 'react';

/**
 * The smallest router that still behaves like a real one: our own navigations
 * go through `history.pushState`, the browser's back and forward buttons
 * arrive as `popstate`. No hash routing — the address bar shows a real path
 * and the document never reloads while you move around the store.
 *
 * Nothing outside the store is intercepted: links elsewhere on the page keep
 * their normal behaviour.
 */

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

/** Move the store to `path` without reloading the document. */
export function navigate(path: string): void {
  if (path === window.location.pathname) return;
  window.history.pushState(null, '', path);
  notify();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  window.addEventListener('popstate', onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('popstate', onStoreChange);
  };
}

function getSnapshot(): string {
  return window.location.pathname;
}

/** The current pathname. Re-renders on navigation and on back/forward. */
export function useRoute(): string {
  return useSyncExternalStore(subscribe, getSnapshot);
}
