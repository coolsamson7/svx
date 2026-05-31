import type { NamingTransform } from '../strategy.js'

/**
 * Optionally prepends a prefix and/or appends a suffix to an identifier.
 */
export class PrefixSuffixTransform implements NamingTransform {
  private readonly prefix: string
  private readonly suffix: string

  constructor(prefix = '', suffix = '') {
    this.prefix = prefix
    this.suffix = suffix
  }

  apply(name: string): string {
    return `${this.prefix}${name}${this.suffix}`
  }
}
