import useFilePickerRowProps from './hooks/useFilePickerRowProps.memo';
import styles from './FilePickerRow.module.css';

/**
 * File input row for loading browser-supported audio or karaoke zip files.
 */
function FilePickerRow() {
  const {
    showPerfDiagnostics,
    canExportPerf,
    handleTrackSelect,
    handleExportPerfArtifact,
  } = useFilePickerRowProps();

  return (
    // This row is intentionally simple: choose file + optional speed-report export.
    <div className={styles.filePickerRow}>
      <label htmlFor="track-input">
        Select audio or karaoke zip (audio/*, .zip)
      </label>
      <input
        id="track-input"
        type="file"
        accept="audio/*,.zip,application/zip"
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
  );
}

export default FilePickerRow;
