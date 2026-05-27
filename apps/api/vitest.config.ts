import { defineConfig } from 'vitest/config';
import ts from 'typescript';
import MagicString from 'magic-string';
import type { Plugin } from 'vite';
import { resolve } from 'path';

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
      const { extractDescriptors } = require(transformerPath);

      const sourceFile = ts.createSourceFile(id, code, ts.ScriptTarget.ES2019, true);
      const { injections, needsTypeImport } = extractDescriptors(sourceFile, TRIGGERS);

      if (injections.length === 0) return null;

      // Use magic-string so original line numbers are untouched → breakpoints stay accurate.
      const s = new MagicString(code);

      for (const { className, pos, text } of injections)
        s.appendRight(pos, `\n${className}._descriptor = ${text};`);

      if (needsTypeImport)
        s.prepend(`import { Type } from '@svx/common';\n`);

      return { code: s.toString(), map: s.generateMap({ hires: true }) };
    },
  };
}

export default defineConfig({
  root: resolve(__dirname, '.'),
  plugins: [descriptorPlugin()],
  oxc: {
    decorator: {
      legacy: true,
      emitDecoratorMetadata: true,
    },
  },
  build: {
    sourcemap: 'inline',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    reporters: 'verbose',
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
