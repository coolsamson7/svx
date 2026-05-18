import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { federation } from '@module-federation/vite';
import swc from 'unplugin-swc';
import path from 'path';

export default defineConfig({
  root: __dirname,
  plugins: [
    federation({
      name: 'shell',
      dts: false,
      //exposes: {
      //  './portal': '../../libs/portal/src/index.ts'  // ← expose the lib
      //},
      shared: {
        svelte: {
          singleton: true,
          requiredVersion: '^5.0.0',
        },
        //'@svx/portal': {
        // singleton: true,
        //eager: true,
        //  requiredVersion: false
        //}
      },
    }),
    svelte(),
    swc.vite({
      sourceMaps: true,
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          decoratorMetadata: true,
        },
      },
    }),
  ],

  resolve: {
    //  mainFields: ['module', 'browser', 'main'],
    alias: {
      '@svx/common': path.resolve(__dirname, '../../libs/common/src'),
      '@svx/di': path.resolve(__dirname, '../../libs/di/src'),
      '@svx/validation': path.resolve(__dirname, '../../libs/validation/src'),
      '@svx/portal': path.resolve(__dirname, '../../libs/portal/src'),
      '@svx/security': path.resolve(__dirname, '../../libs/security/src'),
      '@svx/service-common': path.resolve(__dirname, '../../libs/service/common/src'),
      '@svx/service-client': path.resolve(__dirname, '../../libs/service/client/src'),

       '@svx/user-interface': path.resolve(__dirname, '../../libs/user/interface/src'),
    },
  },

  oxc: false,

  build: {
    target: 'esnext',
  },

  //optimizeDeps: {
  //  exclude: ['remote']
  //},

  server: {
    port: 4200,
    fs: {
      allow: ['../..'],
    },
  },
});
