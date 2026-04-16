import useFrameworkDemoContext from '../../hooks/useFrameworkDemo.context';
import KeyControlButton from './components/KeyControlButton/KeyControlButton.component';
import PlayPauseButton from './components/PlayPauseButton/PlayPauseButton.component';
import ProgressBar from './components/ProgressBar/ProgressBar.component';
import TempoControlButton from './components/TempoControlButton/TempoControlButton.component';
import TimeDisplay from './components/TimeDisplay/TimeDisplay.component';
import VolumeControlButton from './components/VolumeControlButton/VolumeControlButton.component';
import styles from './TransportBar.module.css';

/**
 * Transport controls for play/pause, timeline seek, and elapsed/duration display.
 */
function TransportBar() {
  const { viewState } = useFrameworkDemoContext();

  return (
    <div className={styles.transportBar}>
      <PlayPauseButton />
      <TimeDisplay valueMs={viewState.currentTimeMs} />
      <ProgressBar />
      <TimeDisplay valueMs={viewState.durationMs} />
      <VolumeControlButton />
      <TempoControlButton />
      <KeyControlButton />
    </div>
  );
}

export default TransportBar;
