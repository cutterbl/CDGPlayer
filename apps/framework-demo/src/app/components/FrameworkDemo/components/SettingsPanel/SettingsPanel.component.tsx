import useSettingsPanelProps from './hooks/useSettingsPanelProps.memo';
import styles from './SettingsPanel.module.css';

const formatKeyLabelFromSemitones = ({
  semitones,
}: {
  semitones: number;
}): string => {
  if (semitones === 0) {
    return '0';
  }

  const halfSteps = semitones / 2;
  if (Number.isInteger(halfSteps)) {
    return halfSteps > 0 ? `+${halfSteps}` : halfSteps.toString();
  }

  const absolute = Math.abs(halfSteps);
  const whole = Math.trunc(absolute);
  const fractionalLabel = whole === 0 ? '.5' : `${whole}.5`;
  return halfSteps < 0 ? `-${fractionalLabel}` : `+${fractionalLabel}`;
};

const keyTickValues = Array.from({ length: 25 }, (_, index) => -12 + index);
const keyTickValuesDescending = [...keyTickValues].reverse();

/**
 * Floating settings controls for volume, tempo, and key shift.
 */
function SettingsPanel() {
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
          <option value={0.1} />
          <option value={0.2} />
          <option value={0.3} />
          <option value={0.4} />
          <option value={0.5} />
          <option value={0.6} />
          <option value={0.7} />
          <option value={0.8} />
          <option value={0.9} />
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

      <label className={`${styles.setting} ${styles.settingVertical}`}>
        <span className={styles.controlLabel}>Key</span>
        <input
          className={styles.vertical}
          type="range"
          min={-12}
          max={12}
          step={1}
          list="framework-key-ticks"
          value={pitchSemitonesValue}
          disabled={!isPlayable || !hasModel}
          onChange={handleSetPitchSemitones}
          aria-label="Key"
        />
        <div className={styles.verticalTickLabels} aria-hidden="true">
          {keyTickValuesDescending.map((value) => (
            <span key={`label-${value}`} className={styles.verticalTickLabel}>
              {formatKeyLabelFromSemitones({ semitones: value })}
            </span>
          ))}
        </div>
        <datalist id="framework-key-ticks">
          {keyTickValues.map((value) => (
            <option
              key={value}
              value={value}
              label={formatKeyLabelFromSemitones({ semitones: value })}
            />
          ))}
        </datalist>
      </label>
    </div>
  );
}

export default SettingsPanel;
