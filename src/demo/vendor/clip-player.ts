/**
 * Stand-in for the third-party video player Acme Store embeds on product
 * pages. It is a vendor library: the store did not write it and cannot change
 * it, and its event API is its own.
 *
 * The "stream" is simulated: playback advances on a timer and stalls now and
 * then while it buffers, the way a real player does on a flaky connection.
 */

export type ClipPlayerEvent =
  | 'play'
  | 'pause'
  | 'buffering'
  | 'playing'
  | 'timeupdate'
  | 'ended';

export interface ClipPlayer {
  readonly duration: number;
  readonly currentTime: number;
  readonly state: 'idle' | 'playing' | 'buffering' | 'paused' | 'ended';
  play(): void;
  pause(): void;
  on(event: ClipPlayerEvent, listener: () => void): void;
  off(event: ClipPlayerEvent, listener: () => void): void;
  /** Stops playback and drops every listener. The player is unusable after. */
  destroy(): void;
}

const TICK_MS = 250;
const STALL_CHANCE_PER_TICK = 0.06;

export function createClipPlayer(options: { duration: number }): ClipPlayer {
  const listeners = new Map<ClipPlayerEvent, Set<() => void>>();
  let state: ClipPlayer['state'] = 'idle';
  let currentTime = 0;
  let tick: ReturnType<typeof setInterval> | null = null;
  let stall: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  const emit = (event: ClipPlayerEvent) => {
    for (const listener of listeners.get(event) ?? []) listener();
  };

  const stopTimers = () => {
    if (tick !== null) clearInterval(tick);
    if (stall !== null) clearTimeout(stall);
    tick = null;
    stall = null;
  };

  const advance = () => {
    if (state !== 'playing') return;
    if (Math.random() < STALL_CHANCE_PER_TICK) {
      state = 'buffering';
      emit('buffering');
      stall = setTimeout(
        () => {
          stall = null;
          if (state !== 'buffering') return;
          state = 'playing';
          emit('playing');
        },
        600 + Math.random() * 1400,
      );
      return;
    }
    currentTime = Math.min(options.duration, currentTime + TICK_MS / 1000);
    emit('timeupdate');
    if (currentTime >= options.duration) {
      stopTimers();
      state = 'ended';
      emit('ended');
    }
  };

  return {
    duration: options.duration,
    get currentTime() {
      return currentTime;
    },
    get state() {
      return state;
    },
    play() {
      if (destroyed || state === 'playing' || state === 'buffering') return;
      if (state === 'ended') currentTime = 0;
      state = 'playing';
      emit('play');
      tick = setInterval(advance, TICK_MS);
    },
    pause() {
      if (destroyed || (state !== 'playing' && state !== 'buffering')) return;
      stopTimers();
      state = 'paused';
      emit('pause');
    },
    on(event, listener) {
      if (destroyed) return;
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
    },
    destroy() {
      stopTimers();
      listeners.clear();
      destroyed = true;
    },
  };
}
