import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  root: __dirname,
  plugins: [
    svelte({ configFile: false }),
    {
      name: 'serve-model-xmi',
      configureServer(server) {
        server.middlewares.use('/model.xmi', (_req, res) => {
          const file = path.resolve(__dirname, '../../model.xmi');
          res.setHeader('Content-Type', 'text/xml');
          res.end(fs.readFileSync(file));
        });
      },
    },
  ],
  build: {
    outDir: 'static',
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: {
        main:   path.resolve(__dirname, 'index.html'),
        config: path.resolve(__dirname, 'config-page/index.html'),
      },
    },
  },
  server: {
    port: 5174,
  },
});
