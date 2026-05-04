import type { PlayerState } from '../player.js';

export const createInitialState = (): PlayerState => ({
  status: 'idle',
  trackId: null,
  currentTimeMs: 0,
  durationMs: 0,
  volume: 1,
  playbackRate: 1,
  pitchSemitones: 0,
});

export const clamp = ({
  value,
  min,
  max,
}: {
  value: number;
  min: number;
  max: number;
}): number => Math.min(max, Math.max(min, value));

export const asMilliseconds = ({ seconds }: { seconds: number }): number =>
  Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds * 1000)) : 0;

export const canElementPlayMimeType = ({
  media,
  mimeType,
}: {
  media: HTMLMediaElement;
  mimeType: string;
}): boolean => {
  const supportResult = media.canPlayType(mimeType);
  return supportResult === 'probably' || supportResult === 'maybe';
};
