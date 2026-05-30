/**
 * High-level identifier shortener — wraps the compression pipeline with
 * max-length awareness.
 */

import { IdentifierCompressionPipeline } from './compression-pipeline.js'

/**
 * Shortens identifiers that exceed a database's maximum identifier length.
 * Uses a deterministic pipeline so the same input always produces the same output.
 */
export class IdentifierShortener {
  private readonly pipeline: IdentifierCompressionPipeline
  private readonly maxLength: number

  constructor(maxLength: number, abbreviations?: Record<string, string>) {
    this.maxLength = maxLength
    this.pipeline = new IdentifierCompressionPipeline(maxLength, abbreviations)
  }

  /**
   * Shorten `name` if it exceeds `maxLength`.
   * Returns `name` unchanged if it already fits.
   */
  shorten(name: string): string {
    if (name.length <= this.maxLength) return name
    return this.pipeline.compress(name)
  }

  /** Maximum identifier length this shortener targets */
  get limit(): number {
    return this.maxLength
  }
}
