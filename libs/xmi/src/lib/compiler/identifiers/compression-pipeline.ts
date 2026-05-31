/**
 * Identifier compression pipeline — progressively shortens an identifier
 * until it fits within the target database's max identifier length.
 */

import { RemoveKnownSuffixesStep } from './steps/remove-known-suffixes.js'
import { CompressDictionaryStep, DEFAULT_ABBREVIATIONS } from './steps/compress-dictionary.js'
import { RemoveVowelsStep } from './steps/remove-vowels.js'
import { TruncateStep } from './steps/truncate.js'
import { HashSuffixStep } from './steps/hash-suffix.js'

/**
 * A single step in the compression pipeline.
 * Each step receives the current name and the target maxLength.
 */
export interface CompressionStep {
  compress(name: string, maxLength: number): string
}

/**
 * Progressively applies compression steps until the identifier fits within maxLength.
 * Steps are applied in order; later steps are only applied if earlier ones were insufficient.
 */
export class IdentifierCompressionPipeline {
  private readonly maxLength: number
  private readonly steps: CompressionStep[]

  constructor(maxLength: number, abbreviations?: Record<string, string>) {
    this.maxLength = maxLength
    this.steps = [
      new RemoveKnownSuffixesStep(),
      new CompressDictionaryStep(abbreviations ?? DEFAULT_ABBREVIATIONS),
      new RemoveVowelsStep(),
      new TruncateStep(),
    ]
  }

  /**
   * Compress `logical` to fit within `maxLength`.
   * If the original already fits, it is returned unchanged.
   * If compression is needed, a deterministic hash suffix is added for uniqueness.
   */
  compress(logical: string): string {
    if (logical.length <= this.maxLength) return logical

    const original = logical
    let current = logical

    for (const step of this.steps) {
      current = step.compress(current, this.maxLength)
      if (current.length <= this.maxLength) return current
    }

    // Final safety net: add hash suffix
    const hashStep = new HashSuffixStep(original)
    return hashStep.compress(current, this.maxLength)
  }
}
