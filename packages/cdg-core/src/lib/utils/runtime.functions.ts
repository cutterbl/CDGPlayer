import {
  EVENT_LOOP_YIELD_DELAY_MS,
  FRAME_FALLBACK_INTERVAL_MS,
  MIN_ASYNC_PARSE_CHUNK_PACKETS,
} from './runtime.constants.js';
import type { AnimationFrameHandle } from '../types.js';

/**
 * Monotonic timestamp helper with Date.now fallback.
 */
export const now = (): number => {
  if (
    typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
  ) {
    return performance.now();
  }
  return Date.now();
};

/**
 * Animation frame scheduling helper with timeout fallback.
 */
export const requestFrame = ({
  callback,
}: {
  callback: (ts?: number) => void;
}): AnimationFrameHandle => {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(now()), FRAME_FALLBACK_INTERVAL_MS);
};

/**
 * Cancels a scheduled frame handle regardless of scheduling mechanism.
 */
export const cancelFrame = ({
  id,
}: {
  id: AnimationFrameHandle | null;
}): void => {
  if (id == null) {
    return;
  }
  if (typeof cancelAnimationFrame === 'function' && typeof id === 'number') {
    cancelAnimationFrame(id);
    return;
  }
  clearTimeout(id as ReturnType<typeof setTimeout>);
};

/**
 * Cooperative async yield used by chunked parsing flows.
 */
export const yieldToEventLoop = async (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, EVENT_LOOP_YIELD_DELAY_MS);
  });

export const resolvePacketsPerChunk = ({
  chunkPackets,
}: {
  chunkPackets: number;
}): number => Math.max(MIN_ASYNC_PARSE_CHUNK_PACKETS, Math.floor(chunkPackets));
