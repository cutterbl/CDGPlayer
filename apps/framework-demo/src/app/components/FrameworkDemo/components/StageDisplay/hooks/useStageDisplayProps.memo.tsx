import { useCallback } from 'react';
import type { MouseEvent } from 'react';
import useFrameworkDemoContext from '../../../hooks/useFrameworkDemo.context';

/**
 * View-model contract for StageDisplay.
 */
export type StageDisplayResolvedProps = {
  canvasRef: ReturnType<typeof useFrameworkDemoContext>['canvasRef'];
  audioRef: ReturnType<typeof useFrameworkDemoContext>['audioRef'];
  showPerfDiagnostics: boolean;
  statusMessage: string;
  isStatusVisible: boolean;
  viewState: ReturnType<typeof useFrameworkDemoContext>['viewState'];
  titleMetadata: ReturnType<typeof useFrameworkDemoContext>['titleMetadata'];
  perfSummary: ReturnType<typeof useFrameworkDemoContext>['perfSummary'];
  hasTrack: boolean;
  showTitle: boolean;
  handleStageClick: (event: MouseEvent<HTMLDivElement>) => void;
};

/**
 * Derives stage refs, state, and click behavior from shared framework context.
 */
function useStageDisplayProps(): StageDisplayResolvedProps {
  const {
    canvasRef,
    audioRef,
    showPerfDiagnostics,
    statusMessage,
    isStatusVisible,
    controlsModel,
    viewState,
    titleMetadata,
    perfSummary,
    hasTrack,
    showTitle,
  } = useFrameworkDemoContext();

  const handleStageClick = useCallback(
    (_event: MouseEvent<HTMLDivElement>): void => {
      // Match familiar video UX: clicking the stage toggles play/pause.
      if (!viewState.isPlayable || controlsModel === null) {
        return;
      }

      void controlsModel.togglePlayPause();
    },
    [viewState.isPlayable, controlsModel],
  );

  return {
    canvasRef,
    audioRef,
    showPerfDiagnostics,
    statusMessage,
    isStatusVisible,
    viewState,
    titleMetadata,
    perfSummary,
    hasTrack,
    showTitle,
    handleStageClick,
  };
}

export default useStageDisplayProps;
