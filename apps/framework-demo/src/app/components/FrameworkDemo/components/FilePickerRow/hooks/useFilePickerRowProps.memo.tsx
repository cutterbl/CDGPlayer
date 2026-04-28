import { useCallback } from 'react';
import type { ChangeEvent } from 'react';
import useFrameworkDemoContext from '../../../hooks/useFrameworkDemo.context';

const VIDEO_EXTENSION_TO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
};

const extensionFromName = ({ name }: { name: string }): string | null => {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex < 0 || dotIndex === name.length - 1) {
    return null;
  }

  return name.slice(dotIndex + 1).toLowerCase();
};

const inferVideoMimeType = ({ file }: { file: File }): string | null => {
  if (file.type.startsWith('video/')) {
    return file.type.toLowerCase();
  }

  const extension = extensionFromName({ name: file.name });
  if (!extension) {
    return null;
  }

  return VIDEO_EXTENSION_TO_MIME[extension] ?? null;
};

const canPlayVideoMimeType = ({ mimeType }: { mimeType: string }): boolean => {
  const videoElement = document.createElement('video');
  const supportLevel = videoElement.canPlayType(mimeType);
  return supportLevel === 'probably' || supportLevel === 'maybe';
};

/**
 * View-model contract for FilePickerRow.
 */
export type FilePickerRowResolvedProps = {
  showPerfDiagnostics: boolean;
  canExportPerf: boolean;
  codecDiagnostic: string | null;
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
    setHasGraphicsTrack,
    setHasVideoTrack,
    setCodecDiagnostic,
    showPerfDiagnostics,
    perfSummary,
    codecDiagnostic,
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
      setHasGraphicsTrack(true);
      setHasVideoTrack(false);
      setCodecDiagnostic(null);
      showStatusMessage('Loading track...');

      const likelyVideoMimeType = inferVideoMimeType({ file });
      if (
        likelyVideoMimeType &&
        !canPlayVideoMimeType({ mimeType: likelyVideoMimeType })
      ) {
        setCodecDiagnostic(
          `This browser reports limited support for ${likelyVideoMimeType}. For best compatibility, use MP4 (H.264 video + AAC audio).`,
        );
      }

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

        const nextHasVideoTrack = loadedTrack?.mediaKind === 'video';
        setHasVideoTrack(nextHasVideoTrack);
        setHasGraphicsTrack(
          !nextHasVideoTrack && (loadedTrack?.hasGraphics ?? false),
        );

        if (nextHasVideoTrack) {
          setCodecDiagnostic(null);
        }

        showStatusMessage('Track loaded.');
      } catch (errorValue: unknown) {
        // Keep status user-friendly while preserving details through Error.message.
        const message =
          errorValue instanceof Error
            ? errorValue.message
            : 'Unknown load error';
        setHasVideoTrack(false);

        const likelyVideoMimeType = inferVideoMimeType({ file });
        const codecLikelyUnsupported =
          message.includes('cannot play video format') ||
          message.includes('Unable to load video media in this browser') ||
          message.includes('Video track could not be decoded by this browser');

        if (likelyVideoMimeType && codecLikelyUnsupported) {
          setCodecDiagnostic(
            `This file appears to use an unsupported video codec for this browser (${likelyVideoMimeType}). Try MP4 with H.264 video + AAC audio.`,
          );
        }

        showStatusMessage(`Load failed: ${message}`);
      }
    },
    [
      player,
      resetPlaybackStarted,
      setTitleMetadata,
      setHasGraphicsTrack,
      setHasVideoTrack,
      setCodecDiagnostic,
      showStatusMessage,
    ],
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
    codecDiagnostic,
    handleTrackSelect,
    handleExportPerfArtifact,
  };
}

export default useFilePickerRowProps;
