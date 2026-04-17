import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles.css';

/**
 * React entrypoint for the framework demo app.
 */
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root mount element.');
}

// Standard React bootstrap: mount our app into the page root node.
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
