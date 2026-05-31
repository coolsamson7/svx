import type { NamingTransform } from '../strategy.js'
import { removeSuffix } from '../../utils/string-utils.js'

/**
 * Strips well-known class-name suffixes (Entity, Dto, VO, etc.) from a type name.
 */
export class RemoveSuffixTransform implements NamingTransform {
  private readonly suffixes: string[]

  constructor(suffixes: string[]) {
    this.suffixes = suffixes
  }

  apply(name: string): string {
    return removeSuffix(name, this.suffixes)
  }
}
