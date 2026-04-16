import { RiPauseCircleFill, RiPlayCircleFill } from '@remixicon/react';
import useFrameworkDemoContext from '../../../../hooks/useFrameworkDemo.context';
import componentStyles from './PlayPauseButton.module.css';
import sharedStyles from '../../shared.module.css';

/**
 * Play/pause transport action button.
 */
function PlayPauseButton() {
  const { controlsModel, viewState } = useFrameworkDemoContext();

  const handleTogglePlayPause = (): void => {
    if (!controlsModel) {
      return;
    }

    void controlsModel.togglePlayPause();
  };

  return (
    <button
      type="button"
      className={`${sharedStyles.iconButton} ${componentStyles.button}`}
      aria-label={viewState.isPlaying ? 'Pause' : 'Play'}
      disabled={!viewState.isPlayable || controlsModel === null}
      onClick={handleTogglePlayPause}
    >
      {viewState.isPlaying ? (
        <RiPauseCircleFill
          aria-hidden="true"
          className={sharedStyles.controlIcon}
        />
      ) : (
        <RiPlayCircleFill
          aria-hidden="true"
          className={sharedStyles.controlIcon}
        />
      )}
    </button>
  );
}

export default PlayPauseButton;
