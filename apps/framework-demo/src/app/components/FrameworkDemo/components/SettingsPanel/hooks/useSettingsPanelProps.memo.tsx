import { useCallback } from 'react';
import type { ChangeEvent } from 'react';
import useFrameworkDemoContext from '../../../hooks/useFrameworkDemo.context';

/**
 * View-model contract for SettingsPanel.
 */
export type SettingsPanelResolvedProps = {
  isPlayable: boolean;
  hasModel: boolean;
  volumeValue: string;
  playbackRateValue: string;
  pitchSemitonesValue: string;
  handleSetVolume: (event: ChangeEvent<HTMLInputElement>) => void;
  handleSetTempo: (event: ChangeEvent<HTMLInputElement>) => void;
  handleSetPitchSemitones: (event: ChangeEvent<HTMLSelectElement>) => void;
};

/**
 * Derives settings panel values and handlers from shared controls state.
 */
function useSettingsPanelProps(): SettingsPanelResolvedProps {
  const { controlsModel, viewState } = useFrameworkDemoContext();

  const handleSetVolume = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      // Sliders emit strings, so parse before passing to model methods.
      const value = Number.parseFloat(event.target.value);
      if (!Number.isFinite(value)) {
        return;
      }

      controlsModel?.setVolume({ value });
    },
    [controlsModel],
  );

  const handleSetTempo = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const value = Number.parseFloat(event.target.value);
      if (!Number.isFinite(value)) {
        return;
      }

      controlsModel?.setTempo({ value });
    },
    [controlsModel],
  );

  const handleSetPitchSemitones = useCallback(
    (event: ChangeEvent<HTMLSelectElement>): void => {
      // Key dropdown is an integer semitone offset from -12 to +12.
      const value = Number.parseInt(event.target.value, 10);
      if (!Number.isFinite(value)) {
        return;
      }

      controlsModel?.setPitchSemitones({ value });
    },
    [controlsModel],
  );

  return {
    isPlayable: viewState.isPlayable,
    hasModel: controlsModel !== null,
    volumeValue: viewState.volume.toFixed(2),
    playbackRateValue: viewState.playbackRate.toFixed(2),
    pitchSemitonesValue: Math.round(viewState.pitchSemitones).toString(),
    handleSetVolume,
    handleSetTempo,
    handleSetPitchSemitones,
  };
}

export default useSettingsPanelProps;
