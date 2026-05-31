import type { NamingTransform } from '../strategy.js'
import { toKebabCase } from '../../utils/string-utils.js'

/** Converts camelCase / PascalCase identifiers to kebab-case. */
export class KebabCaseTransform implements NamingTransform {
  apply(name: string): string {
    return toKebabCase(name)
  }
}
