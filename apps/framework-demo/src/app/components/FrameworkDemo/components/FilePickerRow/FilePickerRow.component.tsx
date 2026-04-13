import useFilePickerRowProps from './hooks/useFilePickerRowProps.memo';
import styles from './FilePickerRow.module.css';

/**
 * FilePickerRow currently accepts no external props.
 */
export type FilePickerRowProps = Record<string, never>;

/**
 * File input row for loading karaoke zip files and exporting diagnostics.
 */
function FilePickerRow(_: FilePickerRowProps) {
  const {
    showPerfDiagnostics,
    canExportPerf,
    handleTrackSelect,
    handleExportPerfArtifact,
  } = useFilePickerRowProps();

  return (
    // This row is intentionally simple: choose file + optional speed-report export.
    <div className={styles.filePickerRow}>
      <label htmlFor="track-input">Select a karaoke zip (.zip)</label>
      <input
        id="track-input"
        type="file"
        accept=".zip,application/zip"
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
