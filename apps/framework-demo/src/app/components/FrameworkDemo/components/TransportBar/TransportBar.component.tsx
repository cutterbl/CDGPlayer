import useTransportBarProps from './hooks/useTransportBarProps.memo';
import styles from './TransportBar.module.css';
import type { CSSProperties } from 'react';

/**
 * TransportBar currently accepts no external props.
 */
export type TransportBarProps = Record<string, never>;

/**
 * Formats milliseconds into an mm:ss clock string for transport UI.
 */
const formatClock = (ms: number): string => {
  // Convert milliseconds into mm:ss for display.
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

/**
 * Transport controls for play/pause, timeline seek, and elapsed/duration display.
 */
function TransportBar(_: TransportBarProps) {
  const {
    isPlaying,
    isPlayable,
    hasModel,
    currentTimeMs,
    durationMs,
    progressPercentValue,
    handleTogglePlayPause,
    handleSeekPercent,
  } = useTransportBarProps();

  const progressStyle = {
    // Feed current progress into CSS so the slider track can render a filled gradient.
    '--cdg-progress-percent': `${progressPercentValue}%`,
  } as CSSProperties;

  return (
    <div className={styles.transportBar}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        disabled={!isPlayable || !hasModel}
        onClick={handleTogglePlayPause}
      >
        <span aria-hidden="true">{isPlaying ? '❚❚' : '▶'}</span>
      </button>

      <span className={styles.timecode}>{formatClock(currentTimeMs)}</span>

      <input
        className={styles.progress}
        type="range"
        min={0}
        max={100}
        step={0.1}
        value={progressPercentValue}
        style={progressStyle}
        disabled={!isPlayable || !hasModel}
        onChange={handleSeekPercent}
      />

      <span className={styles.timecode}>{formatClock(durationMs)}</span>
    </div>
  );
}

export default TransportBar;
