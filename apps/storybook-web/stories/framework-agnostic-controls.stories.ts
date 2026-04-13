import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { AppElement } from '../../demo/src/app/app.element';

const storyTagName = 'cdg-storybook-framework-agnostic-demo';

if (!customElements.get(storyTagName)) {
  customElements.define(storyTagName, AppElement);
}

const meta: Meta = {
  title: 'Examples/Framework-agnostic Demo',
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    actions: { disable: true },
    interactions: { disable: true },
    options: { showPanel: false },
    docs: {
      description: {
        story:
          'Primary framework-agnostic demo with full player interactivity, controls, styling, and perf HUD.',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
  render: () => {
    const host = document.createElement(storyTagName);
    host.setAttribute('data-story', 'framework-agnostic-primary');
    return host;
  },
};
