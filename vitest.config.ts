import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.spec.ts', '**/*.test.ts'],
    exclude: ['libs/service/nestjs/**', 'libs/user/interface/**', 'node_modules/**'],

    hookTimeout: 30000,
    testTimeout: 30000,
  }
});
