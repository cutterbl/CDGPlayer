import { fileURLToPath } from "node:url";
import type { StorybookConfig } from '@storybook/web-components-vite';
import { resolve, dirname } from 'node:path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)', '../stories/**/*.mdx'],
  addons: [getAbsolutePath("@storybook/addon-links"), getAbsolutePath("@storybook/addon-docs")],
  framework: {
    name: getAbsolutePath("@storybook/web-components-vite"),
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

function getAbsolutePath(value: string): any {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
