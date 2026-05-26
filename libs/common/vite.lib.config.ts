import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    outDir: path.resolve(__dirname, '../../dist/libs/common'),
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      external: [],
    },
  },
});
