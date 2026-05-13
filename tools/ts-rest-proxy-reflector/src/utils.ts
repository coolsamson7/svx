import * as path from 'path';

const workspaceRoot = process.cwd();

const workspaceRootPattern = new RegExp(
  workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/',
  'g',
);

export function stripQuotes(value?: string): string | undefined {
  if (!value) return undefined;

  return value.replace(/^['"]|['"]$/g, '');
}

export function stripAbsolutePaths(value: string): string {
  return value.replace(workspaceRootPattern, '');
}

export function toRelative(absolutePath: string): string {
  return path.relative(workspaceRoot, absolutePath);
}
