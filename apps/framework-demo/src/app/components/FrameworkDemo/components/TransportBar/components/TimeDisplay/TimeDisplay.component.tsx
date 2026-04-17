import styles from './TimeDisplay.module.css';

export type TimeDisplayProps = {
  valueMs: number;
};

/**
 * Formats and renders a transport clock value.
 */
function TimeDisplay({ valueMs }: TimeDisplayProps) {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');

  return <span className={styles.timecode}>{`${minutes}:${seconds}`}</span>;
}

export default TimeDisplay;
