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
        '@svx/portal': { singleton: true, requiredVersion: '*', import: '@svx/portal' },
      },
    }),
    svelte(),
    swc.vite({
      sourceMaps: true,
      jsc: {
        target: 'es2022',
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
      '@svx/common':              path.resolve(__dirname, '../../dist/libs/common/index.mjs'),
      '@svx/di':                  path.resolve(__dirname, '../../dist/libs/di/index.mjs'),
      '@svx/portal':              path.resolve(__dirname, '../../dist/libs/portal/index.mjs'),
      '@svx/security':            path.resolve(__dirname, '../../dist/libs/security/src/lib/browser'),
      '@svx/security-oidc':       path.resolve(__dirname, '../../dist/libs/security/oidc/src'),
      '@svx/security-credentials':path.resolve(__dirname, '../../dist/libs/security/credentials/src'),
      '@svx/service-common':      path.resolve(__dirname, '../../dist/libs/service/common/src'),
      '@svx/service-client':      path.resolve(__dirname, '../../dist/libs/service/client/src'),
      '@svx/user-interface':      path.resolve(__dirname, '../../dist/libs/user/interface/index.mjs'),
      // npm workspaces hoists these to the repo root — point Vite directly
      'elkjs/lib/elk.bundled.js': path.resolve(__dirname, '../../node_modules/elkjs/lib/elk.bundled.js'),
      'fast-xml-parser':          path.resolve(__dirname, '../../node_modules/fast-xml-parser/src/fxp.js'),
      '@xyflow/svelte':           path.resolve(__dirname, '../../node_modules/@xyflow/svelte'),
    },
  },

  oxc: false,

  build: {
    target: 'esnext',
  },

  optimizeDeps: {
    exclude: [
      '@svx/common', '@svx/di', '@svx/portal',
      '@svx/security', '@svx/security-oidc', '@svx/security-credentials',
      '@svx/service-common', '@svx/service-client', '@svx/user-interface',
    ],
    include: ['elkjs > elkjs/lib/elk.bundled.js'],
  },

  server: {
    port: 4200,
    fs: {
      allow: ['../..'],
    },
  },
});
