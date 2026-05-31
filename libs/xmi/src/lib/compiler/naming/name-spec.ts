/**
 * Compact name-transformation DSL.
 *
 * Space-separated ops applied left-to-right:
 *   -suffix      strip trailing suffix (if present)
 *   +suffix      append suffix
 *   ^prefix      prepend prefix
 *   ^-prefix     strip leading prefix (if present)
 *   ~foo->bar    replace first occurrence of "foo" with "bar"
 *   =snake       lower_snake_case
 *   =SNAKE       UPPER_SNAKE_CASE
 *   =kebab       kebab-case
 *   =camel       camelCase
 *   =pascal      PascalCase
 *   =upper       UPPERCASE
 *   =lower       lowercase
 *   =title       Title Case
 *   =plural      English pluralisation
 */

import {
  toSnakeCase, toUpperSnakeCase, toKebabCase,
  toCamelCase, toPascalCase, pluralize,
} from '../utils/string-utils.js'
import type { NamingTransform } from './strategy.js'

type SpecOp =
  | { op: 'strip-suffix';  value: string }
  | { op: 'add-suffix';    value: string }
  | { op: 'strip-prefix';  value: string }
  | { op: 'add-prefix';    value: string }
  | { op: 'replace';       from: string; to: string }
  | { op: 'case';          style: string }
  | { op: 'plural' }

export function parseNameSpec(spec: string): SpecOp[] {
  const tokens = spec.trim().split(/\s+/).filter(Boolean)
  const ops: SpecOp[] = []
  for (const token of tokens) {
    if (token.startsWith('^-')) {
      ops.push({ op: 'strip-prefix', value: token.slice(2) })
    } else if (token.startsWith('^')) {
      ops.push({ op: 'add-prefix', value: token.slice(1) })
    } else if (token.startsWith('-')) {
      ops.push({ op: 'strip-suffix', value: token.slice(1) })
    } else if (token.startsWith('+')) {
      ops.push({ op: 'add-suffix', value: token.slice(1) })
    } else if (token.startsWith('~')) {
      const inner = token.slice(1)
      // Accept both → (U+2192) and -> as separator
      const arrowIdx = inner.indexOf('→')
      const dashIdx  = inner.indexOf('->')
      const sep    = arrowIdx >= 0 ? arrowIdx : dashIdx
      const sepLen = arrowIdx >= 0 ? 1 : 2
      if (sep >= 0) {
        ops.push({ op: 'replace', from: inner.slice(0, sep), to: inner.slice(sep + sepLen) })
      }
    } else if (token === '=plural') {
      ops.push({ op: 'plural' })
    } else if (token.startsWith('=')) {
      ops.push({ op: 'case', style: token.slice(1) })
    }
  }
  return ops
}

function applyOps(name: string, ops: SpecOp[]): string {
  let s = name
  for (const op of ops) {
    switch (op.op) {
      case 'strip-suffix':
        if (s.endsWith(op.value) && s.length > op.value.length) s = s.slice(0, -op.value.length)
        break
      case 'add-suffix':
        s = s + op.value
        break
      case 'strip-prefix':
        if (s.startsWith(op.value) && s.length > op.value.length) s = s.slice(op.value.length)
        break
      case 'add-prefix':
        s = op.value + s
        break
      case 'replace':
        s = s.replace(op.from, op.to)
        break
      case 'case':
        switch (op.style) {
          case 'snake':  s = toSnakeCase(s); break
          case 'SNAKE':  s = toUpperSnakeCase(s); break
          case 'kebab':  s = toKebabCase(s); break
          case 'camel':  s = toCamelCase(s); break
          case 'pascal': s = toPascalCase(s); break
          case 'upper':  s = s.toUpperCase(); break
          case 'lower':  s = s.toLowerCase(); break
          case 'title':  s = s.replace(/\b\w/g, c => c.toUpperCase()); break
        }
        break
      case 'plural':
        s = pluralize(s)
        break
    }
  }
  return s
}

/** Apply a spec string to a name. */
export function applyNameSpec(name: string, spec: string): string {
  return applyOps(name, parseNameSpec(spec))
}

/** Wrap a spec string as a NamingTransform. */
export function specToTransform(spec: string): NamingTransform {
  const ops = parseNameSpec(spec)
  return { apply: (name: string) => applyOps(name, ops) }
}
