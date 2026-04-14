import type { StorybookConfig } from '@storybook/react-vite';
import { resolve } from 'node:path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)', '../stories/**/*.mdx'],
  addons: ['@storybook/addon-links', '@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    defaultName: 'Documentation',
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
          'react-native-fs': resolve(
            import.meta.dirname,
            '../../../packages/cdg-loader/src/lib/shims/react-native-fs.ts',
          ),
        },
      },
      plugins: [...(viteConfig.plugins ?? []), nxViteTsPaths()],
    };
  },
};

export default config;
