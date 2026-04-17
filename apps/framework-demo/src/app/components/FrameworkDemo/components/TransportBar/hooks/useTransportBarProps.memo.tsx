import { useCallback } from 'react';
import type { ChangeEvent } from 'react';
import useFrameworkDemoContext from '../../../hooks/useFrameworkDemo.context';

/**
 * View-model contract for TransportBar.
 */
export type TransportBarResolvedProps = {
  isPlaying: boolean;
  isPlayable: boolean;
  hasModel: boolean;
  currentTimeMs: number;
  durationMs: number;
  progressPercentValue: string;
  handleTogglePlayPause: () => void;
  handleSeekPercent: (event: ChangeEvent<HTMLInputElement>) => void;
};

/**
 * Derives transport UI state and handlers from the shared controls model state.
 */
function useTransportBarProps(): TransportBarResolvedProps {
  const { controlsModel, viewState } = useFrameworkDemoContext();

  const handleTogglePlayPause = useCallback((): void => {
    // Controls model owns playback actions; component just forwards user intent.
    if (!controlsModel) {
      return;
    }

    void controlsModel.togglePlayPause();
  }, [controlsModel]);

  const handleSeekPercent = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      // Range input values arrive as strings; convert to number before seeking.
      const percentage = Number.parseFloat(event.target.value);
      if (!Number.isFinite(percentage)) {
        return;
      }

      controlsModel?.seekPercent({ percentage });
    },
    [controlsModel],
  );

  return {
    isPlaying: viewState.isPlaying,
    isPlayable: viewState.isPlayable,
    hasModel: controlsModel !== null,
    currentTimeMs: viewState.currentTimeMs,
    durationMs: viewState.durationMs,
    progressPercentValue: viewState.progressPercent.toFixed(1),
    handleTogglePlayPause,
    handleSeekPercent,
  };
}

export default useTransportBarProps;
