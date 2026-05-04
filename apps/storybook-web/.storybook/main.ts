import type { StorybookConfig } from '@storybook/web-components-vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const storybookDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(storybookDir, '..');

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)', '../stories/**/*.mdx'],
  addons: ['@storybook/addon-links', '@storybook/addon-docs'],
  framework: {
    name: '@storybook/web-components-vite',
    options: {},
  },
  docs: {
    defaultName: 'Documentation',
  },
  viteFinal: async (viteConfig) => {
    return {
      ...viteConfig,
      root: appRoot,
      resolve: {
        ...(viteConfig.resolve ?? {}),
        alias: {
          ...((viteConfig.resolve && viteConfig.resolve.alias) || {}),
          '@shared-assets': resolve(storybookDir, '../../../assets/branding'),
          'react-native-fs': resolve(
            storybookDir,
            './shims/react-native-fs.ts',
          ),
        },
      },
    };
  },
};

export default config;
