import type { NamingTransform } from '../strategy.js'
import { toSnakeCase } from '../../utils/string-utils.js'

/** Converts camelCase / PascalCase identifiers to lower_snake_case. */
export class SnakeCaseTransform implements NamingTransform {
  apply(name: string): string {
    return toSnakeCase(name)
  }
}
