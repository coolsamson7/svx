import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import swc from 'unplugin-swc';
import path from 'path';

export default defineConfig({
  plugins: [
    svelte(),
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true },
      },
    }),
  ],
  oxc: false,

  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    outDir: path.resolve(__dirname, '../../dist/libs/di'),
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      external: ['@svx/common', 'svelte', /^svelte\//, 'reflect-metadata'],
    },
  },
  resolve: {
    alias: {
      '@svx/common': path.resolve(__dirname, '../../dist/libs/common/index.js'),
    },
  },
});
