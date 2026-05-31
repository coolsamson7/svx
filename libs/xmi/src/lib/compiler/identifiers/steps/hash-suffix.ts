import type { CompressionStep } from '../compression-pipeline.js'
import { shortHash } from '../../utils/string-utils.js'

/**
 * Appends `_XXXXX` (5-char hash of the original name) to the compressed identifier.
 * This guarantees uniqueness even after aggressive truncation.
 * The original name is passed in via the `originalName` context stored on the step.
 */
export class HashSuffixStep implements CompressionStep {
  private originalName: string

  constructor(originalName: string) {
    this.originalName = originalName
  }

  compress(name: string, maxLength: number): string {
    const hash = shortHash(this.originalName)
    const candidate = `${name}_${hash}`
    // If for some reason even this is too long, truncate the base further
    if (candidate.length > maxLength) {
      const base = name.slice(0, maxLength - 6)
      return `${base}_${hash}`
    }
    return candidate
  }
}
