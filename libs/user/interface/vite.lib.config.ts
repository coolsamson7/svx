import { defineConfig } from 'vite';
import swc from 'unplugin-swc';
import path from 'path';
import ts from 'typescript';
import type { Plugin } from 'vite';

const TRIGGERS = ['Reflectable', 'DeclareService', 'DeclareComponent', 'Implementation'];
const TRIGGER_PATTERN = new RegExp(TRIGGERS.join('|'));

function descriptorPlugin(): Plugin {
  return {
    name: 'ts-descriptor-transformer',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.ts') || id.includes('node_modules') || !TRIGGER_PATTERN.test(code)) return null;
      const transformerPath = require.resolve('ts-descriptor-transformer');
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
  plugins: [
    descriptorPlugin(),
    swc.vite({
      jsc: {
        target: 'es2022',
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
    outDir: path.resolve(__dirname, '../../../dist/libs/user/interface'),
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rollupOptions: {
      external: [
        '@svx/common', '@svx/di', '@svx/portal',
        '@svx/service-common', '@svx/security',
        'svelte', /^svelte\//, 'reflect-metadata',
        '@nestjs/swagger', '@nestjs/common',
      ],
    },
  },

  resolve: {
    alias: {
      '@svx/common':         path.resolve(__dirname, '../../../dist/libs/common/index.mjs'),
      '@svx/di':             path.resolve(__dirname, '../../../dist/libs/di/index.mjs'),
      '@svx/portal':         path.resolve(__dirname, '../../../dist/libs/portal/index.mjs'),
      '@svx/service-common': path.resolve(__dirname, '../../../dist/libs/service/common/src'),
    },
  },
});
