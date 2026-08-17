import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../../..');

export default defineConfig({
  plugins: [vue()],
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  resolve: {
    alias: {
      '@web': __dirname,
      '@': __dirname,
      '@vue/test-utils': resolve(__dirname, 'node_modules/@vue/test-utils'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [resolve(repoRoot, 'tests/frontend/setup.ts')],
    include: ['../../../../tests/frontend/**/*.test.ts'],
    css: true,
  },
});
