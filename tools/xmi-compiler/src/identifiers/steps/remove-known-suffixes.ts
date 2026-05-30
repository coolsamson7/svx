import type { CompressionStep } from '../compression-pipeline.js'

/** Suffixes that add no semantic information to an identifier */
const KNOWN_SUFFIXES = [
  'TABLE', 'COLUMN', 'REFERENCE', 'ASSOCIATION', 'RELATION',
  'ENTITY', 'OBJECT', 'RECORD', 'ROW', 'ITEM',
]

/**
 * Removes well-known structural suffixes from identifier segments.
 * Operates on underscore-separated tokens.
 */
export class RemoveKnownSuffixesStep implements CompressionStep {
  compress(name: string, _maxLength: number): string {
    const parts = name.split('_')
    const filtered = parts.filter(p => !KNOWN_SUFFIXES.includes(p.toUpperCase()))
    const result = filtered.length > 0 ? filtered.join('_') : name
    return result
  }
}
