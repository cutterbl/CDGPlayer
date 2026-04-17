import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from '@cxing/framework-demo-app';
import '@cxing/framework-demo-styles';

const meta: Meta<typeof App> = {
  title: 'Examples/React Demo',
  component: App,
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    actions: { disable: true },
    interactions: { disable: true },
    options: { showPanel: false },
    docs: {
      description: {
        story:
          'Primary React framework demo with full player interactivity, styling, and perf HUD.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof App>;

export const Primary: Story = {};
