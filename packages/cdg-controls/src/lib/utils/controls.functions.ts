import { MAX_KEY_SEMITONES, MIN_KEY_SEMITONES } from './controls.constants.js';
import type {
  ControlsOrientation,
  ControlsPlayerAdapter,
  ControlsPlayerState,
  ControlsViewState,
} from '../controls.js';

export interface RangeTickOption {
  value: number;
  label?: string;
}

export const setTempoValue = ({
  player,
  value,
}: {
  player: ControlsPlayerAdapter;
  value: number;
}): void => {
  // Tempo is the product-facing concept. The fallback keeps older adapters
  // working while player internals may still map tempo onto playbackRate.
  if (typeof player.setTempo === 'function') {
    player.setTempo({ value });
    return;
  }

  player.setPlaybackRate({ value });
};

export const formatClock = ({ ms }: { ms: number }): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const clamp = ({
  value,
  min,
  max,
}: {
  value: number;
  min: number;
  max: number;
}): number => Math.min(max, Math.max(min, value));

export const appendClassName = ({
  element,
  className,
}: {
  element: HTMLElement;
  className: string | undefined;
}): void => {
  if (!className) {
    return;
  }

  element.classList.add(...className.split(/\s+/u).filter(Boolean));
};

let datalistIdCounter = 0;

export const createRangeDatalist = ({
  input,
  options,
}: {
  input: HTMLInputElement;
  options: RangeTickOption[];
}): HTMLDataListElement => {
  datalistIdCounter += 1;

  const datalist = document.createElement('datalist');
  datalist.id = `cdg-range-marks-${datalistIdCounter}`;

  for (const optionConfig of options) {
    const option = document.createElement('option');
    option.value = optionConfig.value.toString();

    if (optionConfig.label !== undefined) {
      option.label = optionConfig.label;
    }

    datalist.appendChild(option);
  }

  input.setAttribute('list', datalist.id);
  return datalist;
};

export const createVisibleRangeTickLabels = ({
  options,
}: {
  options: RangeTickOption[];
}): HTMLDivElement => {
  const tickLabels = document.createElement('div');
  tickLabels.dataset['role'] = 'range-tick-labels';
  tickLabels.setAttribute('aria-hidden', 'true');

  const labelOptions = [...options].reverse();

  for (const optionConfig of labelOptions) {
    const tickLabel = document.createElement('span');
    tickLabel.dataset['role'] = 'range-tick-label';
    tickLabel.dataset['value'] = optionConfig.value.toString();
    tickLabel.textContent = optionConfig.label ?? '';
    tickLabels.appendChild(tickLabel);
  }

  return tickLabels;
};

export const formatKeyLabelFromSemitones = ({
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

export const calculateProgress = ({
  currentMs,
  durationMs,
}: {
  currentMs: number;
  durationMs: number;
}): number => {
  if (!durationMs) {
    return 0;
  }
  return clamp({ value: (currentMs / durationMs) * 100, min: 0, max: 100 });
};

export const isPlayable = ({
  status,
}: {
  status: ControlsPlayerState['status'];
}): boolean =>
  status === 'ready' || status === 'playing' || status === 'paused';

export const deriveViewState = ({
  playerState,
}: {
  playerState: ControlsPlayerState;
}): ControlsViewState => ({
  ...playerState,
  isPlayable: isPlayable({ status: playerState.status }),
  isPlaying: playerState.status === 'playing',
  progressPercent: calculateProgress({
    currentMs: playerState.currentTimeMs,
    durationMs: playerState.durationMs,
  }),
});

export const applyRangeOrientation = ({
  root,
  input,
  orientation,
}: {
  root: HTMLElement;
  input: HTMLInputElement;
  orientation: ControlsOrientation;
}): void => {
  root.dataset['orientation'] = orientation;
  input.setAttribute('aria-orientation', orientation);
  if (orientation === 'vertical') {
    input.setAttribute('orient', 'vertical');
  }
};

export const createKeyTickOptions = (): RangeTickOption[] =>
  Array.from(
    { length: MAX_KEY_SEMITONES - MIN_KEY_SEMITONES + 1 },
    (_, index) => {
      const value = MIN_KEY_SEMITONES + index;
      return {
        value,
        label: formatKeyLabelFromSemitones({ semitones: value }),
      };
    },
  );
