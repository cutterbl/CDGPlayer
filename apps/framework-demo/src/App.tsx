import FrameworkDemo from './app/components/FrameworkDemo';

/**
 * Thin root wrapper that renders the framework demo feature component.
 */
export function App() {
  // Keep this wrapper thin so tests and app entrypoints share one stable root.
  return <FrameworkDemo />;
}

export default App;
