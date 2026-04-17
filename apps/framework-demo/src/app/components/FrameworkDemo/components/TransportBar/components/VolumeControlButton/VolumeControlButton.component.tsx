import type { ChangeEvent } from 'react';
import { RiVolumeUpFill } from '@remixicon/react';
import useFrameworkDemoContext from '../../../../hooks/useFrameworkDemo.context';
import componentStyles from './VolumeControlButton.module.css';
import sharedStyles from '../../shared.module.css';

/**
 * Toggle button and anchored popover for volume control.
 */
function VolumeControlButton() {
  const { controlsModel, viewState } = useFrameworkDemoContext();
  const popoverId = 'cdg-framework-demo-volume-popover';
  const datalistId = 'framework-volume-ticks';

  const isDisabled = !viewState.isPlayable || controlsModel === null;

  const handleSetVolume = (event: ChangeEvent<HTMLInputElement>): void => {
    const value = Number.parseFloat(event.target.value);
    if (!Number.isFinite(value)) {
      return;
    }

    controlsModel?.setVolume({ value });
  };

  return (
    <>
      <div className={componentStyles.anchor}>
        <button
          type="button"
          className={sharedStyles.iconButton}
          aria-label="Volume"
          aria-haspopup="dialog"
          popoverTarget={popoverId}
          popoverTargetAction="toggle"
          disabled={isDisabled}
        >
          <RiVolumeUpFill
            aria-hidden="true"
            className={sharedStyles.controlIcon}
          />
        </button>
      </div>

      <div
        id={popoverId}
        popover="auto"
        className={`${sharedStyles.controlPopover} ${componentStyles.popover}`}
      >
        <input
          className={sharedStyles.popupSlider}
          type="range"
          min={0}
          max={1}
          step={0.01}
          list={datalistId}
          value={viewState.volume.toFixed(2)}
          disabled={isDisabled}
          aria-label="Volume slider"
          onChange={handleSetVolume}
        />
        <datalist id={datalistId}>
          <option value={0} />
          <option value={0.1} />
          <option value={0.2} />
          <option value={0.3} />
          <option value={0.4} />
          <option value={0.5} />
          <option value={0.6} />
          <option value={0.7} />
          <option value={0.8} />
          <option value={0.9} />
          <option value={1} />
        </datalist>
      </div>
    </>
  );
}

export default VolumeControlButton;
