import { createRoot } from 'react-dom/client';
import { App } from './App.js';

/**
 * Smoke test coverage for framework demo app mounting lifecycle.
 */
describe('App', () => {
  /**
   * Verifies root component can mount and unmount cleanly.
   */
  it('mounts and unmounts without crashing', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);

    const root = createRoot(host);
    root.render(<App />);
    root.unmount();

    host.remove();
  });
});
