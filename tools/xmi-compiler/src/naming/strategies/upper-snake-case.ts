import type { NamingTransform } from '../strategy.js'
import { toUpperSnakeCase } from '../../utils/string-utils.js'

/** Converts camelCase / PascalCase identifiers to UPPER_SNAKE_CASE. */
export class UpperSnakeCaseTransform implements NamingTransform {
  apply(name: string): string {
    return toUpperSnakeCase(name)
  }
}
