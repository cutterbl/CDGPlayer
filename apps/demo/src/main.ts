import { AppElement } from './app/app.element';

/**
 * Registers the framework-agnostic demo custom element on page load.
 */
// Register a reusable custom element once, then let HTML instantiate it.
// This is the framework-agnostic entrypoint for the demo.
if (!customElements.get('app-root')) {
  customElements.define('app-root', AppElement);
}
