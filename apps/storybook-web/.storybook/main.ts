import type { StorybookConfig } from '@storybook/web-components-vite';
import { resolve } from 'node:path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

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
      root: resolve(import.meta.dirname, '..'),
      resolve: {
        ...(viteConfig.resolve ?? {}),
        alias: {
          ...((viteConfig.resolve && viteConfig.resolve.alias) || {}),
          '@shared-assets': resolve(
            import.meta.dirname,
            '../../../assets/branding',
          ),
          'react-native-fs': resolve(
            import.meta.dirname,
            './shims/react-native-fs.ts',
          ),
        },
      },
      plugins: [...(viteConfig.plugins ?? []), nxViteTsPaths()],
    };
  },
};

export default config;
