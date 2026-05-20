import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { federation } from '@module-federation/vite';
import swc from 'unplugin-swc';
import path from 'path';
import ts from 'typescript';
import type { Plugin } from 'vite';

const TRIGGERS = ['Reflectable', 'DeclareService', 'DeclareComponent'];
const TRIGGER_PATTERN = new RegExp(TRIGGERS.join('|'));

function descriptorPlugin(): Plugin {
  return {
    name: 'ts-descriptor-transformer',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.ts') || id.includes('node_modules') || !TRIGGER_PATTERN.test(code)) return null;
      const transformerPath = require.resolve(['ts-descriptor-transformer'].join(''));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { before } = require(transformerPath);
      const sourceFile = ts.createSourceFile(id, code, ts.ScriptTarget.ES2019, true);
      const fakeProgram = { getTypeChecker: () => ({}) } as unknown as ts.Program;
      const result = ts.transform(sourceFile, [before({ decorators: TRIGGERS }, fakeProgram)]);
      return ts.createPrinter().printFile(result.transformed[0]);
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [
    descriptorPlugin(),
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
      '@svx/security-oidc': path.resolve(__dirname, '../../libs/security/oidc/src'),
      '@svx/security-credentials': path.resolve(__dirname, '../../libs/security/credentials/src'),
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
