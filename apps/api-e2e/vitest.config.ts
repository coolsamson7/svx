import { defineConfig } from 'vitest/config';
import ts from 'typescript';
import type { Plugin } from 'vite';
import { resolve } from 'path';

const root = resolve(__dirname, '../..');

const TRIGGERS = ['Reflectable', 'DeclareService', 'DeclareComponent'];
const TRIGGER_PATTERN = new RegExp('@(' + TRIGGERS.join('|') + ')\\b');

function descriptorPlugin(): Plugin {
  return {
    name: 'ts-descriptor-transformer',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.ts') || id.includes('node_modules') || !TRIGGER_PATTERN.test(code)) return null;
      const transformerPath = resolve(root, 'tools/ts-descriptor-transformer/dist/index.js');
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
  root: resolve(__dirname, '.'),
  plugins: [descriptorPlugin()],
  resolve: {
    alias: {
      '@svx/security-nestjs':     resolve(root, 'libs/security/nestjs/src/index.ts'),
      '@svx/security-oidc':       resolve(root, 'libs/security/oidc/src/index.ts'),
      '@svx/security-credentials':resolve(root, 'libs/security/credentials/src/index.ts'),
    },
  },
  oxc: {
    decorator: {
      legacy: true,
      emitDecoratorMetadata: true,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.e2e.spec.ts'],
    reporters: 'verbose',
    hookTimeout: 60000,
    testTimeout: 60000,
  },
});
