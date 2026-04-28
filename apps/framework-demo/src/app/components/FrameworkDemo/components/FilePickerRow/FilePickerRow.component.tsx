import useFilePickerRowProps from './hooks/useFilePickerRowProps.memo';
import styles from './FilePickerRow.module.css';

/**
 * File input row for loading browser-supported audio or karaoke zip files.
 */
function FilePickerRow() {
  const {
    showPerfDiagnostics,
    canExportPerf,
    codecDiagnostic,
    handleTrackSelect,
    handleExportPerfArtifact,
  } = useFilePickerRowProps();

  return (
    // This row is intentionally simple: choose file + optional speed-report export.
    <div>
      <div className={styles.filePickerRow}>
        <label htmlFor="track-input">
          Select media or karaoke zip (audio/*, video/*, .zip)
        </label>
        <input
          id="track-input"
          type="file"
          accept="audio/*,video/*,.zip,application/zip"
          onChange={handleTrackSelect}
        />
        {showPerfDiagnostics ? (
          <button
            type="button"
            className={styles.exportPerf}
            disabled={!canExportPerf}
            onClick={handleExportPerfArtifact}
          >
            Export speed report (.json)
          </button>
        ) : null}
      </div>
      {codecDiagnostic ? (
        <p className={styles.codecDiagnostic} role="status">
          {codecDiagnostic}
        </p>
      ) : null}
    </div>
  );
}

export default FilePickerRow;
