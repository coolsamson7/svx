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
        '@svx/portal': {
           singleton: true,
           //eager: true,
           requiredVersion: false
        }
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
    mainFields: ['module', 'browser', 'main']
    //alias: {
    //  '@svx/portal': path.resolve(__dirname, '../../libs/portal/src'),//'shell/portal'
    //}
  },

  server: {
    port:       4201,
    strictPort: true,
    cors:       true,
    origin:     'http://localhost:4201'
  },

  build: {
    target:       'esnext',
    minify:       false,
    cssCodeSplit: false
  }
});
