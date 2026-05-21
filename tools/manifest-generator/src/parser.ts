// tools/manifest-generator/src/parser.ts
import { Project, SyntaxKind, type CallExpression, type ObjectLiteralExpression } from 'ts-morph';
import { readFile } from 'fs/promises';
import { glob } from 'glob';
import path from 'path';

export interface ParseResult {
  meta: Record<string, any>;
  file: string;
  line: number;
}

export class FeatureManifestParser {
  private project: Project;

  constructor(tsConfigPath: string) {
    this.project = new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: true,
    });
  }

  async parseDirectory(root: string): Promise<ParseResult[]> {
    const files = await glob('**/*.svelte', {
      cwd: root,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**']
    });

    const results: ParseResult[] = [];
    for (const file of files) {
      results.push(...await this.parseFile(file, root));
    }
    return results;
  }

  async parseFile(filePath: string, root: string): Promise<ParseResult[]> {
    const content = await readFile(filePath, 'utf-8');

    const script = this.extractModuleScript(content);
    if (!script?.includes('defineFeature')) return [];

    const virtualPath = filePath + '.ts';
    const sourceFile  = this.project.createSourceFile(virtualPath, script, {
      overwrite: true
    });

    const results: ParseResult[] = [];

    const calls = sourceFile
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(c => c.getExpression().getText() === 'defineFeature');

    for (const call of calls) {
      const meta = this.extractMeta(call);
      if (meta) {
        results.push({
          meta,
          file: path.relative(root, filePath),
          line: call.getStartLineNumber(),
        });
      }
    }

    this.project.removeSourceFile(sourceFile);
    return results;
  }

  private extractModuleScript(content: string): string | null {
    return content.match(
      /<script\s[^>]*\bmodule\b[^>]*>([\s\S]*?)<\/script>/
    )?.[1] ?? null;
  }

  private extractMeta(call: CallExpression): Record<string, any> | null {
    const arg = call.getArguments()[0];
    if (arg?.getKind() !== SyntaxKind.ObjectLiteralExpression) return null;
    return this.parseObject(arg as ObjectLiteralExpression);
  }

  private parseObject(obj: ObjectLiteralExpression): Record<string, any> {
    const result: Record<string, any> = {};

    for (const prop of obj.getProperties()) {
      if (prop.getKind() !== SyntaxKind.PropertyAssignment) continue;

      const pa    = prop.asKind(SyntaxKind.PropertyAssignment)!;
      const name  = pa.getName();
      const value = pa.getInitializer();
      if (!value) continue;

      switch (value.getKind()) {
        case SyntaxKind.StringLiteral:
          result[name] = value.asKind(SyntaxKind.StringLiteral)!.getLiteralValue();
          break;

        case SyntaxKind.ArrayLiteralExpression:
          result[name] = value
            .asKind(SyntaxKind.ArrayLiteralExpression)!
            .getElements()
            .flatMap(e => {
              if (e.getKind() === SyntaxKind.StringLiteral)
                return [e.asKind(SyntaxKind.StringLiteral)!.getLiteralValue()];
              if (e.getKind() === SyntaxKind.ObjectLiteralExpression)
                return [this.parseObject(e.asKind(SyntaxKind.ObjectLiteralExpression)!)];
              return [];
            });
          break;

        case SyntaxKind.TrueKeyword:  result[name] = true;  break;
        case SyntaxKind.FalseKeyword: result[name] = false; break;

        case SyntaxKind.ObjectLiteralExpression:
          result[name] = this.parseObject(value as ObjectLiteralExpression);
          break;
      }
    }

    return result;
  }
}
