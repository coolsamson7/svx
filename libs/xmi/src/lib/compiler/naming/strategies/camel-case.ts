import type { NamingTransform } from '../strategy.js'
import { toCamelCase } from '../../utils/string-utils.js'

/** Converts snake_case / UPPER_SNAKE_CASE identifiers to camelCase. */
export class CamelCaseTransform implements NamingTransform {
  apply(name: string): string {
    return toCamelCase(name)
  }
}

/** Converts any identifier to plain lower-case. */
export class LowerCaseTransform implements NamingTransform {
  apply(name: string): string {
    return name.toLowerCase()
  }
}

/** Converts any identifier to plain UPPER-CASE. */
export class UpperCaseTransform implements NamingTransform {
  apply(name: string): string {
    return name.toUpperCase()
  }
}
