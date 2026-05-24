import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { federation } from '@module-federation/vite';
import swc from 'unplugin-swc';
import path from 'path';

export default defineConfig({
  root: __dirname,
  base:    'http://localhost:4201/',

  plugins: [
    federation({
      name: 'remote',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/App.svelte',
        './Bar': './src/Bar.svelte',
      },
      dts: false,
      shared: {
        svelte: {
          singleton:       true,
          requiredVersion: '^5.0.0'
        },
        '@svx/portal': { singleton: true, requiredVersion: '*', import: '@svx/portal' },
      }
    }),
    svelte(),
    swc.vite({
      jsc: {
        parser: {
          syntax:     'typescript',
          decorators: true
        },
        transform: {
          decoratorMetadata: true
        }
      }
    }),
  ],

  resolve: {
    mainFields: ['module', 'browser', 'main'],
    alias: {
      '@svx/common': path.resolve(__dirname, '../../dist/libs/common/index.mjs'),
      '@svx/di':     path.resolve(__dirname, '../../dist/libs/di/index.mjs'),
      '@svx/portal': path.resolve(__dirname, '../../dist/libs/portal/index.mjs'),
    },
  },

  server: {
    port:       4201,
    strictPort: true,
    cors:       true,
    origin:     'http://localhost:4201',
    fs: {
      allow: ['../..'],
    },
  },

  optimizeDeps: {
    exclude: ['@svx/portal'],
  },

  oxc: false,

  build: {
    target:       'esnext',
    minify:       false,
    cssCodeSplit: false
  }
});
