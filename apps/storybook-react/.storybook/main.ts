import { fileURLToPath } from "node:url";
import type { StorybookConfig } from '@storybook/react-vite';
import { resolve, dirname } from 'node:path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)', '../stories/**/*.mdx'],
  addons: [getAbsolutePath("@storybook/addon-links"), getAbsolutePath("@storybook/addon-docs")],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },
  docs: {
    defaultName: 'Documentation'
  },
  viteFinal: async (viteConfig) => {
    const existingAlias = viteConfig.resolve?.alias;

    return {
      ...viteConfig,
      plugins: [...(viteConfig.plugins ?? []), nxViteTsPaths()],
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

function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
