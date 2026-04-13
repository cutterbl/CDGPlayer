import FrameworkDemo from './app/components/FrameworkDemo';

export type AppProps = Record<string, never>;

/**
 * Thin root wrapper that renders the framework demo feature component.
 */
export function App(_: AppProps) {
  // Keep this wrapper thin so tests and app entrypoints share one stable root.
  return <FrameworkDemo />;
}

export default App;
