import { fileURLToPath } from "node:url";
import type { StorybookConfig } from '@storybook/web-components-vite';
import { resolve, dirname } from 'node:path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

const isStaticBuild = process.env.STORYBOOK_BUILD === 'true';

const config: StorybookConfig = {
  stories: ['../docs/**/*.mdx'],
  addons: [getAbsolutePath("@storybook/addon-links"), getAbsolutePath("@storybook/addon-docs")],
  framework: {
    name: getAbsolutePath("@storybook/web-components-vite"),
    options: {},
  },
  refs: isStaticBuild
    ? {
        'framework-agnostic': {
          title: 'Framework-agnostic Examples',
          url: './storybook-web',
          index: './storybook-web/index.json',
        },
        react: {
          title: 'React Examples',
          url: './storybook-react',
          index: './storybook-react/index.json',
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
        },
      },
    };
  },
};

export default config;

function getAbsolutePath(value: string): string {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}
