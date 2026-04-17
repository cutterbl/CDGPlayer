import type { Preview } from '@storybook/web-components-vite';

const preview: Preview = {
  parameters: {
    options: {
      storySort: {
        order: [
          'Documentation',
          [
            'Introduction',
            'Getting Started',
            'Architecture',
            'API',
            ['Loader Contract', 'Player Contract', 'Controls Contract'],
            'Workers and Audio',
            'Contribution Guidelines',
            'Overview',
          ],
        ],
      },
    },
  },
};

export default preview;
