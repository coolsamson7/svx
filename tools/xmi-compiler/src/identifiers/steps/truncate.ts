import type { CompressionStep } from '../compression-pipeline.js'

/**
 * Hard-truncates an identifier to `maxLength - 6` characters,
 * leaving room for a `_XXXXX` hash suffix that guarantees uniqueness.
 */
export class TruncateStep implements CompressionStep {
  compress(name: string, maxLength: number): string {
    const limit = maxLength - 6
    if (name.length <= limit) return name
    return name.slice(0, limit)
  }
}
