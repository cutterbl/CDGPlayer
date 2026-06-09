/// <reference types='vitest' />
import path from 'node:path';
import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/demo',
  resolve: {
    alias: {
      '@shared-assets': path.join(import.meta.dirname, '../../assets/branding'),
      'react-native-fs': path.join(
        import.meta.dirname,
        '../../packages/media-loader/src/lib/shims/react-native-fs.ts',
      ),
    },
  },
  optimizeDeps: {
    exclude: [
      '@cxing/media-core',
      '@cxing/media-parser-cdg',
      '@cxing/media-loader',
      '@cxing/media-player',
      '@cxing/media-playback-controls',
    ],
  },
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  plugins: [nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ nxViteTsPaths() ],
  // },
  build: {
    outDir: '.dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'demo',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      enabled: process.env.CI_COVERAGE === '1',
      reportsDirectory: '../../coverage/apps/demo',
      reporter: ['text-summary', 'json-summary', 'lcov'],
      provider: 'v8' as const,
    },
  },
}));
