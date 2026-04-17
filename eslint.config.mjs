import nxPlugin from '@nx/eslint-plugin';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.dist/**',
      '**/.tsbuild/**',
      '**/coverage/**',
      '.nx/**',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  ...nxPlugin.configs['flat/base'],
  ...nxPlugin.configs['flat/typescript'],
  ...nxPlugin.configs['flat/javascript'],
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      '@nx': nxPlugin,
    },
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [
            '@cxing/framework-demo-app',
            '@cxing/framework-demo-styles',
            '@cxing/demo-app-element',
          ],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.{spec,test}.{ts,tsx,js,jsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
