import type { StorybookConfig } from '@storybook/web-components-vite';

const isStaticBuild = process.env.STORYBOOK_BUILD === 'true';

const config: StorybookConfig = {
  stories: ['../docs/**/*.mdx'],
  addons: ['@storybook/addon-links', '@storybook/addon-docs'],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
  refs: isStaticBuild
    ? {
        'framework-agnostic': {
          title: 'Framework-agnostic Examples',
          url: './storybook-web',
        },
        react: {
          title: 'React Examples',
          url: './storybook-react',
        },
      }
    : {
        'framework-agnostic': {
          title: 'Framework-agnostic Examples',
          url: 'http://localhost:4401',
        },
        react: {
          title: 'React Examples',
          url: 'http://localhost:4402',
        },
      },
  docs: {
    defaultName: 'Documentation',
  },
};

export default config;
