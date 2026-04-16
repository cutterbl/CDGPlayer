import type { ChangeEvent } from 'react';
import { RiHeartPulseFill } from '@remixicon/react';
import useFrameworkDemoContext from '../../../../hooks/useFrameworkDemo.context';
import componentStyles from './TempoControlButton.module.css';
import sharedStyles from '../../shared.module.css';

/**
 * Toggle button and anchored popover for tempo control.
 */
function TempoControlButton() {
  const { controlsModel, viewState } = useFrameworkDemoContext();
  const popoverId = 'cdg-framework-demo-tempo-popover';
  const datalistId = 'framework-tempo-ticks';

  const isDisabled = !viewState.isPlayable || controlsModel === null;

  const handleSetTempo = (event: ChangeEvent<HTMLInputElement>): void => {
    const value = Number.parseFloat(event.target.value);
    if (!Number.isFinite(value)) {
      return;
    }

    controlsModel?.setTempo({ value });
  };

  return (
    <>
      <div className={componentStyles.anchor}>
        <button
          type="button"
          className={sharedStyles.iconButton}
          aria-label="Tempo"
          aria-haspopup="dialog"
          popoverTarget={popoverId}
          popoverTargetAction="toggle"
          disabled={isDisabled}
        >
          <RiHeartPulseFill
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
          min={0.5}
          max={2}
          step={0.01}
          list={datalistId}
          value={viewState.playbackRate.toFixed(2)}
          disabled={isDisabled}
          aria-label="Tempo slider"
          onChange={handleSetTempo}
        />
        <datalist id={datalistId}>
          <option value={0.5} />
          <option value={0.75} />
          <option value={1} />
          <option value={1.25} />
          <option value={1.5} />
          <option value={1.75} />
          <option value={2} />
        </datalist>
      </div>
    </>
  );
}

export default TempoControlButton;
