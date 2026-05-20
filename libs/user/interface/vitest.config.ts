import { defineConfig } from 'vitest/config';
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

      const transformerPath = [process.cwd(), 'tools', 'ts-descriptor-transformer', 'dist', 'index.js'].join('/');
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
  plugins: [descriptorPlugin()],
  oxc: {
    decorator: {
      legacy: true,
      emitDecoratorMetadata: true,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['libs/user/interface/src/**/*.spec.ts', 'libs/user/interface/src/**/*.test.ts'],
    reporters: 'verbose',
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
