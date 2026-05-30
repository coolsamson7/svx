import type { CompressionStep } from '../compression-pipeline.js'

/**
 * Removes interior vowels from each underscore-delimited segment.
 * The first character of each segment is always preserved.
 * Only applied when the identifier still exceeds maxLength.
 */
export class RemoveVowelsStep implements CompressionStep {
  compress(name: string, maxLength: number): string {
    if (name.length <= maxLength) return name

    const parts = name.split('_')
    const compressed = parts.map(part => {
      if (part.length <= 3) return part
      const first = part[0]
      const rest = part.slice(1).replace(/[aeiouAEIOU]/g, '')
      return first + rest
    })
    return compressed.join('_')
  }
}
