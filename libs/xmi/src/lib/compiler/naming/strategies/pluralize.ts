import type { NamingTransform } from '../strategy.js'
import { pluralize } from '../../utils/string-utils.js'

/** Appends a plural suffix to a word using simple English rules. */
export class PluralizeTransform implements NamingTransform {
  apply(name: string): string {
    return pluralize(name)
  }
}
