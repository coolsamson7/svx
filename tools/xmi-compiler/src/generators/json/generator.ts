/**
 * JSON generator — serialises any metadata object to a formatted JSON string.
 */

import type { Generator } from '../yaml/generator.js'

/** Serialises any value to formatted JSON */
export class JsonGenerator<T> implements Generator<T> {
  private readonly indent: number

  constructor(indent = 2) {
    this.indent = indent
  }

  generate(data: T): string {
    return JSON.stringify(data, null, this.indent)
  }
}
