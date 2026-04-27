import type { ReactNode } from 'react';
import useStageDisplayProps from './hooks/useStageDisplayProps.memo';
import styles from './StageDisplay.module.css';

/**
 * Props for the visual stage wrapper.
 */
export type StageDisplayProps = {
  children?: ReactNode;
};

/**
 * Visual stage that hosts canvas output, metadata, status, and diagnostics overlays.
 */
function StageDisplay({ children }: StageDisplayProps) {
  const {
    canvasRef,
    audioRef,
    showPerfDiagnostics,
    compatibilityWarning,
    statusMessage,
    isStatusVisible,
    viewState,
    titleMetadata,
    hasGraphicsTrack,
    perfSummary,
    hasTrack,
    showTitle,
    handleStageClick,
  } = useStageDisplayProps();

  return (
    // Stage wraps the canvas render surface plus metadata/status/perf overlays.
    <div
      className={`${styles.stageWrap}${hasTrack ? ` ${styles.hasTrack}` : ''}${viewState.isPlaying ? ` ${styles.isPlaying}` : ''}`}
    >
      {children}

      <div className={styles.stage} onClick={handleStageClick}>
        {showTitle ? (
          <div
            className={`${styles.titleImage}${titleMetadata ? ` ${styles.hasMetadata}` : ''}`}
            aria-hidden="true"
          >
            {titleMetadata ? (
              <div className={styles.titleMeta}>
                <div className={styles.titleMetaTitle}>
                  {titleMetadata.title}
                </div>
                <div className={styles.titleMetaArtist}>
                  {titleMetadata.artist}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
          width={300}
          height={216}
          className={hasGraphicsTrack ? undefined : styles.canvasHidden}
        />
        <div
          className={`${styles.status}${isStatusVisible || compatibilityWarning ? ` ${styles.isVisible}` : ''}`}
        >
          {statusMessage}
          {compatibilityWarning ? (
            <div className={styles.compatibilityWarning}>
              {compatibilityWarning}
            </div>
          ) : null}
        </div>
        {showPerfDiagnostics ? (
          <div className={styles.perfHud}>
            {/*
              Keep this copy beginner-friendly:
              - avg ms: normal frame cost (lower is better)
              - p95 ms: occasional worst-case frame cost (spike detector)
            */}
            {perfSummary
              ? `Speed check (${perfSummary.mode})\navg ${perfSummary.avgCpuMs.toFixed(2)} ms | p95 ${perfSummary.p95CpuMs.toFixed(2)} ms\navg bytes ${Math.round(perfSummary.avgTransferredBytes)}`
              : 'Speed check: play a song to collect samples...'}
          </div>
        ) : null}
      </div>

      <audio ref={audioRef} preload="auto" />
    </div>
  );
}

export default StageDisplay;
