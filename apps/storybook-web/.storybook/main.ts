import type { StorybookConfig } from '@storybook/web-components-vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

const storybookDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(storybookDir, '..');

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
      plugins: [...(viteConfig.plugins ?? []), nxViteTsPaths()],
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

function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
