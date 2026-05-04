import type { Preview } from '@storybook/web-components-vite';

const STORYBOOK_STORY_CHANGE_EVENT = 'cdg:storybook-story-change';
let lastStoryId: string | null = null;

import type { Decorator } from '@storybook/web-components-vite';

const stopPlaybackOnStoryChange: Decorator = (Story, context) => {
  if (context.id !== lastStoryId) {
    lastStoryId = context.id;
    window.dispatchEvent(new Event(STORYBOOK_STORY_CHANGE_EVENT));
  }

  return Story();
};

const preview: Preview = {
  decorators: [stopPlaybackOnStoryChange],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    options: {
      showPanel: false,
      storySort: {
        order: ['Documentation', 'Examples'],
      },
    },
  },
};

export default preview;
