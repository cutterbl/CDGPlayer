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
    return {
      ...viteConfig,
      root: resolve(import.meta.dirname, '..'),
      plugins: [...(viteConfig.plugins ?? []), nxViteTsPaths()],
    };
  },
};

export default config;
