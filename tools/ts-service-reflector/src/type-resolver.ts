import { Node, Type } from "ts-morph";
import * as path from "path";
import { TypeInfo } from "./types";

const workspaceRoot = process.cwd();
const workspaceRootPattern = new RegExp(workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/', 'g');

export function toRelative(absolutePath: string): string {
  return path.relative(workspaceRoot, absolutePath);
}

export function stripAbsolutePaths(typeStr: string): string {
  return typeStr.replace(workspaceRootPattern, '');
}

export class TypeResolver {
  private types = new Map<string, TypeInfo>();

  resolve(type: Type) {
    if (!type) return;

    const symbol = type.getSymbol();
    if (!symbol) return;

    const name = symbol.getName();
    if (this.types.has(name)) return;

    const decl = symbol.getDeclarations()?.[0];
    if (!decl) return;

    const filePath = toRelative(decl.getSourceFile().getFilePath());

    if (Node.isInterfaceDeclaration(decl)) {
      const properties = decl.getProperties().map(p => ({
        name: p.getName(),
        type: stripAbsolutePaths(p.getType().getText()),
      }));

      this.types.set(name, {
        kind: "interface",
        name,
        filePath,
        properties,
      });
    }

    if (Node.isClassDeclaration(decl)) {
      const properties = decl.getProperties().map(p => ({
        name: p.getName(),
        type: stripAbsolutePaths(p.getType().getText()),
      }));

      this.types.set(name, {
        kind: "class",
        name,
        filePath,
        properties,
      });
    }

    if (Node.isEnumDeclaration(decl)) {
      this.types.set(name, {
        kind: "enum",
        name,
        filePath,
      });
    }

    if (Node.isTypeAliasDeclaration(decl)) {
      this.types.set(name, {
        kind: "type",
        name,
        filePath,
        type: stripAbsolutePaths(decl.getType().getText()),
      });
    }

    // recurse into generics + unions
    type.getUnionTypes().forEach(t => this.resolve(t));
    type.getIntersectionTypes().forEach(t => this.resolve(t));
    type.getTypeArguments().forEach(t => this.resolve(t));
  }

  getAll(): TypeInfo[] {
    return Array.from(this.types.values());
  }
}
