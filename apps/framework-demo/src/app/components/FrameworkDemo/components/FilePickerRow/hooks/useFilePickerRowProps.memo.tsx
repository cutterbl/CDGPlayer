import { useCallback } from 'react';
import type { ChangeEvent } from 'react';
import useFrameworkDemoContext from '../../../hooks/useFrameworkDemo.context';

/**
 * View-model contract for FilePickerRow.
 */
export type FilePickerRowResolvedProps = {
  showPerfDiagnostics: boolean;
  canExportPerf: boolean;
  handleTrackSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  handleExportPerfArtifact: () => void;
};

/**
 * Derives FilePickerRow props/handlers from shared framework demo context.
 */
function useFilePickerRowProps(): FilePickerRowResolvedProps {
  const {
    player,
    setTitleMetadata,
    showPerfDiagnostics,
    perfSummary,
    showStatusMessage,
    resetPlaybackStarted,
    exportPerfArtifact,
  } = useFrameworkDemoContext();

  const loadTrackFromFile = useCallback(
    async ({ file }: { file: File }): Promise<void> => {
      // Guard against UI events firing before player initialization is complete.
      if (!player) {
        return;
      }

      // Reset playback/title state before loading new media.
      player.stop();
      resetPlaybackStarted();
      setTitleMetadata(null);
      showStatusMessage('Loading track...');

      try {
        // Let the player parse the selected zip file from the browser File API.
        const loadedTrack = await player.load({
          input: {
            kind: 'file',
            file,
          },
        });

        if (loadedTrack?.metadata) {
          const title = loadedTrack.metadata.title.trim();
          const artist = loadedTrack.metadata.artist.trim();
          setTitleMetadata({
            title: title || 'Unknown Title',
            artist: artist || 'Unknown Artist',
          });
        }

        showStatusMessage('Track loaded.');
      } catch (errorValue: unknown) {
        // Keep status user-friendly while preserving details through Error.message.
        const message =
          errorValue instanceof Error
            ? errorValue.message
            : 'Unknown load error';
        showStatusMessage(`Load failed: ${message}`);
      }
    },
    [player, resetPlaybackStarted, setTitleMetadata, showStatusMessage],
  );

  const handleTrackSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      // Native file input exposes files through the event target.
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      void loadTrackFromFile({ file });
    },
    [loadTrackFromFile],
  );

  const handleExportPerfArtifact = useCallback((): void => {
    // Delegate to shared context helper that triggers JSON download.
    exportPerfArtifact();
  }, [exportPerfArtifact]);

  return {
    showPerfDiagnostics,
    canExportPerf: perfSummary !== null,
    handleTrackSelect,
    handleExportPerfArtifact,
  };
}

export default useFilePickerRowProps;
