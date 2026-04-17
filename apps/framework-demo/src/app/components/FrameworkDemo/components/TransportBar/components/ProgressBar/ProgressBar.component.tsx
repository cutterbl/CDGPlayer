import type { ChangeEvent } from 'react';
import type { CSSProperties } from 'react';
import useFrameworkDemoContext from '../../../../hooks/useFrameworkDemo.context';
import styles from './ProgressBar.module.css';

/**
 * Seekable timeline slider for transport.
 */
function ProgressBar() {
  const { controlsModel, viewState } = useFrameworkDemoContext();

  const progressStyle = {
    '--cdg-progress-percent': `${viewState.progressPercent.toFixed(1)}%`,
  } as CSSProperties;

  const handleSeekPercent = (event: ChangeEvent<HTMLInputElement>): void => {
    const percentage = Number.parseFloat(event.target.value);
    if (!Number.isFinite(percentage)) {
      return;
    }

    controlsModel?.seekPercent({ percentage });
  };

  return (
    <input
      className={styles.progress}
      type="range"
      min={0}
      max={100}
      step={0.1}
      value={viewState.progressPercent.toFixed(1)}
      style={progressStyle}
      disabled={!viewState.isPlayable || controlsModel === null}
      onChange={handleSeekPercent}
    />
  );
}

export default ProgressBar;
