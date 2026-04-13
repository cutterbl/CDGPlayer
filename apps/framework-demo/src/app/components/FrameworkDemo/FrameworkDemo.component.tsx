import { FrameworkDemoProvider } from './hooks';
import {
  FilePickerRow,
  SettingsPanel,
  SourceLinkRow,
  StageDisplay,
  TransportBar,
} from './components';
import styles from './FrameworkDemo.module.css';

const FRAMEWORK_REACT_SOURCE_URL =
  'https://github.com/cutterbl/CDGPlayer/tree/main/apps/framework-demo';

export type FrameworkDemoProps = Record<string, never>;

/**
 * Composes the full React demo UI (source links, controls, and stage).
 */
function FrameworkDemo(_: FrameworkDemoProps) {
  return (
    // Provider holds shared player/model state so child controls can stay focused.
    <FrameworkDemoProvider>
      <div className={styles.frameworkShell}>
        <SourceLinkRow
          href={FRAMEWORK_REACT_SOURCE_URL}
          label="apps/framework-demo"
        />

        {/* Top controls: file loading + transport row */}
        <FilePickerRow />
        <TransportBar />

        {/* Stage owns visuals; settings panel floats inside the stage area */}
        <StageDisplay>
          <SettingsPanel />
        </StageDisplay>
      </div>
    </FrameworkDemoProvider>
  );
}

export default FrameworkDemo;
