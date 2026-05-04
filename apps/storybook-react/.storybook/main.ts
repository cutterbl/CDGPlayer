import type { StorybookConfig } from '@storybook/react-vite';
import { resolve } from 'node:path';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)', '../stories/**/*.mdx'],
  addons: ['@storybook/addon-links', '@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    defaultName: 'Documentation',
    autodocs: true,
  },
  viteFinal: async (viteConfig) => {
    const existingAlias = viteConfig.resolve?.alias;

    return {
      ...viteConfig,
      root: resolve(import.meta.dirname, '..'),
      resolve: {
        ...viteConfig.resolve,
        alias: {
          ...(Array.isArray(existingAlias) ? {} : existingAlias),
          '@shared-assets': resolve(
            import.meta.dirname,
            '../../../assets/branding',
          ),
          'react-native-fs': resolve(
            import.meta.dirname,
            '../../../packages/media-loader/src/lib/shims/react-native-fs.ts',
          ),
        },
      },
    };
  },
};

export default config;
