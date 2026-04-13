import useSettingsPanelProps from './hooks/useSettingsPanelProps.memo';
import styles from './SettingsPanel.module.css';

/**
 * SettingsPanel currently accepts no external props.
 */
export type SettingsPanelProps = Record<string, never>;

/**
 * Floating settings controls for volume, tempo, and key shift.
 */
function SettingsPanel(_: SettingsPanelProps) {
  const {
    isPlayable,
    hasModel,
    volumeValue,
    playbackRateValue,
    pitchSemitonesValue,
    handleSetVolume,
    handleSetTempo,
    handleSetPitchSemitones,
  } = useSettingsPanelProps();

  return (
    // Floating utility panel: volume, tempo, and key are grouped as playback modifiers.
    <div className={styles.floatingPanel} data-cdg-settings-panel>
      <label className={`${styles.setting} ${styles.settingVertical}`}>
        <span className={styles.controlLabel}>Volume</span>
        <input
          className={styles.vertical}
          type="range"
          min={0}
          max={1}
          step={0.01}
          list="framework-volume-ticks"
          value={volumeValue}
          disabled={!isPlayable || !hasModel}
          onChange={handleSetVolume}
        />
        <datalist id="framework-volume-ticks">
          <option value={0} />
          <option value={0.25} />
          <option value={0.5} />
          <option value={0.75} />
          <option value={1} />
        </datalist>
      </label>

      <label className={`${styles.setting} ${styles.settingVertical}`}>
        <span className={styles.controlLabel}>Tempo</span>
        <input
          className={styles.vertical}
          type="range"
          min={0.5}
          max={2}
          step={0.01}
          list="framework-tempo-ticks"
          value={playbackRateValue}
          disabled={!isPlayable || !hasModel}
          onChange={handleSetTempo}
        />
        <datalist id="framework-tempo-ticks">
          <option value={0.5} />
          <option value={0.75} />
          <option value={1} />
          <option value={1.25} />
          <option value={1.5} />
          <option value={1.75} />
          <option value={2} />
        </datalist>
      </label>

      <label className={`${styles.setting} ${styles.settingKey}`}>
        <span>Key</span>
        <select
          value={pitchSemitonesValue}
          disabled={!isPlayable || !hasModel}
          onChange={handleSetPitchSemitones}
        >
          {Array.from({ length: 25 }, (_, index) => -12 + index).map(
            (value) => (
              <option key={value} value={value}>
                {value > 0 ? `+${value}` : value}
              </option>
            ),
          )}
        </select>
      </label>
    </div>
  );
}

export default SettingsPanel;
