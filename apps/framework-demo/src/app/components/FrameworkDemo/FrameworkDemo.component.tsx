import { FrameworkDemoProvider } from './hooks';
import {
  FilePickerRow,
  SourceLinkRow,
  StageDisplay,
  TransportBar,
} from './components';
import styles from './FrameworkDemo.module.css';

const FRAMEWORK_REACT_SOURCE_URL =
  'https://github.com/cutterbl/CDGPlayer/tree/main/apps/framework-demo';

/**
 * Composes the full React demo UI (source links, controls, and stage).
 */
function FrameworkDemo() {
  return (
    // Provider holds shared player/model state so child controls can stay focused.
    <FrameworkDemoProvider>
      <div className={styles.frameworkShell}>
        {/* All controls above the stage grouped in one auto-height container */}
        <div className={styles.controlsHeader}>
          <SourceLinkRow
            href={FRAMEWORK_REACT_SOURCE_URL}
            label="apps/framework-demo"
          />
          {/* Top controls: file loading + transport row */}
          <FilePickerRow />
          <TransportBar />
        </div>

        {/* Stage owns visuals; transport now hosts settings popovers in-row. */}
        <StageDisplay />
      </div>
    </FrameworkDemoProvider>
  );
}

export default FrameworkDemo;
