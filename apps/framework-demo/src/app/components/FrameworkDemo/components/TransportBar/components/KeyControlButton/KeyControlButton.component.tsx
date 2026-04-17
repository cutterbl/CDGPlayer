import type { ChangeEvent } from 'react';
import { RiKeyFill } from '@remixicon/react';
import useFrameworkDemoContext from '../../../../hooks/useFrameworkDemo.context';
import componentStyles from './KeyControlButton.module.css';
import sharedStyles from '../../shared.module.css';

const formatKeyLabelFromSemitones = ({
  semitones,
}: {
  semitones: number;
}): string => {
  if (semitones === 0) {
    return '0';
  }

  const halfSteps = semitones / 2;
  if (Number.isInteger(halfSteps)) {
    return halfSteps > 0 ? `+${halfSteps}` : halfSteps.toString();
  }

  const absolute = Math.abs(halfSteps);
  const whole = Math.trunc(absolute);
  const fractionalLabel = whole === 0 ? '.5' : `${whole}.5`;
  return halfSteps < 0 ? `-${fractionalLabel}` : `+${fractionalLabel}`;
};

const keyTickValues = Array.from({ length: 25 }, (_, index) => -12 + index);
const keyTickValuesDescending = [...keyTickValues].reverse();

/**
 * Toggle button and anchored popover for key-shift control.
 */
function KeyControlButton() {
  const { controlsModel, viewState } = useFrameworkDemoContext();
  const popoverId = 'cdg-framework-demo-key-popover';
  const datalistId = 'framework-key-ticks';

  const isDisabled = !viewState.isPlayable || controlsModel === null;

  const handleSetPitchSemitones = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    const value = Number.parseInt(event.target.value, 10);
    if (!Number.isFinite(value)) {
      return;
    }

    controlsModel?.setPitchSemitones({ value });
  };

  return (
    <>
      <div className={componentStyles.anchor}>
        <button
          type="button"
          className={sharedStyles.iconButton}
          aria-label="Key"
          aria-haspopup="dialog"
          popoverTarget={popoverId}
          popoverTargetAction="toggle"
          disabled={isDisabled}
        >
          <RiKeyFill aria-hidden="true" className={sharedStyles.controlIcon} />
        </button>
      </div>

      <div
        id={popoverId}
        popover="auto"
        className={`${sharedStyles.controlPopover} ${componentStyles.popover}`}
      >
        <div className={componentStyles.sliderRow}>
          <input
            className={sharedStyles.popupSlider}
            type="range"
            min={-12}
            max={12}
            step={1}
            list={datalistId}
            value={Math.round(viewState.pitchSemitones).toString()}
            disabled={isDisabled}
            aria-label="Key slider"
            onChange={handleSetPitchSemitones}
          />
          <div
            className={componentStyles.verticalTickLabels}
            aria-hidden="true"
          >
            {keyTickValuesDescending.map((value) => (
              <span
                key={`label-${value}`}
                className={componentStyles.verticalTickLabel}
              >
                {formatKeyLabelFromSemitones({ semitones: value })}
              </span>
            ))}
          </div>
        </div>
        <datalist id={datalistId}>
          {keyTickValues.map((value) => (
            <option
              key={value}
              value={value}
              label={formatKeyLabelFromSemitones({ semitones: value })}
            />
          ))}
        </datalist>
      </div>
    </>
  );
}

export default KeyControlButton;
